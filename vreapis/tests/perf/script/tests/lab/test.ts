import { type ConsoleMessage, expect, type Locator, type Page, test } from '@playwright/test'
import log from 'loglevel'
import { setTimeout } from "node:timers/promises";
import * as Util from '../util'
import { notebook_test_args } from "../containerizer_test_args";
import node_fs_promises from 'node:fs/promises'
import node_os from "node:os";

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
    const seg = await this.path_indicator.locator('[title]').all()
    if (seg.length == 1) { return '/' } // only 1 that shows the full pathname of home
    else { return (await seg[seg.length - 1]!.getAttribute('title'))! }
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

  public async open(path: Util.Pathname, go_home: boolean = false): Promise<void> { // Go to the designated directory
    File_Browser_Manipulator.logger[this.open.name]!.info(`Dest: ${path}`)
    const path_segments = Util.Pathname_Operator.segmented_Pathname(path)
    await this.toggle()
    if (go_home) { await this.go_home() }
    const target_path: Util.Pathname[] = Util.Pathname_Operator.segmented_Pathname(await this.current_directory())
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

// Measuring execution durations directly in Playwright seems to work normally for JupyterLab-ver. But for RStudio-ver the measured results are obviously much shorter than the actual ones. So we directly pick the durations measured inside both versions of Cell Containerizer.
class DevTools_Console_Handler {
  private filtered_message: string[] = []

  constructor(private page: Page) {}

  public handler
    = (msg: ConsoleMessage) => {
    if (msg.type() === 'log' && msg.text().match(/\s+done in (\d+(\.\d+)?)\s*ms/)) {
      this.filtered_message.push(msg.text())
    }
  }

  public init() { this.page.on('console', this.handler) }

  public clear_filtered_message() { this.filtered_message.length = 0 }

  public async save_filtered_message(pathname: Util.Pathname) {
    await node_fs_promises.writeFile(pathname, this.filtered_message.join(node_os.EOL))
  }
}

const logger = log.getLogger('test')
logger.setLevel('info')

const test_root: Util.Pathname = 'tmp/rmd' // All the test files should be placed here
const repetition_count = 10
const default_performance_sample_interval = 0.5
const result_root = 'log'

let file_browser_manipulator: File_Browser_Manipulator;
let running_session_manipulator: Running_Session_Manipulator;
let console_handler: DevTools_Console_Handler;

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  running_session_manipulator = new Running_Session_Manipulator(page)
  await running_session_manipulator.init()
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  await setTimeout(Util.preset_action_delay.long)
  // await file_browser_manipulator.open(test_root, true)
  // expect(Util.Pathname_Operator.identical_Pathname(test_root, await file_browser_manipulator.current_directory())).toBeTruthy()
})

test.afterEach(async ({ page }) => {
  const exit_code = await Util.Control.stop_monitor()
  expect(exit_code).toEqual(0)
})

// test('sample test', async ({ page }) => {
//   await expect(page).toHaveTitle(/JupyterLab/)
// })

let Cell_Containerizer_manipulator: Cell_Containerizer_Manipulator
let text_editor_manipulator: Text_Editor_Manipulator

async function test_single_cell(index: number, args: Util.Cell_Containerizer_Manipulation_Arguments) {
  if (args.actions.includes('extract')) {
    await text_editor_manipulator!.select_code_cell(index)
    await Cell_Containerizer_manipulator!.wait_until_completion_of_analysis()
    await setTimeout(Util.preset_action_delay.short)
    if (args.actions.includes('create')) {
      await Cell_Containerizer_manipulator!.fill(args.image_args!)
      await setTimeout(Util.preset_action_delay.short)
      await Cell_Containerizer_manipulator!.create()
      await Cell_Containerizer_manipulator.wait_until_completion_of_creation()
      await setTimeout(Util.preset_action_delay.short)
      await Cell_Containerizer_manipulator.close_successful_creation_popup()
    }
  }
}

const platform_specific_file_extension = process.env['notebook_platform'] !== undefined ? `.${process.env['notebook_platform']}` : ''
const delay_before_1st_repetition = 5_000

