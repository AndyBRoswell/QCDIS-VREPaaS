import json
import pathlib
import logging
import numpy
import pandas
import common

export_dir = pathlib.Path('export/time')

notebook_test_args: dict[str, list[dict[str, list[str] | dict[str, dict[str, str] | str]]]] = json.load(open('notebook_test_args.json', 'r'))

logging.info('Start statisticization')

rows_of_cell_level_records: int = 0
repetition_count: int = 10
index_column_names: list[str] = ['pathname_prefix', 'platform', 'cell', 'action']
cell_level_stats_column_names: list[str] = ['min', 'med', 'max']
index_tuples: list[tuple[str, str, int | str, str]] = []
for pathname_prefix, cell_level_args in notebook_test_args.items():
    for platform in common.supported_platforms:
        for index, args in enumerate(cell_level_args):
            for action in args['actions']:
                rows_of_cell_level_records += 1
                index_tuples.append((pathname_prefix, platform, index, action))
multi_index = pandas.MultiIndex.from_tuples(index_tuples, names=index_column_names)

placeholders = numpy.full((rows_of_cell_level_records, repetition_count), numpy.nan, dtype=numpy.float64)
cell_level_records = pandas.DataFrame(placeholders, index=multi_index, columns=[f't{i}' for i in range(0, repetition_count)])

placeholders = numpy.full((rows_of_cell_level_records, len(cell_level_stats_column_names)), numpy.nan, dtype=numpy.float64)
cell_level_stats = pandas.DataFrame(placeholders, index=multi_index, columns=cell_level_stats_column_names)

target_file_extension: str = '.con.log'
for log_pathname in common.source_dir.glob(f'*{target_file_extension}'):
    pathname_prefix, platform = common.get_pathname_prefix_and_platform_suffix(log_pathname, target_file_extension)
    cell_level_args: list[dict[str, list[str] | dict[str, dict[str, str] | str]]] = notebook_test_args[pathname_prefix]
    match platform:
        case lab if lab.startswith('lab.'):

            pass
        case 'rstudio':
            pass
        case _:
            logging.warning(f"Skipped log pathname with unsupported platform suffix: {log_pathname}")
            continue


print('Original records:')
# noinspection PyStringConversionWithoutDunderMethod
print(cell_level_records)

print('Cell-level statistics:')
# noinspection PyStringConversionWithoutDunderMethod
print(cell_level_stats)
