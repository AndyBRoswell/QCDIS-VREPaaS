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

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
default_console_handler = logging.StreamHandler()
default_console_handler.setLevel(logging.INFO)
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


class Aggregated_Performance_Sample(NamedTuple):
    time: object
    chrome: Performance_Index
    JupyterLab_backend: Performance_Index
    RStudio_backend: Performance_Index
    RSession: Performance_Index
    vreapi: Performance_Index
    database: Performance_Index

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

async def monitor(process_group: Process_Group, interval: float = 0.5):
    pass