"""
Can run with venv of vreapis
"""
import asyncio
import pprint
from asyncio import Task

import psutil
import re
import argparse
import logging
from typing import NamedTuple, TypeAlias
import datetime
from datetime import timedelta
import time
from enum import Enum, auto
import sys
import os
import signal
import csv
from pathlib import Path

log_level = logging.INFO
logger = logging.getLogger(__name__)
logger.setLevel(log_level)
default_console_handler = logging.StreamHandler()
default_console_handler.setLevel(log_level)
logger.addHandler(default_console_handler)  # omitting this handler won't let the logger log normally [then only logs with warning or higher levels are shown]

common_re_flags = re.IGNORECASE

process_filter: dict[str, str] = {  # Process-group-wide REs. To filter the process to monitor in the process list. Keys are process group names.
    'chrome': r'.*/chrom.*',
    'JupyterLab_backend': r'jupyter.?lab',
    'RStudio_backend': r'rstudio-server',
    'vreapi': r'.*/bin/python\s+.*/VREPaaS/vreapis/manage.py\s+runserver',
    'database': r'postgres',
}


class Performance_Index(NamedTuple):  # Use NamedTuple to reduce overhead when attribute names are always fixed
    CPU_usage: float
    memory_usage: int  # in Bytes


class Performance_Sample(NamedTuple):  # Each instance corresponds to exactly 1 row of the raw CPU/memo usage CSVs.
    time: datetime.datetime
    PID: int
    username: str
    process_name: str
    cmdline: str
    CPU_usage: float
    memory_usage: int


Aggregated_Performance_Sample: TypeAlias = dict[str, datetime.datetime | Performance_Index]  # Keys can be process group names and shared property values [i.e. time]. Each instance corresponds to exactly 1 row of the cooked CPU/memo usage CSVs.
Process_Group: TypeAlias = dict[str, list[psutil.Process]]

process_group: Process_Group = {}

argument_parser = argparse.ArgumentParser()
argument_parser.add_argument('-b', '--browser-process-filter', nargs='?', default=None, const=process_filter['chrome'])
argument_parser.add_argument('-j', '--JupyterLab-backend-process-filter', nargs='?', default=None, const=process_filter['JupyterLab_backend'])
argument_parser.add_argument('-r', '--RStudio-backend-process-filter', nargs='?', default=None, const=process_filter['RStudio_backend'])
argument_parser.add_argument('-v', '--vreapi-process-filter', nargs='?', default=None, const=process_filter['vreapi'])
argument_parser.add_argument('-d', '--database-process-filter', nargs='?', default=None, const=process_filter['database'])
argument_parser.add_argument('-i', '--interval', nargs=1, type=float)
mutually_exclusive_group_IPC = argument_parser.add_mutually_exclusive_group()
mutually_exclusive_group_IPC.add_argument('-I', '--IPC-channel', nargs=1)
mutually_exclusive_group_IPC.add_argument('-D', '--Detached', action='store_true')
argument_parser.add_argument('-c', '--console-output', action='store_true')
argument_parser.add_argument('-f', '--file-output', action='store_true')
argument_parser.add_argument('-l', '--log-filename-prefix', nargs=1, default=datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))

args = argument_parser.parse_args()
args_dict = vars(args)  # to iterate over the command-line args conveniently
logger.debug(pprint.pformat(args_dict))
for field, value in args_dict.items():
    if field.endswith('_process_filter'):
        process_group_name: str = field.removesuffix('_process_filter')
        if value is not None:
            process_filter[process_group_name] = value  # If this process filter is designated in command-line args, then override the defaults.
            process_group[process_group_name] = []
        else:
            del process_filter[process_group_name]  # If this process filter is absent, then delete the corresponding column in the output CPU/memory usage records [in CSV].

for proc in psutil.process_iter(['cmdline']):  # Scan the entire process list and pick up the processes to monitor
    if proc.info['cmdline'] is None:
        continue
    cmdline: str = ' '.join(proc.info['cmdline'])
    pathname: str = proc.info['cmdline'][0] if proc.info['cmdline'] else ''
    for field, value in process_filter.items():
        if field in process_group and re.search(value, cmdline):  # Match the command-line of the current process
            process_group[field].append(proc)
