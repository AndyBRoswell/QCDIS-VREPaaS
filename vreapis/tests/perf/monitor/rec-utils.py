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
from datetime import datetime
import time
from enum import Enum, auto
import sys
import os
from multiprocessing.connection import Listener
import tempfile

log_level = logging.INFO
logger = logging.getLogger(__name__)
logger.setLevel(log_level)
default_console_handler = logging.StreamHandler()
default_console_handler.setLevel(log_level)
logger.addHandler(default_console_handler)

common_re_flags = re.IGNORECASE

process_filter: dict[str, str] = {
    'chrome': r'.*/chrom.*',
    'JupyterLab_backend': r'jupyter.?lab',
    'RStudio_backend': r'rstudio-server',
    # 'RSession': '',  # TODO
    'vreapi': r'.*/bin/python\s+.*/VREPaaS/vreapis/manage.py\s+runserver',
    'database': r'postgres',
}


class Performance_Index(NamedTuple):
    CPU_usage: float
    memory_usage: int


Aggregated_Performance_Sample: TypeAlias = dict[str, float | Performance_Index]
Process_Group: TypeAlias = dict[str, list[psutil.Process]]

process_group: Process_Group = {}

argument_parser = argparse.ArgumentParser()
argument_parser.add_argument('-b', '--browser-process-filter', nargs='?', default=None, const=process_filter['chrome'])
argument_parser.add_argument('-j', '--JupyterLab-backend-process-filter', nargs='?', default=None, const=process_filter['JupyterLab_backend'])
argument_parser.add_argument('-r', '--RStudio-backend-process-filter', nargs='?', default=None, const=process_filter['RStudio_backend'])
argument_parser.add_argument('-v', '--vreapi-process-filter', nargs='?', default=None, const=process_filter['vreapi'])
argument_parser.add_argument('-d', '--database-process-filter', nargs='?', default=None, const=process_filter['database'])
argument_parser.add_argument('-i', '--IPC-channel', nargs=1)

args_dict = vars(argument_parser.parse_args())
logger.debug(pprint.pformat(args_dict))
for field, value in args_dict.items():
    if field.endswith('_process_filter'):
        process_group_name: str = field.removesuffix('_process_filter')
        if value is not None:
            process_filter[process_group_name] = value
            process_group[process_group_name] = []
        else:
            del process_filter[process_group_name]

timestamp = datetime.now()
for proc in psutil.process_iter(['pid', 'username', 'name', 'cpu_percent', 'memory_info']):
    with proc.oneshot():
        cmdline: str = ' '.join(proc.cmdline())
        pathname: str = proc.cmdline()[0] if proc.cmdline() else ''
        for field, value in process_filter.items():
            if field in process_group and re.search(value, cmdline):
                process_group[field].append(proc)

logger.info(pprint.pformat(process_group))

samples: asyncio.Queue[Aggregated_Performance_Sample] = asyncio.Queue()


async def sample(process_group: Process_Group, delay: float = 0.5):
    agg_sample: Aggregated_Performance_Sample = {'time': time.monotonic()}
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
    await samples.put(agg_sample)
    logger.debug(f'End sample {agg_sample["time"]}')
    logger.debug(f'Queue length: {samples.qsize()}')
    await asyncio.sleep(max(0, delay - (time.monotonic() - agg_sample['time'])))


async def monitor(process_group: Process_Group, delay: float = 0.5):
    while True:
        try:
            await sample(process_group, delay)
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass


async def process():
    while True:
        logger.debug('Start process')
        agg_sample: Aggregated_Performance_Sample = await samples.get()
        logger.info(pprint.pformat(agg_sample))
        logger.debug('End process')


class Control(Enum):
    monitor_ready = auto()
    query_monitor_start = auto()
    monitor_started = auto()
    query_monitor_stop = auto()


async def daemon():
    match sys.platform:
        case 'linux':
            channel = ''
            logger.info(f'Domain Socket: {channel}')
            with Listener(channel, family='AF_UNIX') as listener:
                with listener.accept() as connection:
                    pass
        case _:
            raise RuntimeError(f'Unsupported operating system: {sys.platform}')


async def main():
    await sample(process_group, 0.5)
    await samples.get()
    producer = asyncio.create_task(monitor(process_group, 0.5))
    consumer = asyncio.create_task(process())
    await asyncio.gather(producer, consumer)


if __name__ == '__main__':
    asyncio.run(main())
