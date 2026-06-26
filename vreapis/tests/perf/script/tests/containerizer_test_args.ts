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
  'port/dependency_with_submodule.notebook': [
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { x_values: 'List', y_values: 'List' },
        "Base Image": 'r',
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { x_values: 'List', x: "List", y: "List", y_values: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { x_values: "List" },
        "Base Image": 'r'
      }
    },
  ],
  'port/R-notebook': [
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { numbers: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { numbers: "List" },
        Outputs: { average: "Float" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { average: "Float" },
        "Base Image": 'r'
      }
    },
  ],
  'port/test_!': [
    {
      actions: [ 'extract', ],
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { file_path: "String" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { file_path: "String" },
        Outputs: { lines: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { lines: "List" },
        Outputs: { count: "Integer" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { count: "Integer" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { msg: "String" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { msg: "String" },
        Outputs: { list_of_paths: "List", list_of_ints: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { list_of_paths: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { list_of_ints: "List" },
        "Base Image": 'r'
      }
    }
  ],
  'port/test_conf_nesting': [
    { actions: [ 'extract', ], },
    { actions: [ 'extract', ], },
  ],
  'port/test_param_in_cell_notebook': [
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { a_list: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { a_list: "List" },
        Outputs: { b_list: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { b_list: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { numbers: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { numbers: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', ],
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { diameterofsedimentationchamber: "String" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: {
          transectcounting: "Integer",
          param_cellcarboncontent: "Integer",
          param_totalcarboncontent: "Integer",
          param_surfacearea: "Integer",
          dilutionfactor: "Integer",
          diameteroffieldofview: "Integer",
          param_biovolume: "Integer",
          diameterofsedimentationchamber: "Integer",
          numberoftransects: "Integer",
          param_totalbiovolume: "Integer",
          param_surfacevolumeratio: "Integer",
          settlingvolume: "Integer",
          numberofcountedfields: "Integer",
        },
        Parameters: {
          param_CountingStrategy: "String",
          param_density: "Integer",
        },
        "Base Image": 'r'
      }
    },
  ],
  'power-in-my-room': [
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { V: "List", t_ms: "List" },
        "Base Image": 'r'
      },
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { t_ms: "List" },
        Outputs: { t_s: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { t_ms: "List" },
        Parameters: { param_date: "String", param_loc: "String" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { V: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { t_s: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { V: "List", t_s: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { t_ms: "List", V: "List" },
        "Base Image": 'r'
      }
    },
  ],
  'exynos-7420-power-curves': [
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { basic: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { dat: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { color: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { basic: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { color: "List", dat: "List" },
        Parameters: { param_annotation_off_x: "Integer" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { core_config: "List", dat: "List" },
        "Base Image": 'r'
      }
    },
  ],
  'equal-loudness-curve': [
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { basic: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { dat: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { dat: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { freq: "List" },
        Outputs: { Phon: "List", breaks: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { basic: "List" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: {
          breaks: "List",
          freq: "List",
          Loudness: "List",
          Phon: "List"
        },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Outputs: { examples: "Integer", min_dB: "Integer", max_dB: "Integer" },
        "Base Image": 'r'
      }
    },
    {
      actions: [ 'extract', 'create', ],
      image_args: {
        Inputs: { max_dB: "Integer", freq: "List", min_dB: "Integer", examples: "Integer" },
        Parameters: { param_seed: "Integer", param_digits: "Integer" },
        "Base Image": 'r'
      }
    }
  ]
}