logger.debug(pprint.pformat(process_group))

default_sample_interval: float = args.interval[0] if args.interval is not None else 0.5
samples: asyncio.Queue[Performance_Sample] = asyncio.Queue()
aggregated_samples: asyncio.Queue[Aggregated_Performance_Sample] = asyncio.Queue()


async def sample(process_group: Process_Group, delay: float = default_sample_interval):
    try:
        sample_time = datetime.datetime.now()
        agg_sample: Aggregated_Performance_Sample = {'time': sample_time}
        logger.debug(f'Start sample {agg_sample["time"]}')
        for process_group_name, processes in process_group.items():
            CPU_usage: float = 0
            memory_usage: int = 0
            for process in processes:
                try:
                    with process.oneshot():
                        if args.file_output:
                            await samples.put(Performance_Sample(sample_time, process.pid, process.username(), process.name(), ' '.join(process.cmdline()), process.cpu_percent(), process.memory_info().rss))
                        CPU_usage += process.cpu_percent()
                        memory_usage += process.memory_info().rss
                except psutil.NoSuchProcess:
                    pass
            agg_sample[process_group_name] = Performance_Index(CPU_usage, memory_usage)
        await aggregated_samples.put(agg_sample)
        logger.debug(f'End sample {agg_sample["time"]}')
        logger.debug(f'Raw sample queue length: {samples.qsize()}')
        logger.debug(f'Aggregated sample queue length: {aggregated_samples.qsize()}')
        await asyncio.sleep(max(0, delay - (datetime.datetime.now() - agg_sample['time']).total_seconds()))
    except asyncio.CancelledError:
        raise


async def monitor(process_group: Process_Group, delay: float = default_sample_interval):
    while True:
        try:
            await sample(process_group, delay)
        except asyncio.CancelledError:
            raise


raw_log_file = None
cooked_log_file = None
if args.console_output:
    fmt = "{:<23}" + " {:>23}" * 2 * len(process_group)
    header = ['time']
    for process_group_name in process_group:
        header.append(f'CPU:{process_group_name}')
        header.append(f'mem:{process_group_name}')
if args.file_output:
    Path('.log').mkdir(parents=True, exist_ok=True)
    raw_log_file = open(f'.log/{args.log_filename_prefix[0]}.raw.csv', 'w')
    logger.warning(f'Raw log file: {raw_log_file.name}')
    cooked_log_file = open(f'.log/{args.log_filename_prefix[0]}.cooked.csv', 'w')
    logger.warning(f'Cooked log file: {cooked_log_file.name}')
    CSV_file_writer_raw = csv.writer(raw_log_file)
    CSV_file_writer_cooked = csv.writer(cooked_log_file)


async def output_cooked_row(agg_sample: Aggregated_Performance_Sample):
    entry: list = [agg_sample['time'].strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]]
    for process_group_name in process_group:
        pf_idx: Performance_Index = agg_sample[process_group_name]
        entry.append(pf_idx.CPU_usage)
        entry.append(pf_idx.memory_usage / 1024 / 1024)  # B -> Mi
        for idx in range(1, len(entry)):
            entry[idx] = round(entry[idx], 3)
    if args.console_output:
        print(fmt.format(*entry))
    if args.file_output:
        CSV_file_writer_cooked.writerow(entry)


async def process_cooked():
    try:
        if args.console_output:
            print(fmt.format(*header))
        if args.file_output:
            CSV_header_cooked: list[str] = ['time']
            for process_group_name in process_group:
                CSV_header_cooked.extend([f'CPU:{process_group_name} (%)', f'mem:{process_group_name} (Mi)'])
            CSV_file_writer_cooked.writerow(CSV_header_cooked)
        while True:
            logger.debug('Start process [cooked]')
            agg_sample: Aggregated_Performance_Sample = await aggregated_samples.get()
            await output_cooked_row(agg_sample)
            logger.debug('End process [cooked]')
    except asyncio.CancelledError:
        if cooked_log_file is not None:
            cooked_log_file.close()
            logger.warning(f'Cooked log file {cooked_log_file.name} closed')
        raise


