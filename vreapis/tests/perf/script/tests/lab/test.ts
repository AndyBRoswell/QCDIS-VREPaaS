import { expect, type Locator, type Page, test } from '@playwright/test'
import log from 'loglevel'
import { setTimeout } from "node:timers/promises";
import * as Util from '../util'
import { notebook_test_args } from "../containerizer_test_args";

// log.setLevel('info')

class File_Browser_Manipulator {
  private static logger: Util.Logger_Map = {}

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
      await setTimeout(Util.preset_action_delay.short)
      File_Browser_Manipulator.logger[this.toggle.name]!.info('File browser tab clicked')
    }
  }

  public async current_directory(): Promise<Util.Pathname> {
    await this.toggle()
    File_Browser_Manipulator.logger[this.current_directory.name]!.info(`Getting the current directory...`)
    const r = await this.path_indicator.textContent() as string
    File_Browser_Manipulator.logger[this.current_directory.name]!.info(r)
    return r
  }

  public async go_home(delay: Util.Milliseconds = Util.preset_action_delay.medium) { // Go to the home directory
    await this.toggle()
    File_Browser_Manipulator.logger[this.go_home.name]!.info('Going back home...')
    do {
      await this.home_dir_icon.click()
      await setTimeout(delay)
      File_Browser_Manipulator.logger[this.go_home.name]!.info('Home dir icon clicked')
    } while (await this.current_directory() !== '/')
  }

  public async open(path: Util.Pathname, home_as_relative_root: boolean = false): Promise<void> { // Go to the designated directory
    File_Browser_Manipulator.logger[this.open.name]!.info(`Dest: ${path}`)
    const path_segments = Util.Pathname_Operator.segmented_Pathname(path)
    await this.toggle()
    if (home_as_relative_root) { await this.go_home() }
    const target_path: Util.Pathname[] = []
    for (const [ index, segment ] of path_segments.entries()) {
      File_Browser_Manipulator.logger[this.open.name]!.info(`Entering ${segment}...`)
      const entry = this.file_list.locator(`[title^="Name: ${segment}"]`)
      if (index < path_segments.length - 1) {
        if (await entry.getAttribute('data-isdir') === 'false') { throw new Error(`Non-leaf file system node ${segment} is not a directory`) }
      } else {
        await entry.dblclick()
        await setTimeout(Util.preset_action_delay.medium)
        break // Opening a leaf node [i.e. file] won't change the current path shown by the file browser section, so we don't compare the current directory with the target directory here
      }
      target_path.push(segment)
      do {
        await entry.dblclick()
        await setTimeout(Util.preset_action_delay.medium)
      } while (Util.Pathname_Operator.identical_Segmented_Pathname(Util.Pathname_Operator.segmented_Pathname(await this.current_directory()), target_path) === false)
      File_Browser_Manipulator.logger[this.open.name]!.info(`Entered ${segment}`)
    }
    File_Browser_Manipulator.logger[this.open.name]!.info(`Arrived at ${path}`)
  }
}

class Running_Session_Manipulator {
  private static logger: Util.Logger_Map = {}

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
      await setTimeout(Util.preset_action_delay.short)
    }
  }

  public async close_all_tabs() {
    await this.toggle()
    const disabled = await this.Close_All_button.getAttribute('disabled')
    if (disabled === null) {
      await this.Close_All_button.click()
      await setTimeout(Util.preset_action_delay.short)
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
      await setTimeout(Util.preset_action_delay.short)
      const dialog = this.page.locator('body > div').filter({ hasText: 'Shut Down All?' })
      const confirm_button = dialog.getByRole('button').filter({ hasText: 'Shut Down All' })
      await confirm_button.click()
    }
  }
}

class Text_Editor_Manipulator {
  private static logger: Util.Logger_Map = {}

