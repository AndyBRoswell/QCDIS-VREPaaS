import * as Util from './util.ts'

export const notebook_args: { [key: Util.Pathname]: Util.Cell_Containerizer_Manipulation_Arguments[] } = {
  'D1': [
    {
      Outputs: { 'w': "Integer", 'x': "Integer", 'y': "Integer", },
      'Base Image': 'r',
    },
    {
      Inputs: { 'w': "Integer", },
      Outputs: { names: 'List', },
      'Base Image': 'r',
    },
    {
      Inputs: { x: "Integer", y: "Integer", names: 'List', },
      Outputs: { t: "Integer", },
      Parameters: { param_p: "String", },
      'Base Image': 'r',
    },
    {
      Inputs: { t: "Integer", },
      Parameters: { param_a: "String", },
      'Base Image': 'r',
    },
  ],
}