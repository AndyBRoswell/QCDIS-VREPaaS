import logging
import pathlib
import pandas
import numpy
from collections import namedtuple
import itertools
import common

export_dir = pathlib.Path('export/util')

pathname_prefices: list[str] = []
ave_columns: list[str] = []

for prefix in ['ave:CPU:', 'ave:mem:']:
    for platform in common.supported_platforms:
        ave_columns.append(f'{prefix}{platform}')

logging.info('Start statisticization')
File_Info = namedtuple('File_Info', ['pathname_prefix', 'platform'])
file_info: dict[str, File_Info] = {}
target_file_extension: str = '.util.cooked.csv'
for csv_pathname in common.source_dir.rglob(f'*{target_file_extension}'):
    pathname_prefix, platform = common.get_pathname_prefix_and_platform_suffix(csv_pathname, target_file_extension)
    pathname_prefices.append(pathname_prefix)
    file_info[str(csv_pathname)] = File_Info(pathname_prefix, platform)
pathname_prefices = list(dict.fromkeys(pathname_prefices))  # keep insertion order

placeholders = numpy.full((len(pathname_prefices), len(ave_columns)), numpy.nan, dtype=numpy.float64)
ave = pandas.DataFrame(placeholders, index=pathname_prefices, columns=ave_columns)

for csv_pathname in common.source_dir.rglob(f'*{target_file_extension}'):
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
# noinspection PyStringConversionWithoutDunderMethod
print(ave.round(1))

diff_columns: list[str] = []
for item in itertools.combinations(common.supported_platforms, 2):
    for prefix in ['ave CPU: ', 'ave mem: ']:
        diff_columns.append(f'{prefix}{item[1]} v. {item[0]}')

placeholders = numpy.full((len(pathname_prefices), len(diff_columns)), numpy.nan, dtype=numpy.float64)
diff = pandas.DataFrame(placeholders, index=pathname_prefices, columns=diff_columns)

for pathname_prefix in pathname_prefices:
    for item in itertools.combinations(enumerate(common.supported_platforms), 2):
        first_platform: str = item[0][1]
        second_platform: str = item[1][1]
        target_column_name_CPU: str = f'ave CPU: {second_platform} v. {first_platform}'
        target_column_name_mem: str = f'ave mem: {second_platform} v. {first_platform}'
        # noinspection PyTypeChecker
        this_CPU_util: float = ave.at[pathname_prefix, f'ave:CPU:{second_platform}']  # pyright: ignore[reportAssignmentType]
        # noinspection PyTypeChecker
        ref_CPU_util: float = ave.at[pathname_prefix, f'ave:CPU:{first_platform}']  # pyright: ignore[reportAssignmentType]
        diff_rate_CPU: float = (this_CPU_util - ref_CPU_util) / ref_CPU_util * 100  # pyright: ignore[reportAssignmentType]
        # noinspection PyTypeChecker
        this_mem_util: float = ave.at[pathname_prefix, f'ave:mem:{second_platform}']  # pyright: ignore[reportAssignmentType]
        # noinspection PyTypeChecker
        ref_mem_util: float = ave.at[pathname_prefix, f'ave:mem:{first_platform}']  # pyright: ignore[reportAssignmentType]
        diff_rate_mem: float = (this_mem_util - ref_mem_util) / ref_mem_util * 100  # pyright: ignore[reportAssignmentType]
        diff.at[pathname_prefix, target_column_name_CPU] = diff_rate_CPU
        diff.at[pathname_prefix, target_column_name_mem] = diff_rate_mem

print('Differences of CPU and memory usage by test cases: (In %)')
# noinspection PyStringConversionWithoutDunderMethod
print(diff.round(1))
