import itertools
import json
import re
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
stats_column_names: list[str] = ['trunc_min', 'med', 'trunc_max']
index_tuples: list[tuple[str, str, int | str, str]] = []

_notebook_test_args = {}
for original_pathname_prefix, cell_level_args in notebook_test_args.items():  # normalize the pathsep
    pathname_prefix = str(pathlib.Path(original_pathname_prefix))
    _notebook_test_args[pathname_prefix] = cell_level_args
notebook_test_args = _notebook_test_args
_notebook_test_args = None

for pathname_prefix, cell_level_args in notebook_test_args.items():
    for platform in common.supported_platforms:
        for index, args in enumerate(cell_level_args):
            for actual_action in args['actions']:
                rows_of_cell_level_records += 1
                index_tuples.append((pathname_prefix, platform, index, actual_action))
cell_level_multi_index = pandas.MultiIndex.from_tuples(index_tuples, names=index_column_names)

placeholders = numpy.full((rows_of_cell_level_records, repetition_count), numpy.nan, dtype=numpy.float64)
cell_level_records = pandas.DataFrame(placeholders, index=cell_level_multi_index, columns=[f't{i}' for i in range(0, repetition_count)])

target_file_extension: str = '.con.log'
RE_log_lab = re.compile(r'(\b.+\b)\s+done in (\d+(\.\d+)?)\s*ms$', common.RE_flags)
RE_log_rstudio = re.compile(r'^Execution duration of function (\b.+\b)', common.RE_flags)
RE_log_rstudio_time = re.compile(r'^\s*(\d+(\.\d+)?)\s+(\d+(\.\d+)?)\s+(\d+(\.\d+)?)\s*$', common.RE_flags)
for log_pathname in common.source_dir.rglob(f'*{target_file_extension}'):
    pathname_prefix, platform = common.get_pathname_prefix_and_platform_suffix(log_pathname, target_file_extension)
    cell_level_args: list[dict[str, list[str] | dict[str, dict[str, str] | str]]] = notebook_test_args[pathname_prefix]
    cell_count = len(cell_level_args)
    total_action_count_of_each_repetition: int = len([action for args in cell_level_args for action in args['actions']])
    match platform:
        case lab if lab.startswith('lab.'):
            total_log_line_count_of_each_repetition: int = total_action_count_of_each_repetition + 1 * cell_count  # plus 1 line of ignored log of `loadBaseImage` per cell
            with open(log_pathname) as log_file:
                line = log_file.read().splitlines()
                l = 0
                for repetition in range(0, repetition_count):
                    for c in range(0, cell_count):
                        l += 1  # skip the ignored `loadBaseImages`
                        cell_no = (c + 1) % cell_count  # The original implementation of NaaVRE Cell Containerizer only detects changes of selected cell. When an ipynb file is open and the 0th cell is automatically selected, extraction won't be triggered. So the test begins at 1st cell and finally test 0th cell.
                        for expected_action in cell_level_args[cell_no]['actions']:
                            function_match: re.Match[str] | None = RE_log_lab.search(line[l])  # check the log format
                            if not function_match:
                                logging.critical(f"Log line with unsupported format at line {l}: {line[l]}")
                                raise Exception(f"Terminated to prevent incorrect results.")
                            expected_function: str
                            actual_function: str = function_match.group(1)
                            time: float = float(function_match.group(2))
                            match expected_action:
                                case 'extract':
                                    expected_function = 'extractor'
                                case 'create':
                                    expected_function = 'createCell'
                                case _:
                                    logging.critical(f'Unknown expected_action {expected_action}')
                                    raise Exception(f"Terminated to prevent incorrect results.")
                            if expected_function != actual_function:
                                logging.critical(f"Expected function: {expected_function}. Actual function at line {l}: {actual_function}")
                                raise Exception(f"Terminated to prevent incorrect results.")
                            cell_level_records.at[(pathname_prefix, platform, cell_no, expected_action), f't{repetition}'] = time / 1000  # ms -> s
                            l += 1
        case 'rstudio':
            total_log_line_count_of_each_repetition: int = 3 * (total_action_count_of_each_repetition + 2)  # Each Sys.time call produces 3 lines of console output. A parsing is needed before extraction of each cell. Before the parsing the current implementation of RStudio-ver Containerizer automatically tries to extract once right after the code cell selector is loaded.
            with open(log_pathname) as log_file:
                line = log_file.read().splitlines()
                l = 0
                for repetition in range(0, repetition_count):
                    l += 3
                    # todo parse
                    l += 3
                    for cell_no in range(0, cell_count):
                        for expected_action in cell_level_args[cell_no]['actions']:
                            function_match: re.Match[str] | None = RE_log_rstudio.search(line[l])
                            if not function_match:
                                logging.critical(f"Log line with unsupported format at line {l}: {line[l]}")
                                raise Exception(f"Terminated to prevent incorrect results.")
                            actual_action: str = function_match.group(1)
                            time_match: re.Match[str] | None = RE_log_rstudio_time.search(line[l + 2])
                            if not time_match:
                                logging.critical(f"Log line with unsupported format at line {l + 2}: {line[l + 2]}")
                                raise Exception(f"Terminated to prevent incorrect results.")
                            time: float = float(time_match.group(5))
                            if expected_action == actual_action:
                                cell_level_records.at[(pathname_prefix, platform, cell_no, expected_action), f't{repetition}'] = time
                            else:
                                logging.critical(f"Expected action: {expected_action}. Actual action at line {l}: {actual_action}")
                                raise Exception(f"Terminated to prevent incorrect results.")
                            l += 3
        case _:
            logging.warning(f"Skipped log pathname with unsupported platform suffix: {log_pathname}")

