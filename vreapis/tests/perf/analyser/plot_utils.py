import sys
import logging
import pathlib
import pandas
import matplotlib.pyplot

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='[%(asctime)s.%(msecs)03d] [%(levelname)s] [%(name)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S')  # Default logger level: info

matplotlib.pyplot.rcParams.update({'font.size': 24, 'lines.linewidth': 4})  # Make the fonts relatively larger and lines relatively thicker

source_directory = pathlib.Path('.log')
export_directory = pathlib.Path('export/util')
line_colors: list[str] = ["magenta", "orangered", "limegreen", "royalblue"]

for csv_file in source_directory.rglob('*.util.cooked.csv'):
    df = pandas.read_csv(csv_file)
    logging.info(f"Successfully read CSV: {csv_file}")

    df['time'] = pandas.to_datetime(df['time'])  # Parse the leftmost column into datetime objects

    CPU_columns = [col for col in df.columns if col.startswith('CPU:')]
    mem_columns = [col for col in df.columns if col.startswith('mem:')]

    fig, (ax_CPU, ax_mem) = matplotlib.pyplot.subplots(2, 1, figsize=(38.4, 21.6))  # 38.4 x 21.6 inches at 100 DPI yields 3840x2160 resolution

    for index, col in enumerate(CPU_columns):
        process_group = col[4:]  # Extract process name by bypassing the prefix
        ax_CPU.plot(df['time'], df[col], color=line_colors[index], label=process_group)

    for index, col in enumerate(mem_columns):
        process_group = col[4:]  # Extract process name by bypassing the prefix
        ax_mem.plot(df['time'], df[col], color=line_colors[index], label=process_group)

    ax_CPU.set_title("CPU Usage Over Time")
    ax_CPU.legend(bbox_to_anchor=(1.01, 1), loc='upper left')  # Show legend outside the chart

    ax_mem.set_title("Memory Usage Over Time")
    ax_mem.legend(bbox_to_anchor=(1.01, 1), loc='upper left')  # Show legend outside the chart

    matplotlib.pyplot.tight_layout()

    relative_path = csv_file.relative_to(source_directory)
    output_filename = relative_path.name.replace('.util.cooked.csv', '.png')
    output_filepath = export_directory / relative_path.parent / output_filename

    output_filepath.parent.mkdir(parents=True, exist_ok=True)  # Automatically create recursively if the folder doesn't exist

    fig.savefig(output_filepath, dpi=100)
    logging.info(f"Successfully saved PNG chart: {output_filepath}")

    matplotlib.pyplot.close(fig)  # Free up memory