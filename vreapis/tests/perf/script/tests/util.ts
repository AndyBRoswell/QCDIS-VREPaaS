import node_path from 'node:path'
import node_os from 'node:os'
import node_net from 'node:net'
import node_fs_promises from 'node:fs/promises'
import log, { type Logger } from "loglevel";

export type Milliseconds = number
export type Pathname = string
export type Segmented_Pathname = Pathname[]
export type TypeScript_Identifier = string
export type Logger_Map = { [key: TypeScript_Identifier]: Logger }
export type Delay_Map = { [key: string]: Milliseconds | Delay_Map }
export type File_Info = { [key: Pathname]: Pathname } & { name: Pathname, path: Pathname }
export type Supported_Variable_Types = "Integer" | "Float" | "String" | "List" //| 'int' | 'float' | 'string' | 'list'
export type Variable_Type_Map = { [key: string]: string }
export type Cell_Containerizer_Manipulation_Arguments = {
  [key: string]: string | string[] | Variable_Type_Map
} & {
  Inputs?: { [key: string]: Supported_Variable_Types },
  Outputs?: { [key: string]: Supported_Variable_Types },
  Parameters?: { [key: string]: Supported_Variable_Types },
  Dependencies?: string[],
  'Base Image': string,
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
}

export class Control {
  private static server_pathname: Pathname
  private static server: node_net.Server
  private static monitor_ready: boolean = false
  private static monitor_started: boolean = false
  private static resolve_with_monitor_ready: (() => void) | null = null
  private static resolve_with_monitor_started: (() => void) | null = null
  public static async launch_performance_monitor(): Promise<Pathname> {
    const platform = node_os.platform()
    switch (platform) {
      case 'linux':
        const server_dir = await node_fs_promises.mkdtemp(node_path.join(node_os.tmpdir(), 'Cell-Containerizer-perf-mon-'))
        Control.server_pathname = node_path.join(server_dir, 'ctl-ch.sock')
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
    Control.server = node_net.createServer(Control.on_connection)
    Control.server.listen(Control.server_pathname)
    return Control.server_pathname
  }
  protected static on_connection(socket: node_net.Socket) {
    socket.on('readable', () => Control.on_readable(socket))
  }
  protected static on_readable(socket: node_net.Socket) {
    let chunk: Buffer
    while ((chunk = socket.read(1)) !== null) {
      switch (chunk[0]) {
        case Control_Code.monitor_ready:
          Control.resolve_with_monitor_ready!()
          Control.resolve_with_monitor_ready = null
          break
        case Control_Code.monitor_started:
          Control.resolve_with_monitor_started!()
          Control.resolve_with_monitor_started = null
          break
        default:
          throw new Error(`Received unsupported control code ${chunk[0]}`)
      }
    }
  }
  public static wait(expected_control_code: Control_Code): Promise<void> {
    switch (expected_control_code) {
      case Control_Code.monitor_ready:
        if (Control.monitor_ready) {
          Control.monitor_ready = false
          return Promise.resolve()
        }
        return new Promise(resolve => { Control.resolve_with_monitor_ready = resolve })
      case Control_Code.monitor_started:
        if (Control.monitor_started) {
          Control.monitor_started = false
          return Promise.resolve()
        }
        return new Promise(resolve => { Control.resolve_with_monitor_started = resolve })
      default:
        throw new Error(`Could not wait for control code: ${expected_control_code}`)
    }
  }
}
