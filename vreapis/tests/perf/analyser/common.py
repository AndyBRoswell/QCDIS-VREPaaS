import re
import sys
import pathlib
import logging
import pandas

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='[%(asctime)s.%(msecs)03d] [%(levelname)s] [%(name)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S')  # Default logger level: info

RE_flags = re.IGNORECASE

source_dir = pathlib.Path('.log')

pandas.set_option('display.max_columns', None)
pandas.set_option('display.max_rows', None)
pandas.set_option('display.width', None)
pandas.set_option('display.max_colwidth', None)