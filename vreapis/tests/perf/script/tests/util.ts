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

const original_log_method_factory = log.methodFactory
log.methodFactory = (log_method_name, log_level, logger_name) => {
  const raw = original_log_method_factory(log_method_name, log_level, logger_name)
  return (...args) => {
    const time_point = new Date().toISOString()
    const severity = log_method_name === 'error' ? 'ERROR' : log_method_name === 'warn' ? 'Warning' : log_method_name
    raw(`[${time_point}] [${severity}] [${String(logger_name)}]`, ...args)
  }
}