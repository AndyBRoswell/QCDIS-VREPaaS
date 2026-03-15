import { test, expect, Page, Locator } from '@playwright/test'
import log from 'loglevel'

log.setLevel('info')

class File_Browser_Manipulator {
  public page: Page
  public main_sidebar!: Locator
  public file_browser_tab!: Locator
  public file_browser_icon!: Locator
  public file_browser_section!: Locator
  public home_dir_icon!: Locator
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
  }

  public async toggle() {
    await this.file_browser_icon.click()
    log.info('File browser tab clicked')
  }

  public async visible(): Promise<boolean> {
    log.info(`Detecting if this file browser tab is visible...`)
    let r: boolean = await this.file_browser_tab.getAttribute('aria-selected') === 'true'
    log.info(r)
    return r
  }

  public async go_home() {
    while (await this.visible() === false) { await this.toggle() }
    await this.home_dir_icon.click()
    log.info('Home dir icon clicked')
  }

  // public async goto(oath: string) {
  //   const test_file_root_entry = file_browser_manipulator.file_list.locator('[title^="Name: "]')
  // }
}

var file_browser_manipulator: File_Browser_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  // await page.waitForTimeout(2_000) // Just for debug purposes
  await file_browser_manipulator.go_home()
})

test('sample test', async ({ page }) => {
  await expect(page).toHaveTitle('JupyterLab')
  await page.waitForTimeout(5_000) // Just for debug purposes
})

// test('rmd/D1', async ({ page }) => {
//
// })