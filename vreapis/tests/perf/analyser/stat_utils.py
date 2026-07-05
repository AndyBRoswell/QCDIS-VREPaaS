import os
import logging
import pathlib
import re
import pandas
import numpy
from collections import namedtuple
import itertools
import common

supported_platforms: list[str] = ['lab.original', 'lab.vreapi', 'rstudio']
RE_platform_suffix: re.Pattern[str] = re.compile('|'.join(re.escape(platform) for platform in supported_platforms) + '$', common.RE_flags)

export_dir = pathlib.Path('export/util')

pathname_prefices: list[str] = []
ave_columns: list[str] = []

for prefix in ['ave:CPU:', 'ave:mem:']:
    for platform in supported_platforms:
        ave_columns.append(f'{prefix}{platform}')

logging.info('Start statisticization')
File_Info = namedtuple('File_Info', ['pathname_prefix', 'platform'])
file_info: dict[str, File_Info] = {}
for csv_pathname in common.source_dir.rglob('*.util.cooked.csv'):
    csv_pathname_str = str(csv_pathname)
    pathname_prefix_with_platform_suffix: str = csv_pathname_str[len(str(common.source_dir) + os.pathsep):len(csv_pathname_str) - len('.util.cooked.csv')]
    platform_match: re.Match | None = RE_platform_suffix.search(pathname_prefix_with_platform_suffix)
    if not platform_match:
        logging.warning(f"Skipped CSV pathname with unsupported platform suffix: {csv_pathname}")
        continue
    platform: str = platform_match.group(0)
    pathname_prefix: str = pathname_prefix_with_platform_suffix[:platform_match.start() - len('.')]
    pathname_prefices.append(pathname_prefix)
    file_info[csv_pathname_str] = File_Info(pathname_prefix, platform)
pathname_prefices = list(dict.fromkeys(pathname_prefices))  # keep insertion order

placeholders = numpy.full((len(pathname_prefices), len(ave_columns)), numpy.nan, dtype=numpy.float64)
ave = pandas.DataFrame(placeholders, index=pathname_prefices, columns=ave_columns)

for csv_pathname in common.source_dir.rglob('*.util.cooked.csv'):
    csv_pathname_str = str(csv_pathname)
    table: pandas.DataFrame = pandas.read_csv(csv_pathname)
    CPU_column_names: list[str] = []
    mem_column_names: list[str] = []
    for col in table.columns:
        match col[0:len('xxx:')]:
            case 'CPU:':
                CPU_column_names.append(col)
            case 'mem:':
                mem_column_names.append(col)
            case _:
                continue
    ave_CPU_usage = table[CPU_column_names].mean().sum()  # Average CPU usage across all processes and all time points
    ave_mem_usage = table[mem_column_names].mean().sum()
    ave.at[file_info[csv_pathname_str].pathname_prefix, f'ave:CPU:{file_info[csv_pathname_str].platform}'] = ave_CPU_usage
    ave.at[file_info[csv_pathname_str].pathname_prefix, f'ave:mem:{file_info[csv_pathname_str].platform}'] = ave_mem_usage

print('Average CPU and memory usage by test cases: ')
print(ave.round(1))

diff_columns: list[str] = []
for item in itertools.combinations(supported_platforms, 2):
    for prefix in ['ave CPU: ', 'ave mem: ']:
        diff_columns.append(f'{prefix}{item[1]} v. {item[0]}')

placeholders = numpy.full((len(pathname_prefices), len(diff_columns)), numpy.nan, dtype=numpy.float64)
diff = pandas.DataFrame(placeholders, index=pathname_prefices, columns=diff_columns)

for pathname_prefix in pathname_prefices:
    for item in itertools.combinations(enumerate(supported_platforms), 2):
        first_platform: str = item[0][1]
        second_platform: str = item[1][1]
        target_column_name_CPU: str = f'ave CPU: {second_platform} v. {first_platform}'
        target_column_name_mem: str = f'ave mem: {second_platform} v. {first_platform}'
        diff_rate_CPU: float = (
                                       ave.at[pathname_prefix, f'ave:CPU:{second_platform}']
                                       - ave.at[pathname_prefix, f'ave:CPU:{first_platform}']
                               ) / ave.at[pathname_prefix, f'ave:CPU:{first_platform}'] * 100  # pyright: ignore[reportOperatorIssue, reportAssignmentType]
        diff_rate_mem: float = (
                                       ave.at[pathname_prefix, f'ave:mem:{second_platform}']
                                       - ave.at[pathname_prefix, f'ave:mem:{first_platform}']
                               ) / ave.at[pathname_prefix, f'ave:mem:{first_platform}'] * 100  # pyright: ignore[reportOperatorIssue, reportAssignmentType]
        diff.at[pathname_prefix, target_column_name_CPU] = diff_rate_CPU
        diff.at[pathname_prefix, target_column_name_mem] = diff_rate_mem

print('Differences of CPU and memory usage by test cases: (In %)')
print(diff.round(1))
