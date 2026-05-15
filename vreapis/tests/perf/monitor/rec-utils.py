"""
Can run with venv of vreapis
"""

import pprint
import psutil
import re
import argparse
import logging
from typing import NamedTuple
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


class Simple_Performance_Index(NamedTuple):
    CPU_usage: float
    memory_usage: int


class Aggregated_Performance_Record(NamedTuple):
    time: object
    chrome: Simple_Performance_Index
    JupyterLab_backend: Simple_Performance_Index
    RStudio_backend: Simple_Performance_Index
    RSession: Simple_Performance_Index
    vreapi: Simple_Performance_Index
    database: Simple_Performance_Index


class Process_Information(NamedTuple):
    pathname: str
    name: str
    user: str
    PID: int
    CPU_usage: float
    memory_usage: int


process_group: dict[str, list[Process_Information]] = {
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
                process_group[field].append(Process_Information(pathname, proc.name(), proc.username(), proc.pid, proc.cpu_percent(), proc.memory_info().rss))

logger.info(pprint.pformat(process_group))
