import { test, expect, type Page, type Locator } from '@playwright/test'
import log, { type Logger, type LogLevel } from 'loglevel'
import Node_Path from 'node:path'
import { setTimeout } from "node:timers/promises";

type Milliseconds = number
type Pathname = string
type Segmented_Pathname = Pathname[]
type TypeScript_Identifier = string
type Logger_Map = { [key: TypeScript_Identifier]: Logger }
type Delay_Map = { [key: string]: Milliseconds | Delay_Map }
type File_Info = { [key: Pathname]: Pathname } & { name: Pathname, path: Pathname }
type Supported_Variable_Types = "Integer" | "Float" | "String" | "List"
type Cell_Containerizer_Manipulation_Arguments = {
  [key: string]: string | { [key: string]: string }
} & {
  inputs?: { [key: string]: Supported_Variable_Types },
  outputs?: { [key: string]: Supported_Variable_Types },
  parameters?: { [key: string]: Supported_Variable_Types },
  dependencies: string[]
}

const default_action_delay: Milliseconds = 1_000

const original_log_method_factory = log.methodFactory
log.methodFactory = (log_method_name, log_level, logger_name) => {
  const raw = original_log_method_factory(log_method_name, log_level, logger_name)
  return (...args) => {
    const time_point = new Date().toISOString()
    const severity = log_method_name === 'error' ? 'ERROR' : log_method_name === 'warn' ? 'Warning' : log_method_name
    raw(`[${time_point}] [${severity}] [${String(logger_name)}]`, ...args)
  }
}

// async function action_with_delay(action: () => Promise<any>, delay: Milliseconds | null = 1_000) {
//   await action()
//   if (delay == null) { delay = 0 }
//   await setTimeout(delay)
// }

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
    this.file_browser_tab_icon = this.file_browser_tab.locator('path') // Locate the only clickable child
    while (await this.visible() === false) { await this.toggle() } // To let File Browser Section be loaded [otherwise the tests will be stuck and finally timeout]
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
    File_Browser_Manipulator.logger[this.toggle.name]!.info(`Toggling the file browser tab...`)
    // await action_with_delay(async () => await this.file_browser_tab_icon.click(), 250)
    await this.file_browser_tab_icon.click()
    await setTimeout(250)
    File_Browser_Manipulator.logger[this.toggle.name]!.info('File browser tab clicked')
  }

  public async current_directory(): Promise<string> {
    while (await this.visible() === false) { await this.toggle() }
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

  public async go_home(delay: Milliseconds) { // Go to the home directory
    while (await this.visible() === false) { await this.toggle() }
    File_Browser_Manipulator.logger[this.go_home.name]!.info('Going back home...')
    do {
      // await action_with_delay(async () => await this.home_dir_icon.click(), delay)
      await this.home_dir_icon.click()
      await setTimeout(delay)
      File_Browser_Manipulator.logger[this.go_home.name]!.info('Home dir icon clicked')
    } while (await this.current_directory() !== '/')
  }

  public async open(path: Pathname, home_as_relative_root: boolean = false, delay: Delay_Map = {}): Promise<void> { // Go to the designated directory
    File_Browser_Manipulator.logger[this.open.name]!.info(`Dest: ${path}`)
    const path_segments = File_Browser_Manipulator.segmented_path(path)
    if (await this.visible() === false) { await this.file_browser_tab_icon.click() }
    if (home_as_relative_root) { await this.go_home(delay[this.go_home.name] as number) }
    const target_path: string[] = []
    for (const [ index, segment ] of path_segments.entries()) {
      File_Browser_Manipulator.logger[this.open.name]!.info(`Entering ${segment}...`)
      const entry = file_browser_manipulator.file_list.locator(`[title^="Name: ${segment}"]`)
      if (index < path_segments.length - 1) {
        if (await entry.getAttribute('data-isdir') === 'false') { throw new Error(`Non-leaf file system node ${segment} is not a directory`) }
      } else {
        // await action_with_delay(async () => await entry.dblclick())
        await entry.dblclick()
        await setTimeout(default_action_delay)
        break
      }
      target_path.push(segment)
      do {
        // await action_with_delay(async () => await entry.dblclick())
        await entry.dblclick()
        await setTimeout(default_action_delay)

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
  public running_sessions_tab_icon!: Locator
  public running_sessions_section!: Locator

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
    this.running_sessions_tab_icon = this.running_sessions_tab.locator('path')

  }

  public async close_all_tabs() {

  }

  public async shut_down_all_kernels() {

  }
}

class Text_Editor_Manipulator {
  private static logger: Logger_Map = {}

  public page!: Page
  public file_browser_manipulator!: File_Browser_Manipulator
  public running_session_manipulator!: Running_Session_Manipulator
  public main!: Locator
  public tab_list!: Locator // Reference changes once all tabs are closed and the new launcher is automatically present again
  public associated_file: string = ''
  public tab_panel!: Locator // Reference changes if the same file is closed and open again
  public notebook_content_region!: Locator
  public cells_under_test: Locator[] = []

  static {
    const instance_members = Object.getOwnPropertyNames(Text_Editor_Manipulator.prototype)
    for (const member of instance_members) { Text_Editor_Manipulator.logger[member] = log.getLogger(`${Text_Editor_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page, file_browser_manipulator: File_Browser_Manipulator) {
    this.page = page
    this.file_browser_manipulator = file_browser_manipulator
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
    const re = /^#(.*)# ([0-9A-Fa-f]{16,})( \[rpt \d+])?\s*$/m // Currently, every cell under test is marked with 1st-line comments with a suffix with 16-digit hex and for nth repetition explicitly stated
    const cells = await this.notebook_content_region.locator('> *').all()
    this.cells_under_test = []
    for (const cell of cells) {
      const content = await cell.innerText()
      if (content.match(re)) { this.cells_under_test.push(cell) }
    }
  }

  public async close() {

  }
}

class Cell_Containerizer_Manipulator {
  private static logger: Logger_Map = {}

  public page!: Page
  public main_sidebar!: Locator

  static {

  }

  public constructor(page: Page) {

  }

  public async init() {

  }
}

// log.setLevel('info')

const test_root: string = 'tmp/rmd' // All the test files should be placed here

const repetition_count = 10

var file_browser_manipulator: File_Browser_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  await file_browser_manipulator.open(test_root, true, { 'go_home': 2_500, })
  expect(File_Browser_Manipulator.identical_Pathname(test_root, await file_browser_manipulator.current_directory())).toBeTruthy()
})

// test('sample test', async ({ page }) => {
//   await expect(page).toHaveTitle(/JupyterLab/)
// })

var text_editor_manipulator: Text_Editor_Manipulator

test('D1', async ({ page }) => {
  text_editor_manipulator = new Text_Editor_Manipulator(page, file_browser_manipulator)
  await text_editor_manipulator.open('D1.0.ipynb')
  expect(text_editor_manipulator.cells_under_test.length).toEqual(4)
})