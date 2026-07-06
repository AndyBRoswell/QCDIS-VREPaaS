import os
import re
import sys
import pathlib
import logging
import pandas

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='[%(asctime)s.%(msecs)03d] [%(levelname)s] [%(name)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S')  # Default logger level: info

RE_flags = re.IGNORECASE

supported_platforms: list[str] = ['lab.original', 'lab.vreapi', 'rstudio']
RE_platform_suffix: re.Pattern[str] = re.compile('|'.join(re.escape(platform) for platform in supported_platforms) + '$', RE_flags)

source_dir = pathlib.Path('.log')

pandas.set_option('display.max_columns', None)
pandas.set_option('display.max_rows', None)
pandas.set_option('display.width', None)
pandas.set_option('display.max_colwidth', None)

def get_pathname_prefix_and_platform_suffix(pathname: pathlib.Path, file_extension: str) -> tuple[str, str]:
    pathnamr_str: str = str(pathname)
    pathname_prefix_with_platform_suffix: str = pathnamr_str[len(str(source_dir) + os.pathsep):len(pathnamr_str) - len(file_extension)]
    platform_match: re.Match | None = RE_platform_suffix.search(pathname_prefix_with_platform_suffix)
    if not platform_match:
        logging.warning(f"Skipped CSV pathname with unsupported platform suffix: {pathname}")
        return '', ''
    platform: str = platform_match.group(0)
    pathname_prefix: str = pathname_prefix_with_platform_suffix[:platform_match.start() - len('.')]
    return pathname_prefix, platform