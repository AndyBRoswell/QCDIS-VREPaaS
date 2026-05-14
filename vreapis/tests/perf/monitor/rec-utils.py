"""
Can run with venv of vreapis
"""

import psutil
import re
import argparse
from types import SimpleNamespace

process_filter = SimpleNamespace(
    chrome='.*/chrom.*',
    JupyterLab_backend='jupyter.?lab',
    RStudio_backend='rstudio-server',
    RSession='',  # TODO
    vreapi='runserver',
    database='postgres',
)

argument_parser = argparse.ArgumentParser()
argument_parser.add_argument('-b', '--browser-process-filter', nargs='?', default=None, const=process_filter.chrome)
argument_parser.add_argument('-j', '--jupyter-lab-backend-process-filter', action='store_true')
argument_parser.add_argument('-r', '--rstudio-backend-process-filter', action='store_true')
argument_parser.add_argument('-v', '--vreapi-backend-process-filter', nargs='?', default=None, const=process_filter.vreapi)
argument_parser.add_argument('-d', '--database-process-filter', nargs='?', default=None, const=process_filter.database)

args = argument_parser.parse_args()