async function run_test(page: Page, pathname_prefix: Util.Pathname, args: Util.Cell_Containerizer_Manipulation_Arguments[]) {
  const indices_of_cells_to_test = Array.from({ length: args.length - 1 }, (_, i) => 1 + 1 * i).concat([ 0 ])
  Cell_Containerizer_manipulator = new Cell_Containerizer_Manipulator(page)
  text_editor_manipulator = new Text_Editor_Manipulator(page, file_browser_manipulator, running_session_manipulator, Cell_Containerizer_manipulator)
  console_handler = new DevTools_Console_Handler(page)
  console_handler.init()
  logger.info(`Waiting for ${delay_before_1st_repetition} ms to let CPU/mem usage stabilize...`)
  await setTimeout(delay_before_1st_repetition) // wait for a short while to let CPU/mem usage stabilize
  await start_pf_mon(pathname_prefix)
  for (let r = 0; r < repetition_count; r++) {
    logger.info(`Repetition ${r + 1}/${repetition_count}`)
    await file_browser_manipulator.open(test_root, true)
    expect(Util.Pathname_Operator.identical_Pathname(test_root, await file_browser_manipulator.current_directory())).toBeTruthy()
    const modified_pathname = pathname_prefix + `.${r}.ipynb`
    await text_editor_manipulator.open(modified_pathname)
    await Cell_Containerizer_manipulator.init()
    for (const index of indices_of_cells_to_test) {
      await test_single_cell(index, args[index]!)
    }
    await text_editor_manipulator.close_all()
    await setTimeout(Util.preset_action_delay.short)
  }
  await console_handler.save_filtered_message(`${result_root}/${pathname_prefix}${platform_specific_file_extension}.con.log`)
}

async function start_pf_mon(log_filename_prefix: Util.Pathname) {
  await Util.Control.launch_performance_monitor({
    browser: true,
    JupyterLab_backend: true,
    RStudio_backend: false,
    vreapi_process: process.env['notebook_platform'] !== 'lab.original',
    database_process: process.env['notebook_platform'] !== 'lab.original',
    interval: default_performance_sample_interval,
    control_channel: true,
    console_output: false,
    file_output: true,
    log_filename_prefix: `${log_filename_prefix}${platform_specific_file_extension}.util`
  })
  logger.debug(`Performance monitor PID: ${Util.Control.get_monitor_script_PID()}. Control channel: ${Util.Control.get_control_channel_pathname()}`)
  await Util.Control.start_monitor()
}

async function main(page: Page, pathname_prefix: Util.Pathname) {
  const args_set = notebook_test_args[pathname_prefix]!
  await run_test(page, `${pathname_prefix}`, args_set)
}

test('D1', { tag: [ '@D1', ] }, async ({ page }) => {
  const pathname_prefix = 'D1'
  await main(page, pathname_prefix)
})

test('port/dependency_with_submodule.notebook', { tag: [ '@port/dependency_with_submodule.notebook', ] }, async ({ page }) => {
  const pathname_prefix = 'port/dependency_with_submodule.notebook'
  await main(page, pathname_prefix)
})

test('port/R-notebook', { tag: [ '@port/R-notebook', ] }, async ({ page }) => {
  const pathname_prefix = 'port/R-notebook'
  await main(page, pathname_prefix)
})

test('port/test_!', { tag: [ '@port/test_!', ] }, async ({ page }) => {
  const pathname_prefix = 'port/test_!'
  await main(page, pathname_prefix)
})

test('port/test_conf_nesting', { tag: [ '@port/test_conf_nesting', ] }, async ({ page }) => {
  const pathname_prefix = 'port/test_conf_nesting'
  await main(page, pathname_prefix)
})

test('port/test_param_in_cell_notebook', { tag: [ '@port/test_param_in_cell_notebook', ] }, async ({ page }) => {
  const pathname_prefix = 'port/test_param_in_cell_notebook'
  await main(page, pathname_prefix)
})

test('power-in-my-room', { tag: [ '@power-in-my-room', ] }, async ({ page }) => {
  const pathname_prefix = 'power-in-my-room'
  await main(page, pathname_prefix)
})

test('exynos-7420-power-curves', { tag: [ '@exynos-7420-power-curves', ] }, async ({ page }) => {
  const pathname_prefix = 'exynos-7420-power-curves'
  await main(page, pathname_prefix)
})

test('equal-loudness-curve', { tag: [ '@equal-loudness-curve', ] }, async ({ page }) => {
  const pathname_prefix = 'equal-loudness-curve'
  await main(page, pathname_prefix)
})