  public page!: Page
  public file_browser_manipulator!: File_Browser_Manipulator
  public running_session_manipulator!: Running_Session_Manipulator
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
    this.main = this.page.getByRole('main')
  }

  public async current_file(): Promise<Util.File_Info> { // Get the pathname corresponding to the focused tab
    this.tab_list = this.main.getByRole('tablist')
    const focused_tab = this.tab_list.locator('[aria-selected="true"]')
    const title = await focused_tab.getAttribute('title') as string
    if (!title) { return { name: '', path: '' } }
    const re = /^Name: (.+)\r?\nPath: (.+)/m // Will multilingual support be needed here in the future?
    const match = title?.match(re)
    if (!match) { throw new Error('Could not get the file information of the current tab') }
    return { name: match[1]!, path: match[2]! }
  }

  public async open(pathname: Util.Pathname) {
    const canonical_pathname = `${await this.file_browser_manipulator.current_directory()}/${pathname}`
    while (Util.Pathname_Operator.identical_Pathname(canonical_pathname, (await this.current_file()).path) === false) {
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

  public async select_code_cell(index: number) { // 0-indexed
    await this.code_cell[index]!.click()
  }

  public async close_all() {
    await this.running_session_manipulator.close_all_tabs()
    await setTimeout(Util.preset_action_delay.short)
    await this.running_session_manipulator.shut_down_all_kernels()
  }
}

class Cell_Containerizer_Manipulator {
  private static logger: Util.Logger_Map = {}

  public page!: Page
  public HTML_body!: Locator
  public main_sidebar!: Locator
  public Cell_Containerizer_tab!: Locator
  public Cell_Containerizer!: Locator
  public Create_button!: Locator
  public success_icon!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(Cell_Containerizer_Manipulator.prototype)
    for (const member of instance_members) { Cell_Containerizer_Manipulator.logger[member] = log.getLogger(`${Cell_Containerizer_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page) {
    this.page = page
    this.HTML_body = page.locator('body')
  }

  public async init() {
    this.main_sidebar = this.page.getByRole('complementary', { name: 'main sidebar' })
    this.Cell_Containerizer_tab = this.main_sidebar.locator('[data-id="lifewatch/panel"]')
    await this.toggle() // To let Cell Containerizer Panel be loaded [otherwise the tests will be stuck and finally timeout]
    this.Cell_Containerizer = this.page.locator(String.raw`#lifewatch\/panel`)
    this.Create_button = this.Cell_Containerizer.getByRole('button', { name: 'Create', exact: true })
  }

  public async visible(): Promise<boolean> {
    return await this.Cell_Containerizer_tab.getAttribute('aria-selected') === 'true'
  }

  public async toggle() {
    while (await this.visible() === false) {
      await this.Cell_Containerizer_tab.click()
      await setTimeout(Util.preset_action_delay.short)
    }
  }

  public async wait_until_completion_of_analysis() {
    await this.toggle()
    const analyzing_message = this.Cell_Containerizer.getByText(/Analyzing notebook/).first()
    await analyzing_message.waitFor({ state: 'visible' })
    await analyzing_message.waitFor({ state: 'detached' })
  }

  public async fill(args: Util.Image_Creation_Arguments) {
    await this.toggle()
    for (const category of Util.variable_categories_to_fill) {
      if (category in args) {
        const variable_type_selection_area = this.Cell_Containerizer.locator('div').filter({ has: this.page.locator(':scope > :text-is("' + category + '")') }) // use this.page as execution context
        const target_type: Util.Variable_Type_Map = args[category] as Util.Variable_Type_Map
        const rows = await variable_type_selection_area.locator('tr').all()
        for (const row of rows) {
          const header = await row.getByRole('cell').all()
          const var_name = await header[0]!.innerText()
          const type_combo = header[1]!.getByRole('button')
          await type_combo.click()
          await setTimeout(Util.preset_action_delay.short)
          const dropdown_div = this.page.locator('body > div[role="presentation"]')
          const dropdown_menu = dropdown_div.getByRole('listbox')
          const target_item = dropdown_menu.getByText(target_type[var_name]!, { exact: true })
          await target_item.click()
          await setTimeout(Util.preset_action_delay.short)
        }
      }
    }
    const base_image_selection_area = this.Cell_Containerizer.locator('div').filter({ has: this.page.locator(':scope > :text-is("Base Image")') })
    const base_image_combo = base_image_selection_area.getByRole('combobox')
    await base_image_combo.click()
    await setTimeout(Util.preset_action_delay.short)
    const base_image_list = base_image_selection_area.getByRole('listbox')
    const target_base_image_item = base_image_list.getByText(args['Base Image'], { exact: true })
    await target_base_image_item.click()
    // await setTimeout(Util.preset_action_delay.short)
  }

  public async create() {
    await this.Create_button.click()
  }

  public async wait_until_completion_of_creation() {
    this.success_icon = this.page.getByTestId('CheckCircleOutlineIcon')
    await this.success_icon.waitFor()
  }

  public async close_successful_creation_popup() {
    const backdrop_wrapper = this.page.locator('body > div').filter({ has: this.success_icon })
    await backdrop_wrapper.dispatchEvent('click') // I don't know why locator.click doesn't work
  }
}

const logger = log.getLogger('test')
logger.setLevel('info')

const test_root: Util.Pathname = 'tmp/rmd' // All the test files should be placed here
const repetition_count = 10
const default_performance_sample_interval = 0.5
const result_root = '.log'
const log_filename_prefix = Util.log_filename_prefix()

var file_browser_manipulator: File_Browser_Manipulator
var running_session_manipulator: Running_Session_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  running_session_manipulator = new Running_Session_Manipulator(page)
  await running_session_manipulator.init()
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  await setTimeout(Util.preset_action_delay.long)
  await file_browser_manipulator.open(test_root, true)
  expect(Util.Pathname_Operator.identical_Pathname(test_root, await file_browser_manipulator.current_directory())).toBeTruthy()
  await Util.Control.launch_performance_monitor({
    browser: true,
    JupyterLab_backend: true,
    RStudio_backend: false,
    vreapi_process: true,
    database_process: true,
    interval: default_performance_sample_interval,
    control_channel: true,
    console_output: false,
    file_output: true,
    log_filename_prefix: `${log_filename_prefix}.util`
  })
  logger.info(`Performance monitor control channel: ${Util.Control.get_control_channel_pathname()}`)
  logger.info(`Performance monitor PID: ${Util.Control.get_monitor_script_PID()}`)
  logger.info(`Starting performance monitor`)
  await Util.Control.start_monitor()
  logger.info(`Performance monitor started`)
})

