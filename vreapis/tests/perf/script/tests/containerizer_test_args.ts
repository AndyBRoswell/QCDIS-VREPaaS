import * as Util from './util.ts'

export const notebook_test_args: { [key: Util.Pathname]: Util.Cell_Containerizer_Manipulation_Arguments[] } = {
  'D1': [
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { 'w': "Integer", 'x': "Integer", 'y': "Integer", },
        'Base Image': 'r',
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { 'w': "Integer", },
        Outputs: { names: 'List', },
        'Base Image': 'r',
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { x: "Integer", y: "Integer", names: 'List', },
        Outputs: { t: "Integer", },
        Parameters: { param_p: "String", },
        'Base Image': 'r',
      },
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { t: "Integer", },
        Parameters: { param_a: "String", },
        'Base Image': 'r',
      },
    },
  ],
}