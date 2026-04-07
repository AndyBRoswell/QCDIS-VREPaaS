import { setTimeout } from "node:timers/promises";
import { expect, type FrameLocator, type Locator, type Page, test } from '@playwright/test'
import log from "loglevel";

import * as Util from '../util'

class File_Browser_Manipulator {
  private static logger: Util.Logger_Map = {}

  public page!: Page
  public region_TabSet2!: Locator
  public button_Minimize_or_Maximize_or_Restore_Tabset2!: Locator[]
  public tablist_TabSet2!: Locator
  public tab_files!: Locator
  public tabpanel_Files!: Locator
  public Selected_path_breadcrumb!: Locator
  public home_link!: Locator
  public path_indicator!: Locator
  public home: Util.Pathname = '~'
  public file_list_header!: Locator
  public file_list!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(File_Browser_Manipulator.prototype)
    for (const member of instance_members) { File_Browser_Manipulator.logger[member] = log.getLogger(`${File_Browser_Manipulator.name}.${member}`) }
    // File_Browser_Manipulator.logger['init']!.setLevel('info')
  }

  public constructor(page: Page) {
    this.page = page
  }

  public async init() {
    this.region_TabSet2 = this.page.getByRole('region', { name: /^TabSet2/ })
    this.button_Minimize_or_Maximize_or_Restore_Tabset2 = await this.region_TabSet2.getByRole('button', { name: /(Minimize|Maximize|Restore) TabSet2/ }).all()
    for (const button of this.button_Minimize_or_Maximize_or_Restore_Tabset2) {
      if (await button.getAttribute('aria-label') === 'Maximize TabSet2') {
        await button.click() // Maximize file browser to make the UI as similar to JupyterLab [file browser + editor] as possible.
        await setTimeout(Util.preset_action_delay.medium)
        this.region_TabSet2 = this.page.getByRole('region', { name: /^TabSet2/ }) // Re-locate the region after maximizing since the DOM has changed
      }
    }
    this.tablist_TabSet2 = this.region_TabSet2.getByRole('tablist', { name: 'TabSet2' })
    this.tab_files = this.tablist_TabSet2.locator('[role="tab"][aria-controls="rstudio_workbench_panel_files"]')
    await this.toggle()
    this.tabpanel_Files = this.region_TabSet2.getByRole('tabpanel', { name: 'Files' })
    // await this.tabpanel_Files.waitFor()
    // File_Browser_Manipulator.logger[this.init.name]!.info('Located this.tabpanel_Files')
    this.Selected_path_breadcrumb = this.tabpanel_Files.getByLabel('Selected path breadcrumb')
    File_Browser_Manipulator.logger[this.init.name]!.info(`Selected_path_breadcrumb.textContent(): ${await this.Selected_path_breadcrumb.textContent()}`)
    this.path_indicator = this.Selected_path_breadcrumb.locator('[aria-current="location"]')
    File_Browser_Manipulator.logger[this.init.name]!.info(`path_indicator: ${await this.path_indicator.textContent()}`)
    const parent_of_path_indicator = this.path_indicator.locator('xpath=../..')
    this.home_link = parent_of_path_indicator.getByRole('link').first()
    this.home = await this.home_link.getAttribute('title') as string
    const tables = await this.tabpanel_Files.getByRole('table').all()
    for (const table of tables) {
      const table_headers = await table.locator('th').all()
      if (table_headers.length > 0) { this.file_list_header = table } else { this.file_list = table }
    }
  }

  public async visible(): Promise<boolean> {
    return await this.tab_files.getAttribute('aria-selected') === 'true'
  }

  public async toggle() {
    while (await this.visible() === false) {
      await this.tab_files.click()
      await setTimeout(Util.preset_action_delay.short)
    }
  }

  public async current_directory(): Promise<Util.Pathname> {
    await this.toggle()
    const r = await this.path_indicator.getAttribute('title') as string
    return r
  }

  public async go_home(delay: Util.Milliseconds = Util.preset_action_delay.medium) { // Go to the home directory
    await this.toggle()
    do {
      await this.home_link.click()
      await setTimeout(delay)
    } while (await this.current_directory() !== this.home)
  }

  public async open(path: Util.Pathname, home_as_relative_root: boolean = false): Promise<void> { // Go to the designated directory
    const path_segments = Util.Pathname_Operator.segmented_Pathname(path)
    await this.toggle()
    if (home_as_relative_root) { await this.go_home() }
    for (const [ index, segment ] of path_segments.entries()) {
      const entry = this.file_list.getByText(segment, { exact: true })
      await entry.click()
      await setTimeout(Util.preset_action_delay.medium)
    }
  }
}

