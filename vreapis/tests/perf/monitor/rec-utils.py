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

log_level = logging.INFO
logger = logging.getLogger(__name__)
logger.setLevel(log_level)
default_console_handler = logging.StreamHandler()
default_console_handler.setLevel(log_level)
logger.addHandler(default_console_handler)

common_re_flags = re.IGNORECASE

process_filter: dict[str, re.Pattern[str] | str] = {
    'chrome': re.compile(r'.*/chrom.*', common_re_flags),
    'JupyterLab_backend': re.compile(r'jupyter.?lab', common_re_flags),
    'RStudio_backend': re.compile(r'rstudio-server', common_re_flags),
    # 'RSession': '',  # TODO
    'vreapi': re.compile(r'.*/bin/python\s+.*/VREPaaS/vreapis/manage.py\s+runserver', common_re_flags),
    'database': re.compile(r'postgres', common_re_flags)
}


class Performance_Index(NamedTuple):
    CPU_usage: float
    memory_usage: int


Aggregated_Performance_Sample: TypeAlias = dict[str, float | Performance_Index]
Process_Group: TypeAlias = dict[str, list[psutil.Process]]

process_group: Process_Group = {
    'chrome': [],
    'JupyterLab_backend': [],
    'RStudio_backend': [],
    'RSession': [],
    'vreapi': [],
    'database': [],
}

argument_parser = argparse.ArgumentParser()
argument_parser.add_argument('-b', '--browser-process-filter', nargs='?', default=None, const=process_filter['chrome'])
argument_parser.add_argument('-j', '--JupyterLab-backend-process-filter', action='store_true')
argument_parser.add_argument('-r', '--RStudio-backend-process-filter', action='store_true')
argument_parser.add_argument('-v', '--vreapi-process-filter', nargs='?', default=None, const=process_filter['vreapi'])
argument_parser.add_argument('-d', '--database-process-filter', nargs='?', default=None, const=process_filter['database'])

args = argument_parser.parse_args()

timestamp = datetime.now()
for proc in psutil.process_iter(['pid', 'username', 'name', 'cpu_percent', 'memory_info']):
    with proc.oneshot():
        cmdline: str = ' '.join(proc.cmdline())
        pathname: str = proc.cmdline()[0] if proc.cmdline() else ''
        for field, value in process_filter.items():
            if re.search(value, cmdline):
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
            with process.oneshot():
                CPU_usage += process.cpu_percent()
                memory_usage += process.memory_info().rss
        agg_sample[process_group_name] = Performance_Index(CPU_usage, memory_usage)
    await samples.put(agg_sample)
    logger.debug(f'End sample {agg_sample["time"]}')
    logger.debug(f'Queue length: {samples.qsize()}')
    await asyncio.sleep(max(0, delay - (time.monotonic() - agg_sample['time'])))


async def monitor(process_group: Process_Group, delay: float = 0.5):
    while True:
        await sample(process_group, delay)


async def process():
    while True:
        logger.debug('Start process')
        agg_sample: Aggregated_Performance_Sample = await samples.get()
        logger.info(pprint.pformat(agg_sample))
        logger.debug('End process')


async def main():
    await sample(process_group, 0.5)
    await samples.get()
    producer = asyncio.create_task(monitor(process_group, 0.5))
    consumer = asyncio.create_task(process())
    await asyncio.gather(producer, consumer)


if __name__ == '__main__':
    asyncio.run(main())
