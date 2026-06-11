"""
Can run with venv of vreapis
"""
import asyncio
import pprint
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
logger.addHandler(default_console_handler)  # omitting this handler won't let the logger log normally

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
    memory_usage: int


Aggregated_Performance_Sample: TypeAlias = dict[str, float | timedelta | Performance_Index]  # Keys may be process group names and shared property values [i.e. time]
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
argument_parser.add_argument('-l', '--log-filename-prefix', nargs='?', default=None, const=datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))

args = argument_parser.parse_args()
args_dict = vars(args)  # to iterate over the command-line args conveniently
logger.debug(pprint.pformat(args_dict))
for field, value in args_dict.items():
    if field.endswith('_process_filter'):
        process_group_name: str = field.removesuffix('_process_filter')
        if value is not None:
            process_filter[process_group_name] = value  # If process filters are designated in command-line args, then override the defaults.
            process_group[process_group_name] = []
        else:
            del process_filter[process_group_name]

for proc in psutil.process_iter(['pid', 'username', 'name', 'cpu_percent', 'memory_info']):  # Scan the entire process list and pick up the processes to monitor
    with proc.oneshot():
        cmdline: str = ' '.join(proc.cmdline())
        pathname: str = proc.cmdline()[0] if proc.cmdline() else ''
        for field, value in process_filter.items():
            if field in process_group and re.search(value, cmdline):  # Match the command-line of the current process
                process_group[field].append(proc)
logger.debug(pprint.pformat(process_group))

default_sample_interval: float = args.interval[0] if args.interval is not None else 0.5
aggregated_samples: asyncio.Queue[Aggregated_Performance_Sample] = asyncio.Queue()


async def sample(process_group: Process_Group, delay: float = default_sample_interval):
    try:
        agg_sample: Aggregated_Performance_Sample = {'time': datetime.datetime.now()}
        logger.debug(f'Start sample {agg_sample["time"]}')
        for process_group_name, processes in process_group.items():
            CPU_usage: float = 0
            memory_usage: int = 0
            for process in processes:
                try:
                    with process.oneshot():
                        CPU_usage += process.cpu_percent()
                        memory_usage += process.memory_info().rss
                except psutil.NoSuchProcess:
                    pass
            agg_sample[process_group_name] = Performance_Index(CPU_usage, memory_usage)
        await aggregated_samples.put(agg_sample)
        logger.debug(f'End sample {agg_sample["time"]}')
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


if args.console_output:
    fmt = "{:<23}" + " {:>23}" * 2 * len(process_group)
    header = ['time']
    for process_group_name in process_group:
        header.append(f'CPU:{process_group_name}')
        header.append(f'mem:{process_group_name}')
if args.file_output:
    Path('.log').mkdir(parents=True, exist_ok=True)
    CPU_log_file = open(f'{args.log_filename_prefix}.CPU.csv', 'w')
    mem_log_file = open(f'{args.log_filename_prefix}.mem.csv', 'w')
    cooked_log_file = open(f'{args.log_filename_prefix}.cooked.csv', 'w')
    CSV_file_writer_CPU = csv.writer(CPU_log_file)
    CSV_file_writer_mem = csv.writer(mem_log_file)
    CSV_file_writer_cooked = csv.writer(cooked_log_file)


async def output(agg_sample: Aggregated_Performance_Sample):
    line: list = [agg_sample['time']]
    for process_group_name in process_group:
        index: Performance_Index = agg_sample[process_group_name]
        line.append(index.CPU_usage)
        line.append(index.memory_usage / 1024 / 1024)  # B -> Mi
    if args.console_output:
        line[0] = line[0].strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        for index in range(1, len(line)):
            line[index] = round(line[index], 3)
        print(fmt.format(*line))
    if args.file_output:
        raise  # TODO


async def process():
    try:
        if args.console_output:
            print(fmt.format(*header))
        if args.file_output:
            CSV_header_CPU: list[str] = ['time']
            CSV_header_mem: list[str] = ['time']
            CSV_header_cooked: list[str] = ['time']
            for process_group_name in process_group:
                CSV_header_CPU.append(process_group_name)
                CSV_header_mem.append(process_group_name)
                CSV_header_cooked.extend([f'CPU:{process_group_name}', f'mem:{process_group_name}'])
            # TODO
        while True:
            logger.debug('Start process')
            agg_sample: Aggregated_Performance_Sample = await aggregated_samples.get()
            # logger.info(pprint.pformat(agg_sample))
            await output(agg_sample)
            logger.debug('End process')
    except asyncio.CancelledError:
        raise  # TODO


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
    producer = None
    consumer = None
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
                                consumer = asyncio.create_task(process())
                                control_channel_writer.write(Control_Code.monitor_started)
                                # pass  # TODO
                            case Control_Code.query_monitor_stop.value:
                                logger.warning(f'Received Control_Code.{Control_Code.query_monitor_stop.name}')
                                if producer is not None:
                                    producer.cancel()
                                if consumer is not None:
                                    consumer.cancel()
                                raise asyncio.CancelledError()
                                # pass  # TODO
                            case _:
                                logger.warning(f'Unsupported control code: {byte[0]}')
                else:
                    producer = asyncio.create_task(monitor(process_group, default_sample_interval))
                    consumer = asyncio.create_task(process())
            case _:
                raise RuntimeError(f'Unsupported operating system: {sys.platform}')
    except asyncio.CancelledError:
        logger.warning('Cleaning')
        if producer is not None:
            try:
                await producer
            except asyncio.CancelledError:
                logger.warning(f'producer `monitor` cancelled')
        if consumer is not None:
            try:
                await consumer
            except asyncio.CancelledError:
                logger.warning(f'consumer `process` cancelled')
        if control_channel_writer is not None:
            logger.warning(f'Sending Control_Code.{Control_Code.monitor_stopped.name}')
            control_channel_writer.write(Control_Code.monitor_stopped)
            control_channel_writer.close()
            await control_channel_writer.wait_closed()
        logger.warning('Cleaned')
        sys.exit(0)
        # TODO


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
