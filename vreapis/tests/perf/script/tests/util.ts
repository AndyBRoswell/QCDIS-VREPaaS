import node_path from 'node:path'
import node_os from 'node:os'
import node_net from 'node:net'
import node_fs_promises from 'node:fs/promises'
import node_events from 'node:events'
import node_child_process from 'node:child_process'
import log, { type Logger } from "loglevel";
import * as child_process from "node:child_process";
import { expect } from "@playwright/test";

export type Milliseconds = number
export type Basename = string
export type Pathname = string
export type Segmented_Pathname = Pathname[]
export type TypeScript_Identifier = string
export type Logger_Map = { [key: TypeScript_Identifier]: Logger }
export type Delay_Map = { [key: string]: Milliseconds | Delay_Map }
export type File_Info = { [key: Pathname]: Pathname } & { name: Pathname, path: Pathname }
export type Supported_Variable_Types = "Integer" | "Float" | "String" | "List" //| 'int' | 'float' | 'string' | 'list'
export type Supported_Cell_Containerizer_Manipulations = "extract" | "create"
export type Variable_Type_Map = { [key: string]: string }
export type Supported_Variable_Type_Map = { [key: string]: Supported_Variable_Types }
export type Image_Creation_Arguments = { [key: string]: string | string[] | Supported_Variable_Type_Map } & {
  Inputs?: Supported_Variable_Type_Map,
  Outputs?: Supported_Variable_Type_Map,
  Parameters?: Supported_Variable_Type_Map,
  Dependencies?: string[],
  'Base Image': string,
}
export type Cell_Containerizer_Manipulation_Arguments = {
  actions: Supported_Cell_Containerizer_Manipulations[],
  image_args?: Image_Creation_Arguments,
}

export const enum preset_action_delay {
  extra_short = 250,
  short = 500,
  medium = 1000,
  long = 2000,
  extra_long = 4000,
}

export const variable_categories_to_fill = [ 'Inputs', 'Outputs', 'Parameters', ]

const original_log_method_factory = log.methodFactory
log.methodFactory = (log_method_name, log_level, logger_name) => {
  const raw = original_log_method_factory(log_method_name, log_level, logger_name)
  return (...args) => {
    const time_point = new Date().toISOString()
    const severity = log_method_name === 'error' ? 'ERROR' : log_method_name === 'warn' ? 'Warning' : log_method_name
    raw(`[${time_point}] [${severity}] [${String(logger_name)}]`, ...args)
  }
}

export class Pathname_Operator {
  public static normalize(path: Pathname): Pathname {
    return node_path.normalize(path).replace(/\/+$/, '')
  }

  public static segmented_Pathname(path: Pathname): Segmented_Pathname { // Break path string in to segments for the convenience of comparison. Blank segments are ignored so inputs like `a///b` are handled correctly
    return path.split(node_path.sep).filter(Boolean)
  }

  public static identical_Pathname(p: Pathname, q: Pathname): boolean {
    return this.identical_Segmented_Pathname(this.segmented_Pathname(p), this.segmented_Pathname(q))
  }

  public static identical_Segmented_Pathname(p: Segmented_Pathname, q: Segmented_Pathname): boolean { // Determine if 2 paths are identical
    return p.length === q.length && p.every((value, index) => value === q[index])
  }
}

export const enum Control_Code {
  init = 0,
  monitor_ready,
  query_monitor_start,
  monitor_started,
  query_monitor_stop,
  monitor_stopped,
  monitor_closed,
}

export class Control {
  private static control_channel_pathname: Pathname
  private static control_server: node_net.Server
  private static control_socket: node_net.Socket
  private static monitor: node_child_process.ChildProcess
  private static monitor_ready: boolean = false
  private static monitor_started: boolean = false
  private static monitor_stopped: boolean = false
  private static resolve_with_monitor_ready: (() => void) | null = null
  private static resolve_with_monitor_started: (() => void) | null = null
  private static resolve_with_monitor_stopped: (() => void) | null = null