# print('Original records:')
# noinspection PyStringConversionWithoutDunderMethod
# print(cell_level_records.round(3))

placeholders = numpy.full((rows_of_cell_level_records, len(stats_column_names)), numpy.nan, dtype=numpy.float64)
cell_level_stats = pandas.DataFrame(placeholders, index=cell_level_multi_index, columns=stats_column_names)

cell_level_stats[stats_column_names] = cell_level_records.quantile([0.1, 0.5, 0.9], axis=1).T.agg(['min', 'median', 'max'], axis=1)

# print('Cell-level statistics:')
# noinspection PyStringConversionWithoutDunderMethod
# print(cell_level_stats.round(3))

grouped_records = cell_level_records.groupby(level=[1, 3])
grouped_records = {group_keys: dataframe for group_keys, dataframe in grouped_records}
# print('Group by platform and action')
# print(grouped_records)

# noinspection PyTypeChecker
group_level_stats_index_tuples: list[tuple[str, str]] = list(grouped_records.keys())  # pyright: ignore[reportAssignmentType]
group_level_multi_index = pandas.MultiIndex.from_tuples(group_level_stats_index_tuples, names=['platform', 'action'])

placeholders = numpy.full((len(group_level_stats_index_tuples), len(stats_column_names)), numpy.nan, dtype=numpy.float64)
group_level_stats = pandas.DataFrame(placeholders, index=group_level_multi_index, columns=stats_column_names)

for group_keys, dataframe in grouped_records.items():
    trunc_dataframe = dataframe.quantile([0.1, 0.5, 0.9], axis=1).T
    # noinspection PyTypeChecker
    group_level_stats.at[group_keys, 'trunc_min'] = trunc_dataframe[0.1].min()
    group_level_stats.at[group_keys, 'med'] = trunc_dataframe[0.5].median()
    # noinspection PyTypeChecker
    group_level_stats.at[group_keys, 'trunc_max'] = trunc_dataframe[0.9].max()

print('Group-level statistics:')
# noinspection PyStringConversionWithoutDunderMethod
print(group_level_stats.sort_values(by='action').round(3))

group_level_diffs_index_tuples: list[tuple[str, str]] = list(itertools.product(['lab.vreapi', 'rstudio'], ['extract', 'create']))
group_level_diffs_multi_index = pandas.MultiIndex.from_tuples(group_level_diffs_index_tuples, names=['platform', 'action'])
group_level_diffs_column_names: list[str] = ['Med diff', 'Trunc max diff', 'Med diff %', 'Trunc max diff %']

placeholders = numpy.full((len(group_level_diffs_index_tuples), len(group_level_diffs_column_names)), numpy.nan, dtype=numpy.float64)
group_level_diffs = pandas.DataFrame(placeholders, index=group_level_diffs_multi_index, columns=group_level_diffs_column_names)

for index_tuple in group_level_diffs_index_tuples:
    # noinspection PyTypeChecker
    Med: float = group_level_stats.at[index_tuple, 'med']  # pyright: ignore[reportAssignmentType]
    # noinspection PyTypeChecker
    ref_Med: float = group_level_stats.at[('lab.original', index_tuple[1]), 'med']  # pyright: ignore[reportAssignmentType]
    group_level_diffs.at[index_tuple, 'Med diff'] = (Med - ref_Med)
    group_level_diffs.at[index_tuple, 'Med diff %'] = group_level_diffs.at[index_tuple, 'Med diff'] / ref_Med * 100  # pyright: ignore[reportOperatorIssue]
    # noinspection PyTypeChecker
    Trunc_Max: float = group_level_stats.at[index_tuple, 'trunc_max']  # pyright: ignore[reportAssignmentType]
    # noinspection PyTypeChecker
    ref_Trunc_Max: float = group_level_stats.at[('lab.original', index_tuple[1]), 'trunc_max']  # pyright: ignore[reportAssignmentType]
    group_level_diffs.at[index_tuple, 'Trunc max diff'] = (Trunc_Max - ref_Trunc_Max)
    group_level_diffs.at[index_tuple, 'Trunc max diff %'] = group_level_diffs.at[index_tuple, 'Trunc max diff'] / ref_Trunc_Max * 100  # pyright: ignore[reportOperatorIssue]

print('Group-level differences:')
# noinspection PyStringConversionWithoutDunderMethod
print(group_level_diffs.round(3))
