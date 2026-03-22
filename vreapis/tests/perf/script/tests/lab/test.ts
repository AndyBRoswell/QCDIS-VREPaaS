import { expect, type Locator, type Page, test } from '@playwright/test'
import log, { type Logger } from 'loglevel'
import Node_Path from 'node:path'
import { setTimeout } from "node:timers/promises";
import { text } from "node:stream/consumers";

type Milliseconds = number
type Pathname = string
type Segmented_Pathname = Pathname[]
type TypeScript_Identifier = string
type Logger_Map = { [key: TypeScript_Identifier]: Logger }
type Delay_Map = { [key: string]: Milliseconds | Delay_Map }
type File_Info = { [key: Pathname]: Pathname } & { name: Pathname, path: Pathname }
type Supported_Variable_Types = "Integer" | "Float" | "String" | "List" //| 'int' | 'float' | 'string' | 'list'
type Variable_Type_Map = { [key: string]: string}
type Cell_Containerizer_Manipulation_Arguments = {
  [key: string]: string | string[] | Variable_Type_Map
} & {
  Inputs?: { [key: string]: Supported_Variable_Types },
  Outputs?: { [key: string]: Supported_Variable_Types },
  Parameters?: { [key: string]: Supported_Variable_Types },
  Dependencies?: string[],
  'Base Image': string,
}

