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

logging.info(f"Start plotting")
for csv_file in source_dir.rglob('*.util.cooked.csv'):
    relative_path: pathlib.Path = csv_file.relative_to(source_dir)
    out_filename: str = relative_path.name.replace('.util.cooked.csv', '.png')
    out_pathname: pathlib.Path = export_dir / relative_path.parent / out_filename
    out_pathname.parent.mkdir(parents=True, exist_ok=True)  # Automatically create recursively if the folder doesn't exist
    # if out_pathname.is_file():
    #     logging.info(f"Skipped existing PNG chart: {out_pathname}")
    #     continue

    df: pandas.DataFrame = pandas.read_csv(csv_file)
    logging.info(f"CSV read: {csv_file}")

    df['time'] = pandas.to_datetime(df['time'])  # Parse the leftmost column into datetime objects

    CPU_column_names: list[str] = [col for col in df.columns if col.startswith('CPU:')]
    mem_column_names: list[str] = [col for col in df.columns if col.startswith('mem:')]

    fig: matplotlib.figure.Figure
    ax_CPU: matplotlib.axes.Axes
    ax_mem: matplotlib.axes.Axes
    fig, [ax_CPU, ax_mem] = matplotlib.pyplot.subplots(2, 1, figsize=(38.4, 21.6))  # 38.4 x 21.6 inches at 100 DPI yields 3840x2160 resolution

    for [ax, column_names] in [[ax_CPU, CPU_column_names], [ax_mem, mem_column_names]]:
        for index, column_name in enumerate(column_names):
            process_group_name = column_name[len('CPU:'):]  # Extract process name by bypassing the prefix
            ax.plot(df['time'], df[column_name], color=line_colors[index], label=process_group_name)
        ax.xaxis.set_major_locator(matplotlib.dates.MinuteLocator(interval=5))
        ax.xaxis.set_minor_locator(matplotlib.dates.MinuteLocator(interval=1))
        ax.margins(x=0)
        ax.set_ylim(bottom=0)
        ax.legend(bbox_to_anchor=(1.01, 1), loc='upper left')
        ax.grid(which='major', color='dimgrey', linestyle='-', linewidth=0.75)
        ax.grid(which='minor', color='lightgrey', linestyle='-', linewidth=0.5)
    ax_CPU.set_title(f"{csv_file}: CPU Usage")
    ax_CPU.set_ylim(top=200)
    ax_mem.set_title(f"{csv_file}: Memory Usage")
    ax_mem.set_ylim(top=1600)

    matplotlib.pyplot.tight_layout()

    fig.savefig(out_pathname, dpi=100)
    logging.info(f"Saved PNG chart: {out_pathname}")

    matplotlib.pyplot.close(fig)  # Free up memory