async def process_raw():
    try:
        if args.file_output:
            CSV_header_raw = Performance_Sample._fields
            CSV_file_writer_raw.writerow(CSV_header_raw)
            while True:
                logger.debug('Start process [raw]')
                row = await samples.get()
                CSV_file_writer_raw.writerow(row)
                logger.debug('End process [raw]')
        pass
    except asyncio.CancelledError:
        if raw_log_file is not None:
            raw_log_file.close()
            logger.warning(f'Raw log file {raw_log_file.name} closed')
        raise


class ByteEnum(bytes, Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return bytes([count + 1])


class Control_Code(ByteEnum):
    monitor_ready = auto()
    query_monitor_start = auto()
    monitor_started = auto()
    query_monitor_stop = auto()
    monitor_stopped = auto()


async def daemon():
    producer: Task | None = None
    consumer_raw: Task | None = None
    consumer_cooked: Task | None = None
    try:
        match sys.platform:
            case 'linux':
                if args.IPC_channel is not None:
                    control_channel = args.IPC_channel[0]  # Passing a list to asyncio.open_unix_connection won't connect to the designated socket
                    logger.info(f'Domain Socket: {control_channel}')
                    control_channel_reader, control_channel_writer = await asyncio.open_unix_connection(control_channel)
                    logger.info(f'Socket connected')
                    control_channel_writer.write(Control_Code.monitor_ready)
                    while True:
                        byte = await control_channel_reader.read(1)
                        match byte:
                            case Control_Code.query_monitor_start.value:
                                producer = asyncio.create_task(monitor(process_group, default_sample_interval))
                                consumer_raw = asyncio.create_task(process_raw())
                                consumer_cooked = asyncio.create_task(process_cooked())
                                control_channel_writer.write(Control_Code.monitor_started)
                            case Control_Code.query_monitor_stop.value:
                                logger.warning(f'Received Control_Code.{Control_Code.query_monitor_stop.name}')
                                if producer is not None:
                                    producer.cancel()
                                if consumer_raw is not None:
                                    consumer_raw.cancel()
                                if consumer_cooked is not None:
                                    consumer_cooked.cancel()
                                raise asyncio.CancelledError()
                            case _:
                                logger.warning(f'Unsupported control code: {byte[0]}')
                else:
                    producer = asyncio.create_task(monitor(process_group, default_sample_interval))
                    consumer_raw = asyncio.create_task(process_raw())
                    consumer_cooked = asyncio.create_task(process_cooked())
            case _:
                raise RuntimeError(f'Unsupported operating system: {sys.platform}')
    except asyncio.CancelledError:
        logger.warning('Cleaning')
        if producer is not None:
            try:
                await producer
            except asyncio.CancelledError:
                logger.warning(f'producer `monitor` cancelled')
        if consumer_raw is not None:
            try:
                await consumer_raw
            except asyncio.CancelledError:
                logger.warning(f'consumer `process_raw` cancelled')
        if consumer_cooked is not None:
            try:
                await consumer_cooked
            except asyncio.CancelledError:
                logger.warning(f'consumer `process_cooked` cancelled')
        if control_channel_writer is not None:
            logger.warning(f'Sending Control_Code.{Control_Code.monitor_stopped.name}')
            control_channel_writer.write(Control_Code.monitor_stopped)
            control_channel_writer.close()
            await control_channel_writer.wait_closed()
        logger.warning('Cleaned')
        sys.exit(0)


async def main():
    event_loop = asyncio.get_event_loop()
    stop = event_loop.create_future()
    event_loop.add_signal_handler(signal.SIGINT, stop.set_result, None)
    await sample(process_group, default_sample_interval)
    await aggregated_samples.get()
    daemon_coro = asyncio.create_task(daemon())
    try:
        await daemon_coro
    except SystemExit as e:
        if e.code == 0:
            sys.exit(0)
        else:
            raise e
    await stop
    logger.warning(f'Received Ctrl-C or Control_Code.{Control_Code.monitor_stopped.name}')


if __name__ == '__main__':
    asyncio.run(main())
