import re
import sys
import pathlib
import logging

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='[%(asctime)s.%(msecs)03d] [%(levelname)s] [%(name)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S')  # Default logger level: info

RE_flags = re.IGNORECASE

source_dir = pathlib.Path('.log')