const enum preset_action_delay {
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

class File_Browser_Manipulator {
  private static logger: Logger_Map = {}

  public page!: Page
  public main_sidebar!: Locator
  public file_browser_tab!: Locator
  public file_browser_tab_icon!: Locator
  public file_browser_section!: Locator
  public home_dir_icon!: Locator
  public path_indicator!: Locator
  public file_list!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(File_Browser_Manipulator.prototype)
    for (const member of instance_members) { File_Browser_Manipulator.logger[member] = log.getLogger(`${File_Browser_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page) {
    this.page = page
  }

  public async init() {
    this.main_sidebar = this.page.getByRole('complementary', { name: 'main sidebar' })
    this.file_browser_tab = this.main_sidebar.locator(`[data-id="filebrowser"]`)
    this.file_browser_tab_icon = this.file_browser_tab.locator('path') // Locate the only clickable child. I don't know why I must click the <path> here while I don't need this for manipulations of running sessions tab, and doing that don't give any response and make the tests stuck.
    await this.toggle() // To let File Browser Section be loaded [otherwise the tests will be stuck and finally timeout]
    this.file_browser_section = this.page.getByRole('region', { name: 'File Browser Section' }) // Locate the file browser
    this.file_list = this.file_browser_section.locator(`ul`) // Get the file list for tests
    this.home_dir_icon = this.file_browser_section.locator(`[data-icon="ui-components:folder"]`).first().locator('path') // Home dir can be entered by clicking it
    this.path_indicator = this.home_dir_icon.locator(`xpath=../../..`) // It shows the current path of the file browser
  }

  public async visible(): Promise<boolean> { // Check if the file browser tab is visible [i.e. selected in the main sidebar]
    File_Browser_Manipulator.logger[this.visible.name]!.info(`Detecting if this file browser tab is visible...`)
    let r: boolean = await this.file_browser_tab.getAttribute('aria-selected') === 'true'
    File_Browser_Manipulator.logger[this.visible.name]!.info(r)
    return r
  }

  public async toggle() { // Switch to the file browser tab by clicking its icon in the main sidebar
    while (await this.visible() === false) { // If the file browser tab is already visible, do nothing [otherwise the tests will be stuck and finally timeout]
      File_Browser_Manipulator.logger[this.toggle.name]!.info(`Toggling the file browser tab...`)
      await this.file_browser_tab_icon.click()
      await setTimeout(preset_action_delay.short)
      File_Browser_Manipulator.logger[this.toggle.name]!.info('File browser tab clicked')
    }
  }

  public async current_directory(): Promise<string> {
    await this.toggle()
    File_Browser_Manipulator.logger[this.current_directory.name]!.info(`Getting the current directory...`)
    const r: string = await this.path_indicator.textContent() as string
    File_Browser_Manipulator.logger[this.current_directory.name]!.info(r)
    return r
  }

  public static segmented_path(path: Pathname): Segmented_Pathname { return path.split(Node_Path.sep).filter(Boolean) } // Break path string in to segments for the convenience of comparison. Blank segments are ignored so inputs like `a///b` are handled correctly

  public static identical_Pathname(p: Pathname, q: Pathname): boolean {
    return this.identical_Segmented_Pathname(this.segmented_path(p), this.segmented_path(q))
  }

  public static identical_Segmented_Pathname(p: Segmented_Pathname, q: Segmented_Pathname): boolean { // Determine if 2 paths are identical
    return p.length === q.length && p.every((value, index) => value === q[index])
  }

  public async go_home(delay: Milliseconds = preset_action_delay.medium) { // Go to the home directory
    await this.toggle()
    File_Browser_Manipulator.logger[this.go_home.name]!.info('Going back home...')
    do {
      await this.home_dir_icon.click()
      await setTimeout(delay)
      File_Browser_Manipulator.logger[this.go_home.name]!.info('Home dir icon clicked')
    } while (await this.current_directory() !== '/')
  }

  public async open(path: Pathname, home_as_relative_root: boolean = false): Promise<void> { // Go to the designated directory
    File_Browser_Manipulator.logger[this.open.name]!.info(`Dest: ${path}`)
    const path_segments = File_Browser_Manipulator.segmented_path(path)
    await this.toggle()
    if (home_as_relative_root) { await this.go_home() }
    const target_path: string[] = []
    for (const [ index, segment ] of path_segments.entries()) {
      File_Browser_Manipulator.logger[this.open.name]!.info(`Entering ${segment}...`)
      const entry = file_browser_manipulator.file_list.locator(`[title^="Name: ${segment}"]`)
      if (index < path_segments.length - 1) {
        if (await entry.getAttribute('data-isdir') === 'false') { throw new Error(`Non-leaf file system node ${segment} is not a directory`) }
      } else {
        await entry.dblclick()
        await setTimeout(preset_action_delay.medium)
        break
      }
      target_path.push(segment)
      do {
        await entry.dblclick()
        await setTimeout(preset_action_delay.medium)

      } while (File_Browser_Manipulator.identical_Segmented_Pathname(File_Browser_Manipulator.segmented_path(await this.current_directory()), target_path) === false)
      File_Browser_Manipulator.logger[this.open.name]!.info(`Entered ${segment}`)
    }
    File_Browser_Manipulator.logger[this.open.name]!.info(`Arrived at ${path}`)
  }
}

class Running_Session_Manipulator {
  private static logger: Logger_Map = {}

  public page!: Page
  public main_sidebar!: Locator
  public running_sessions_tab!: Locator
  public running_sessions_section!: Locator
  public Open_Tabs_div!: Locator
  public Kernels_div!: Locator
  public Close_All_button!: Locator
  public Shut_Down_All_button!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(Running_Session_Manipulator.prototype)
    for (const member of instance_members) { Running_Session_Manipulator.logger[member] = log.getLogger(`${Running_Session_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page) {
    this.page = page
  }

  public async init() {
    this.main_sidebar = this.page.getByRole('complementary', { name: 'main sidebar' })
    this.running_sessions_tab = this.main_sidebar.locator(`[data-id="jp-running-sessions"]`)
    while (await this.visible() === false) { await this.toggle() } // To let Running Sessions Section be loaded [otherwise the tests will be stuck and finally timeout]
    this.running_sessions_section = this.page.getByRole('region', { name: 'Running Sessions section' })
    const divs = this.running_sessions_section.locator('> div')
    this.Open_Tabs_div = divs.filter({ hasText: 'Open Tabs' })
    this.Kernels_div = divs.filter({ hasText: 'Kernels' })
    this.Close_All_button = this.Open_Tabs_div.getByRole('button', { name: 'Close All' })
    this.Shut_Down_All_button = this.Kernels_div.getByRole('button', { name: 'Shut Down All' })
  }

  public async visible(): Promise<boolean> {
    return await this.running_sessions_tab.getAttribute('aria-selected') === 'true'
  }

  public async toggle() {
    while (await this.visible() === false) {
      await this.running_sessions_tab.click()
      await setTimeout(preset_action_delay.short)
    }
  }

  public async close_all_tabs() {
    await this.toggle()
    const disabled = await this.Close_All_button.getAttribute('disabled')
    if (disabled === null) {
      await this.Close_All_button.click()
      await setTimeout(preset_action_delay.medium)
      const dialog = this.page.locator('body > div').filter({ hasText: 'Close All?' })
      const confirm_button = dialog.getByRole('button').filter({ hasText: 'Close All' })
      await confirm_button.click()
    }
  }

  public async shut_down_all_kernels() {
    await this.toggle()
    const disabled = await this.Shut_Down_All_button.getAttribute('disabled')
    if (disabled === null) {
      await this.Shut_Down_All_button.click()
      await setTimeout(preset_action_delay.medium)
      const dialog = this.page.locator('body > div').filter({ hasText: 'Shut Down All?' })
      const confirm_button = dialog.getByRole('button').filter({ hasText: 'Shut Down All' })
      await confirm_button.click()
    }
  }
}

class Text_Editor_Manipulator {
  private static logger: Logger_Map = {}

  public page!: Page
  public file_browser_manipulator!: File_Browser_Manipulator
  public running_session_manipulator!: Running_Session_Manipulator
  public cell_containerizer_manipulator!: Cell_Containerizer_Manipulator
  public main!: Locator
  public tab_list!: Locator // Reference changes once all tabs are closed and the new launcher is automatically present again
  public associated_file: string = ''
  public tab_panel!: Locator // Reference changes if the same file is closed and open again
  public notebook_content_region!: Locator
  public cell: Locator[] = []
  public code_cell: Locator[] = []

  static {
    const instance_members = Object.getOwnPropertyNames(Text_Editor_Manipulator.prototype)
    for (const member of instance_members) { Text_Editor_Manipulator.logger[member] = log.getLogger(`${Text_Editor_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page, file_browser_manipulator: File_Browser_Manipulator, running_session_manipulator: Running_Session_Manipulator, cell_containerizer_manipulator: Cell_Containerizer_Manipulator) {
    this.page = page
    this.file_browser_manipulator = file_browser_manipulator
    this.running_session_manipulator = running_session_manipulator
    this.cell_containerizer_manipulator = cell_containerizer_manipulator
    this.main = this.page.getByRole('main')
  }

  public async current_file(): Promise<File_Info> { // Get the pathname corresponding to the focused tab
    this.tab_list = this.main.getByRole('tablist')
    const focused_tab = this.tab_list.locator('[aria-selected="true"]')
    const title = await focused_tab.getAttribute('title') as string
    if (!title) { return { name: '', path: '' } }
    const re = /^Name: (.+)\r?\nPath: (.+)/m // Will multilingual support be needed here in the future?
    const match = title?.match(re)
    if (!match) { throw new Error('Could not get the file information of the current tab') }
    return { name: match[1]!, path: match[2]! }
  }

  public async open(pathname: string) {
    const canonical_pathname = `${await this.file_browser_manipulator.current_directory()}/${pathname}`
    while (File_Browser_Manipulator.identical_Pathname(canonical_pathname, (await this.current_file()).path) === false) {
      await this.file_browser_manipulator.open(pathname)
    }
    this.associated_file = canonical_pathname
    this.tab_panel = this.main.getByRole('tabpanel') // See https://playwright.dev/docs/api/class-page#page-get-by-role-option-include-hidden
    this.notebook_content_region = this.tab_panel.getByRole('region', { name: 'notebook content' })
    const re = /^#(.*)# ([0-9A-Fa-f]{16,})( \[rpt \d+])?\s*$/m // Currently, every cell under test is marked with 1st-line comments with a suffix with a mandatory 16-digit hex and for nth repetition explicitly stated [optional]
    this.cell = await this.notebook_content_region.locator('> *').all()
    this.code_cell = []
    for (const cell of this.cell) {
      const content = await cell.innerText()
      if (content.match(re)) { this.code_cell.push(cell) }
    }
  }

  public async select_code_cell(index: number) {
    await this.code_cell[index]!.click()
  }

  public async close_all() {
    await this.running_session_manipulator.close_all_tabs()
    await setTimeout(preset_action_delay.medium)
    await this.running_session_manipulator.shut_down_all_kernels()
  }
}

class Cell_Containerizer_Manipulator {
  private static logger: Logger_Map = {}

  public static variable_categories_to_fill = [ 'Inputs', 'Outputs', 'Parameters', ]

  public page!: Page
  public main_sidebar!: Locator
  public Cell_Containerizer_tab!: Locator
  public Cell_Containerizer!: Locator
  public selection_area!: Locator
  public Inputs_div!: Locator
  public Outputs_div!: Locator
  public Parameters_div!: Locator
  public Dependencies_div!: Locator
  public Base_Image_div!: Locator
  public Create_button!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(Cell_Containerizer_Manipulator.prototype)
    for (const member of instance_members) { Cell_Containerizer_Manipulator.logger[member] = log.getLogger(`${Cell_Containerizer_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page) {
    this.page = page
  }

  public async init() {
    this.main_sidebar = this.page.getByRole('complementary', { name: 'main sidebar' })
    this.Cell_Containerizer_tab = this.main_sidebar.locator('[data-id="lifewatch/panel"]')
    await this.toggle() // To let Cell Containerizer Panel be loaded [otherwise the tests will be stuck and finally timeout]
    this.Cell_Containerizer = this.page.locator(String.raw`#lifewatch\/panel`)
    this.Create_button = this.Cell_Containerizer.getByRole('button')
  }

  public async visible(): Promise<boolean> {
    return await this.Cell_Containerizer_tab.getAttribute('aria-selected') === 'true'
  }

  public async toggle() {
    while (await this.visible() === false) {
      await this.Cell_Containerizer_tab.click()
      await setTimeout(preset_action_delay.short)
    }
  }

  public async wait_until_completion_of_analysis() {
    await this.toggle()
    const analyzing_message = this.Cell_Containerizer.getByText(/Analyzing notebook/).first()
    await analyzing_message.waitFor({ state: 'visible' })
    await analyzing_message.waitFor({ state: 'detached' })
  }

  public async fill(args: Cell_Containerizer_Manipulation_Arguments) {
    await this.toggle()
    for (const category of Cell_Containerizer_Manipulator.variable_categories_to_fill) {
      if (category in args) {
        const variable_type_selection_area = this.Cell_Containerizer.locator('div').filter({has: this.page.locator(':scope > :text-is("' + category + '")')}) // use this.page as execution context
        const target_type: Variable_Type_Map = args[category] as Variable_Type_Map
        const rows = await variable_type_selection_area.locator('tr').all()
        for (const row of rows) {
          const header = await row.getByRole('cell').all()
          const var_name = await header[0]!.innerText()
          const type_combo = header[1]!.getByRole('button')
          await type_combo.click()
          await setTimeout(preset_action_delay.short)
          const dropdown_div = this.page.locator('body > div[role="presentation"]')
          const dropdown_menu = dropdown_div.getByRole('listbox')
          const target_item = dropdown_menu.getByText(target_type[var_name]!, { exact: true })
          await target_item.click()
          await setTimeout(preset_action_delay.short)
        }
      }
    }
    const base_image_selection_area = this.Cell_Containerizer.locator('div').filter({ has: this.page.locator(':scope > :text-is("Base Image")') })
    const base_image_combo = base_image_selection_area.getByRole('combobox')
    await base_image_combo.click()
    await setTimeout(preset_action_delay.short)
    const base_image_list = base_image_selection_area.getByRole('listbox')
    const target_base_image_item = base_image_list.getByText(args['Base Image'], { exact: true })
    await target_base_image_item.click()
    await setTimeout(preset_action_delay.short)
  }

  public async create() {
    await this.toggle()

  }
}

// log.setLevel('info')

const test_root: string = 'tmp/rmd' // All the test files should be placed here

const repetition_count = 10

var file_browser_manipulator: File_Browser_Manipulator
var running_session_manipulator: Running_Session_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  running_session_manipulator = new Running_Session_Manipulator(page)
  await running_session_manipulator.init()
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  await setTimeout(preset_action_delay.long)
  await file_browser_manipulator.open(test_root, true)
  expect(File_Browser_Manipulator.identical_Pathname(test_root, await file_browser_manipulator.current_directory())).toBeTruthy()
})

// test('sample test', async ({ page }) => {
//   await expect(page).toHaveTitle(/JupyterLab/)
// })

var cell_containerizer_manipulator: Cell_Containerizer_Manipulator
var text_editor_manipulator: Text_Editor_Manipulator

test('D1', async ({ page }) => {
  cell_containerizer_manipulator = new Cell_Containerizer_Manipulator(page)
  text_editor_manipulator = new Text_Editor_Manipulator(page, file_browser_manipulator, running_session_manipulator, cell_containerizer_manipulator)
  await text_editor_manipulator.open('D1.0.ipynb')
  expect(text_editor_manipulator.code_cell.length).toEqual(4)
  const args_set: Cell_Containerizer_Manipulation_Arguments[] = [
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
  ]
  await cell_containerizer_manipulator.init()
  await text_editor_manipulator.select_code_cell(1)
  await cell_containerizer_manipulator.wait_until_completion_of_analysis()
  await setTimeout(preset_action_delay.short)
  for (const [ index, args ] of args_set.entries()) {
    await text_editor_manipulator.select_code_cell(index)
    await cell_containerizer_manipulator.wait_until_completion_of_analysis()
    await setTimeout(preset_action_delay.short)
    await cell_containerizer_manipulator.fill(args)
    await setTimeout(preset_action_delay.medium)
  }
  await text_editor_manipulator.close_all()
  await setTimeout(preset_action_delay.medium)
})