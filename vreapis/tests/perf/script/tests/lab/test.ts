import { test, expect, type Page, type Locator } from '@playwright/test'
import log from 'loglevel'
import Node_Path from 'node:path'

type Milliseconds = number
type Segmented_Path = string[]
type Delay_Map = {
  [key: string]: Milliseconds | Delay_Map
}

log.setLevel('info')

const test_root: string = 'tmp/rmd'

class File_Browser_Manipulator {
  public action_delay = 1_000

  public page: Page
  public main_sidebar!: Locator
  public file_browser_tab!: Locator
  public file_browser_icon!: Locator
  public file_browser_section!: Locator
  public home_dir_icon!: Locator
  public path_indicator!: Locator
  public file_list!: Locator

  public constructor(page: Page) {
    this.page = page
  }

  public async init() {
    this.main_sidebar = this.page.getByRole('complementary', { name: 'main sidebar' })
    this.file_browser_tab = this.main_sidebar.locator(`[data-id="filebrowser"]`)
    this.file_browser_icon = this.file_browser_tab.locator(`path`) // Locate the only clickable child
    while (await this.visible() === false) { await this.toggle() }
    this.file_browser_section = this.page.getByRole('region', { name: 'File Browser Section' }) // Locate the file browser
    this.file_list = this.file_browser_section.locator(`ul`) // Get the file list for tests
    this.home_dir_icon = this.file_browser_section.locator(`[data-icon="ui-components:folder"]`).first().locator('path')
    this.path_indicator = this.home_dir_icon.locator(`xpath=../../..`)
  }

  public async action_with_delay(action: () => Promise<any>, delay: Milliseconds | null = this.action_delay) {
    await action()
    if (delay == null) { delay = 0 }
    await this.page.waitForTimeout(delay)
  }

  public async visible(): Promise<boolean> {
    log.info(`Detecting if this file browser tab is visible...`)
    let r: boolean = await this.file_browser_tab.getAttribute('aria-selected') === 'true'
    log.info(r)
    return r
  }

  public async toggle() {
    log.info(`Toggling the file browser tab...`)
    await this.action_with_delay(async () => await this.file_browser_icon.click(), 250)
    log.info('File browser tab clicked')
  }

  public async current_directory(): Promise<string> {
    while (await this.visible() === false) { await this.toggle() }
    log.info(`Getting the current directory...`)
    const r: string = await this.path_indicator.textContent() as string
    log.info(r)
    return r
  }

  public static segmented_path(path: string): Segmented_Path { return path.split(Node_Path.sep).filter(Boolean) }

  public static identical(p: Segmented_Path, q: Segmented_Path): boolean {
    return p.length === q.length && p.every((value, index) => value === q[index])
  }

  public async go_home(delay: Milliseconds) {
    while (await this.visible() === false) { await this.toggle() }
    log.info('Going back home...')
    do {
      await this.action_with_delay(async () => await this.home_dir_icon.click(), delay)
      log.info('Home dir icon clicked')
    } while (await this.current_directory() !== '/')
  }

  public async goto(path: string, home_as_relative_root: boolean = false, delay: Delay_Map = {}): Promise<void> {
    log.info(`Dest: ${path}`)
    const path_segments = File_Browser_Manipulator.segmented_path(path)
    if (home_as_relative_root) { await this.go_home(delay['go_home'] as number) }
    const target_path: string[] = []
    for (const segment of path_segments) {
      log.info(`Entering ${segment}...`)
      const entry = file_browser_manipulator.file_list.locator(`[title^="Name: ${segment}"]`)
      target_path.push(segment)
      do {
        await this.action_with_delay(async () => await entry.dblclick())
      } while (File_Browser_Manipulator.identical(File_Browser_Manipulator.segmented_path(await this.current_directory()), target_path) === false)
      log.info(`Entered ${segment}`)
    }
    log.info(`Arrived at ${path}`)
  }
}

var file_browser_manipulator: File_Browser_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  await file_browser_manipulator.goto(test_root, true, { 'go_home': 2_000, })
  expect(
    File_Browser_Manipulator.identical(
      File_Browser_Manipulator.segmented_path(test_root),
      File_Browser_Manipulator.segmented_path(await file_browser_manipulator.current_directory())
    )
  ).toBeTruthy()
})

test('sample test', async ({ page }) => {
  await expect(page).toHaveTitle(/JupyterLab/)
  // await page.waitForTimeout(5_000) // Just for debug purposes
})

// test('rmd/D1', async ({ page }) => {
//
// })