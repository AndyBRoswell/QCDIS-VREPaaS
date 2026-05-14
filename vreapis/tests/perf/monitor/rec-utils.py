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


class Process_Filter(NamedTuple):
    chrome: re.Pattern[str] = re.compile('.*/chrom.*', common_re_flags)
    JupyterLab_backend: re.Pattern[str] = re.compile('jupyter.?lab', common_re_flags)
    RStudio_backend: re.Pattern[str] = re.compile('rstudio-server', common_re_flags)
    RSession: re.Pattern[str] = ''  # TODO
    vreapi: re.Pattern[str] = re.compile('runserver', common_re_flags)
    database: re.Pattern[str] = re.compile('postgres', common_re_flags)


process_filter = Process_Filter()


class Simple_Performance_Index(NamedTuple):
    CPU_usage: float
    memory_usage: int


class Aggregated_Performance_Record(NamedTuple):
    chrome: Simple_Performance_Index
    JupyterLab_backend: Simple_Performance_Index
    RStudio_backend: Simple_Performance_Index
    RSession: Simple_Performance_Index
    vreapi: Simple_Performance_Index
    database: Simple_Performance_Index


class Process_Information(NamedTuple):
    time: object
    pathname: str
    name: str
    user: str
    PID: int
    CPU_usage: float
    memory_usage: int


argument_parser = argparse.ArgumentParser()
argument_parser.add_argument('-b', '--browser-process-filter', nargs='?', default=None, const=process_filter.chrome)
argument_parser.add_argument('-j', '--JupyterLab-backend-process-filter', action='store_true')
argument_parser.add_argument('-r', '--RStudio-backend-process-filter', action='store_true')
argument_parser.add_argument('-v', '--vreapi-process-filter', nargs='?', default=None, const=process_filter.vreapi)
argument_parser.add_argument('-d', '--database-process-filter', nargs='?', default=None, const=process_filter.database)

args = argument_parser.parse_args()

process_information = set()
timestamp = datetime.now()
for proc in psutil.process_iter(['pid', 'username', 'name', 'cpu_percent', 'memory_info']):
    pathname: str = proc.cmdline()[0] if proc.cmdline() else ''
    if args.browser_process_filter:
        if (
                re.search(process_filter.chrome, pathname)
                or re.search(process_filter.JupyterLab_backend, pathname)
                or re.search(process_filter.RStudio_backend, pathname)
                # TODO
                or re.search(process_filter.vreapi, pathname)
                or re.search(process_filter.database, pathname)
        ):
            process_information.add(Process_Information(timestamp, pathname, proc.name(), proc.username(), proc.pid, proc.cpu_percent(), proc.memory_info().rss))
            # children = proc.children(recursive=True)
            # for child in children:
            #     process_information.add(Process_Information(timestamp, pathname, child.name(), child.username(), child.pid, child.cpu_percent(), child.memory_info().rss))

logger.info(pprint.pformat(process_information))