class Text_Editor_Manipulator {
  private static logger: Util.Logger_Map = {}

  public page!: Page
  public HTML_body!: Locator
  public file_browser_manipulator!: File_Browser_Manipulator
  public region_Source!: Locator
  public tab_list!: Locator
  public current_tab!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(Text_Editor_Manipulator.prototype)
    for (const member of instance_members) { Text_Editor_Manipulator.logger[member] = log.getLogger(`${Text_Editor_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page, file_browser_manipulator: File_Browser_Manipulator) {
    this.page = page
    this.HTML_body = page.locator('body')
    this.file_browser_manipulator = file_browser_manipulator
    this.region_Source = this.page.getByRole('region', { name: /^Source/ })
  }

  public async get_current_tab(): Promise<Util.File_Info> { // Get the pathname corresponding to the focused tab
    this.tab_list = this.region_Source.getByRole('tablist')
    const tab_count = await this.tab_list.count()
    if (tab_count === 0) { return { name: '', path: '' } }
    this.current_tab = this.tab_list.locator('[aria-selected="true"]')
    const tab = this.current_tab.locator('table[title]')
    const path = await tab.getAttribute('title') as string
    const tab_text = await tab.textContent() as string
    const name = tab_text.substring(0, tab_text.length - '*'.length) // remove the trailing `*`
    return { name: name, path: path }
  }

  public async open(pathname: Util.Pathname): Promise<Util.File_Info> {
    await this.file_browser_manipulator.open(pathname)
    this.region_Source = this.page.getByRole('region', { name: /^Source/ }) // Re-locate the region after opening a file since the DOM has changed
    const maximize_button = this.region_Source.getByRole('button', { name: "Maximize Source" })
    if (await maximize_button.count() > 0) {
      await maximize_button.click()
      await setTimeout(Util.preset_action_delay.medium)
      this.region_Source = this.page.getByRole('region', { name: /^Source/ }) // Re-locate the region after maximizing since the DOM has changed
    }
    return await this.get_current_tab()
  }

  public async close_all() {
    await this.current_tab.click({ button: 'right' })
    // const context_menu = this.HTML_body.locator('[aria-activedescendant]') // I don't know why this can't locate the menu
    // const item_Close_All = context_menu.getByText('Close All', { exact: true })
    const item_Close_All = this.HTML_body.getByRole('menuitem').filter({ hasText: /Close All$/ })
    await setTimeout(Util.preset_action_delay.medium)
    await item_Close_All.click()
  }
}

class Cell_Containerizer_Manipulator {
  private static logger: Util.Logger_Map = {}

  public page!: Page
  public HTML_body!: Locator
  public toolbar!: Locator
  public button_Addins!: Locator
  public menuitem_CellContainerizer!: Locator
  public region_TabSet2!: Locator
  public button_Minimize_or_Maximize_or_Restore_Tabset2!: Locator[]
  public tablist_TabSet2!: Locator
  public tab_viewer!: Locator
  public tabpanel_Viewer!: Locator
  public toolbar_Viewer_Tab!: Locator
  public Cell_Containerizer!: FrameLocator
  public button_Parse!: Locator
  public doc_info_output!: Locator
  public button_Create!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(Cell_Containerizer_Manipulator.prototype)
    for (const member of instance_members) { Cell_Containerizer_Manipulator.logger[member] = log.getLogger(`${Cell_Containerizer_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page) {
    this.page = page
    this.HTML_body = this.page.locator('body')
  }

  public async init() {
    this.toolbar = this.page.getByRole('toolbar', { name: 'Main' })
    this.button_Addins = this.toolbar.getByRole('button').filter({ hasText: /\s*Addins\s*/ })
    await this.button_Addins.click()
    await setTimeout(Util.preset_action_delay.short)
    this.menuitem_CellContainerizer = this.HTML_body.getByRole('menuitem').filter({ hasText: /^CellContainerizer$/ })
    await this.menuitem_CellContainerizer.click()
    await setTimeout(Util.preset_action_delay.short)
    this.region_TabSet2 = this.page.getByRole('region', { name: /^TabSet2/ })
    // this.button_Minimize_or_Maximize_or_Restore_Tabset2 = await this.region_TabSet2.getByRole('button', { name: /(Minimize|Maximize|Restore) TabSet2/ }).all()
    // for (const button of this.button_Minimize_or_Maximize_or_Restore_Tabset2) {
    //   if (await button.getAttribute('aria-label') === 'Maximize TabSet2') {
    //     await button.click() // Maximize cell containerizer to make the UI as similar to JupyterLab [file browser + editor] as possible.
    //     await setTimeout(Util.preset_action_delay.medium)
    //     this.region_TabSet2 = this.page.getByRole('region', { name: /^TabSet2/ }) // Re-locate the region after maximizing since the DOM has changed
    //   }
    // }
    this.tablist_TabSet2 = this.region_TabSet2.getByRole('tablist', { name: 'TabSet2' })
    this.tab_viewer = this.tablist_TabSet2.locator('[role="tab"][aria-controls="rstudio_workbench_panel_viewer"]')
    await this.toggle()
    this.tabpanel_Viewer = this.region_TabSet2.getByRole('tabpanel', { name: 'Viewer' })
    this.toolbar_Viewer_Tab = this.tabpanel_Viewer.getByRole('toolbar', { name: 'Viewer Tab' })
    this.Cell_Containerizer = this.tabpanel_Viewer.locator('iframe').contentFrame()
  }

  public async visible(): Promise<boolean> {
    return await this.tab_viewer.getAttribute('aria-selected') === 'true'
  }

  public async toggle() {
    while (await this.visible() === false) {
      await this.tab_viewer.click()
      await setTimeout(Util.preset_action_delay.short)
    }
  }

  public async parse() {
    this.button_Parse = this.Cell_Containerizer.getByRole('button').filter({ hasText: /^Parse$/ })
    await this.button_Parse.click()
    this.doc_info_output = this.Cell_Containerizer.locator('#doc_info_output')
    const doc_info = await this.doc_info_output.innerText()
    const re = /Document ID: .+\r?\nDocument Path: .+\r?\nParsing done/
    const match = doc_info.match(re)
    expect(match)
  }

  public async select_code_cell(index: number) {

  }

  public async fill_and_create(args: Util.Cell_Containerizer_Manipulation_Arguments) {
    await this.toggle()

  }

  public async close() {
    const button = this.toolbar_Viewer_Tab.getByRole('button', { name: 'Stop application' })
    await button.click()
  }
}

const test_root: Util.Pathname = 'tmp/rmd'

var file_browser_manipulator: File_Browser_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8787/')
  await expect(page).toHaveTitle('RStudio Sign In')
  const input_username = page.locator('input[name=username]')
  const input_password = page.locator('input[name=password]')
  const input_staySignedIn = page.locator('input[name=staySignedIn]')
  const button_submit = page.locator('button[type=submit]')
  await input_username.fill(process.env.RStudio_Server_Username!)
  await input_password.fill(process.env.RStudio_Server_Password!)
  await input_staySignedIn.check()
  await button_submit.click()
  await setTimeout(Util.preset_action_delay.extra_long)
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  await file_browser_manipulator.open(test_root, true)
  expect(Util.Pathname_Operator.normalize(test_root), Util.Pathname_Operator.normalize(await file_browser_manipulator.current_directory())).toBeTruthy()
})

// test('sample test', async ({ page }) => {
//   await expect(page).toHaveTitle('RStudio Server')
// })

var text_editor_manipulator: Text_Editor_Manipulator
var Cell_Containerizer_manipulator: Cell_Containerizer_Manipulator

test('D1', async ({ page }) => {
  text_editor_manipulator = new Text_Editor_Manipulator(page, file_browser_manipulator)
  await text_editor_manipulator.open('D1.0.Rmd')
  Cell_Containerizer_manipulator = new Cell_Containerizer_Manipulator(page)
  await Cell_Containerizer_manipulator.init()
  await Cell_Containerizer_manipulator.parse()
  await setTimeout(Util.preset_action_delay.long)
  await Cell_Containerizer_manipulator.close()
  await text_editor_manipulator.close_all()
  await setTimeout(Util.preset_action_delay.medium)
})