test.afterEach(async ({ page }) => {
  logger.info(`Stopping performance monitor`)
  const exit_code = await Util.Control.stop_monitor()
  logger.info(`Performance monitor stopped`)
  expect(exit_code).toEqual(0)
})

// test('sample test', async ({ page }) => {
//   await expect(page).toHaveTitle(/JupyterLab/)
// })

let Cell_Containerizer_manipulator: Cell_Containerizer_Manipulator
let text_editor_manipulator: Text_Editor_Manipulator

async function test_single_cell(index: number, args: Util.Cell_Containerizer_Manipulation_Arguments) {
  const trial_result: Util.Trial_Result[] = []
  let t0: number, t1: number
  if (args.actions.includes('extract')) {
    await text_editor_manipulator!.select_code_cell(index)
    t0 = performance.now()
    await Cell_Containerizer_manipulator!.wait_until_completion_of_analysis()
    t1 = performance.now()
    trial_result.push({ action: 'extract', duration: t1 - t0 })
    await setTimeout(Util.preset_action_delay.short)
    if (args.actions.includes('create')) {
      await Cell_Containerizer_manipulator!.fill(args.image_args!)
      await setTimeout(Util.preset_action_delay.short)
      await Cell_Containerizer_manipulator!.create()
      t0 = performance.now()
      await Cell_Containerizer_manipulator!.wait_until_completion_of_creation()
      t1 = performance.now()
      trial_result.push({ action: 'create', duration: t1 - t0 })
      await setTimeout(Util.preset_action_delay.short)
      await Cell_Containerizer_manipulator.close_successful_creation_popup()
    }
  }
  return trial_result
}

async function run_test(page: Page, pathname_prefix: Util.Pathname, args: Util.Cell_Containerizer_Manipulation_Arguments[]) {
  const execution_durations: Util.Cell_Result[] = []
  const indices_of_cells_to_test = Array.from({ length: args.length - 1 }, (_, i) => 1 + 1 * i).concat([ 0 ])
  for (const index of indices_of_cells_to_test) {
    for (const action of args[index]!.actions) { execution_durations.push({ ID: index, action: action, duration: [] }) }
  }
  Cell_Containerizer_manipulator = new Cell_Containerizer_Manipulator(page)
  text_editor_manipulator = new Text_Editor_Manipulator(page, file_browser_manipulator, running_session_manipulator, Cell_Containerizer_manipulator)
  for (let r = 0; r < repetition_count; r++) {
    let CSV_cursor = 0
    logger.info(`Repetition ${r + 1}/${repetition_count}`)
    const modified_pathname = pathname_prefix + `.${r}.ipynb`
    await text_editor_manipulator.open(modified_pathname)
    await Cell_Containerizer_manipulator.init()
    for (const index of indices_of_cells_to_test) {
      const trial_results = await test_single_cell(index, args[index]!)
      for (const result of trial_results) {
        execution_durations[CSV_cursor]!.duration[r] = result.duration
        CSV_cursor++
      }
    }
    await text_editor_manipulator.close_all()
    await setTimeout(Util.preset_action_delay.short)
  }
  await Util.save_Cell_Results(`${result_root}/${log_filename_prefix}.time.csv`, execution_durations)
}

test('D1', async ({ page }) => {
  const pathname_prefix = 'D1'
  const args_set = notebook_test_args[pathname_prefix]!
  await run_test(page, `${pathname_prefix}`, args_set)
})