  public static async launch_performance_monitor(
    cmdline_arg: {
      browser: boolean,
      JupyterLab_backend: boolean,
      RStudio_backend: boolean,
      vreapi_process: boolean,
      database_process: boolean,
      interval: number,
      control_channel: boolean,
      console_output: boolean,
      file_output: boolean,
    }
  ) {
    const platform = node_os.platform()
    switch (platform) {
      case 'linux':
        const control_channel_dir = await node_fs_promises.mkdtemp(node_path.join(node_os.tmpdir(), 'Cell-Containerizer-perf-mon-'))
        Control.control_channel_pathname = node_path.join(control_channel_dir, 'ctl-ch.sock')
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
    Control.control_server = node_net.createServer(Control.on_connection)
    Control.control_server.listen(Control.control_channel_pathname)
    await node_events.once(Control.control_server, 'listening')
    const monitor_script = node_path.resolve(__dirname, '../../monitor/rec-utils.py')
    const monitor_script_arg = [ monitor_script ]
    if (cmdline_arg.browser) { monitor_script_arg.push('-b') }
    if (cmdline_arg.JupyterLab_backend) { monitor_script_arg.push('-j') }
    if (cmdline_arg.RStudio_backend) { monitor_script_arg.push('-r') }
    if (cmdline_arg.vreapi_process) { monitor_script_arg.push('-v') }
    if (cmdline_arg.database_process) { monitor_script_arg.push('-d') }
    if (cmdline_arg.interval) { monitor_script_arg.push('-i', cmdline_arg.interval.toString()) }
    if (cmdline_arg.control_channel) { monitor_script_arg.push('-I', Control.control_channel_pathname) } else { monitor_script_arg.push('-D') }
    if (cmdline_arg.console_output) { monitor_script_arg.push('-c') }
    if (cmdline_arg.file_output) { monitor_script_arg.push('-f') }
    Control.monitor = node_child_process.spawn('python', monitor_script_arg, { stdio: 'inherit', detached: false })
  }

  protected static on_connection(socket: node_net.Socket) {
    socket.on('readable', () => Control.on_readable(socket))
    Control.control_socket = socket
    expect(Control.control_socket).not.toBeUndefined()
  }

  protected static on_readable(socket: node_net.Socket) {
    let chunk: Buffer
    while ((chunk = socket.read(1)) !== null) {
      switch (chunk[0]) {
        case Control_Code.monitor_ready:
          Control.monitor_ready = true
          if (Control.resolve_with_monitor_ready) {
            Control.resolve_with_monitor_ready()
            // Control.resolve_with_monitor_ready = null
          }
          break
        case Control_Code.monitor_started:
          Control.monitor_started = true
          if (Control.resolve_with_monitor_started) {
            Control.resolve_with_monitor_started()
            // Control.resolve_with_monitor_started = null
          }
          break
        case Control_Code.monitor_stopped:
          Control.monitor_stopped = true
          if (Control.resolve_with_monitor_stopped) {
            Control.resolve_with_monitor_stopped()
            // Control.resolve_with_monitor_stopped = null
          }
          break
        default:
          throw new Error(`Received unsupported control code ${chunk[0]}`)
      }
    }
  }

  public static get_control_channel_pathname() { return Control.control_channel_pathname }

  public static get_monitor_script_PID() { return this.monitor.pid }

  public static async start_monitor() {
    await Control.wait(Control_Code.monitor_ready)
    Control.control_socket.write(Buffer.from([ Control_Code.query_monitor_start ]))
    await Control.wait(Control_Code.monitor_started)
  }

  public static async stop_monitor() {
    const exit_code = new Promise((resolve, reject) => {
      Control.monitor.on('close', (code) => { resolve(code) })
      Control.monitor.on('error', (err) => { reject(err) })
    })
    Control.control_socket.write(Buffer.from([ Control_Code.query_monitor_stop ]))
    await Control.wait(Control_Code.monitor_stopped)
    return await exit_code
  }

  public static wait(expected_control_code: Control_Code): Promise<void> {
    switch (expected_control_code) {
      case Control_Code.monitor_ready:
        if (Control.monitor_ready) {
          // Control.monitor_ready = false
          return Promise.resolve()
        }
        return new Promise(resolve => { Control.resolve_with_monitor_ready = resolve })
      case Control_Code.monitor_started:
        if (Control.monitor_started) {
          // Control.monitor_started = false
          return Promise.resolve()
        }
        return new Promise(resolve => { Control.resolve_with_monitor_started = resolve })
      case Control_Code.monitor_stopped:
        if (Control.monitor_stopped) {
          // Control.monitor_stopped = false
          return Promise.resolve()
        }
        return new Promise(resolve => { Control.resolve_with_monitor_stopped = resolve })
      default:
        throw new Error(`Could not wait for control code: ${expected_control_code}`)
    }
  }
}
