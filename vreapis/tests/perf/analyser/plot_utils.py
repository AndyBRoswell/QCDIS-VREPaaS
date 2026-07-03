import sys
import logging
import pathlib
import pandas
import matplotlib.pyplot
import matplotlib.dates
import matplotlib.figure
import matplotlib.axes

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='[%(asctime)s.%(msecs)03d] [%(levelname)s] [%(name)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S')  # Default logger level: info

matplotlib.pyplot.rcParams.update({'font.size': 24, 'lines.linewidth': 4})  # Make the fonts relatively larger and lines relatively thicker

source_dir = pathlib.Path('.log')
export_dir = pathlib.Path('export/util')
line_colors: list[str] = ["magenta", "orangered", "limegreen", "royalblue"]

for csv_file in source_dir.rglob('*.util.cooked.csv'):
    df: pandas.DataFrame = pandas.read_csv(csv_file)
    logging.info(f"Successfully read CSV: {csv_file}")

    df['time'] = pandas.to_datetime(df['time'])  # Parse the leftmost column into datetime objects

    CPU_column_names: list[str] = [col for col in df.columns if col.startswith('CPU:')]
    mem_column_names: list[str] = [col for col in df.columns if col.startswith('mem:')]

    fig: matplotlib.figure.Figure
    ax_CPU: matplotlib.axes.Axes
    ax_mem: matplotlib.axes.Axes
    fig, [ax_CPU, ax_mem] = matplotlib.pyplot.subplots(2, 1, figsize=(38.4, 21.6))  # 38.4 x 21.6 inches at 100 DPI yields 3840x2160 resolution

    for [ax, column_names] in [[ax_CPU, CPU_column_names], [ax_mem, mem_column_names]]:
        for index, column_name in enumerate(column_names):
            process_group = column_name[len('CPU:'):]  # Extract process name by bypassing the prefix
            ax.plot(df['time'], df[column_name], color=line_colors[index], label=process_group)
        ax.xaxis.set_major_locator(matplotlib.dates.MinuteLocator(interval=5))
        ax.xaxis.set_minor_locator(matplotlib.dates.MinuteLocator(interval=1))
        ax.margins(x=0)
        ax.set_ylim(bottom=0)
        ax.legend(bbox_to_anchor=(1.01, 1), loc='upper left')
        ax.grid(which='major', color='dimgrey', linestyle='-', linewidth=0.75)
        ax.grid(which='minor', color='lightgrey', linestyle='-', linewidth=0.5)
    ax_CPU.set_title(f"{csv_file}: CPU Usage")
    ax_mem.set_title(f"{csv_file}: Memory Usage")

    matplotlib.pyplot.tight_layout()

    relative_path = csv_file.relative_to(source_dir)
    out_filename = relative_path.name.replace('.util.cooked.csv', '.png')
    out_path = export_dir / relative_path.parent / out_filename

    out_path.parent.mkdir(parents=True, exist_ok=True)  # Automatically create recursively if the folder doesn't exist

    fig.savefig(out_path, dpi=100)
    logging.info(f"Successfully saved PNG chart: {out_path}")

    matplotlib.pyplot.close(fig)  # Free up memory
