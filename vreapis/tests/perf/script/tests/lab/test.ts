import { test, expect, Page } from '@playwright/test'

class File_Browser_Manipulator {
  public main_sidebar
  public file_browser_icon
  public file_browser_section
  public home_dir_icon
  public file_list

  public constructor(page: Page) {
    this.main_sidebar = page.getByRole('complementary', { name: 'main sidebar' })
    const Running_Terminals_and_Kernels_sidebar_icon = this.main_sidebar.locator(`[data-id="jp-running-sessions"]`)
    Running_Terminals_and_Kernels_sidebar_icon.click() // Click elsewhere on the main sidebar before the click on file browser icon to make the latter click catchable by playwright
    this.file_browser_icon = this.main_sidebar.locator(`[data-id="filebrowser"]`)
    this.file_browser_section = page.getByRole('region', { name: 'File Browser Section' }) // Locate the file browser
    this.file_list = this.file_browser_section.locator(`ul`) // Get the file list for tests
    this.home_dir_icon = this.file_browser_section.locator(`[data-icon="ui-components:folder"]`).first().locator('path') // Locate the only child with click event handler
  }

  public async toggle() {
    await this.file_browser_icon.click()
  }

  public async go_home() {
    await this.home_dir_icon.click()
  }

  // public async goto(oath: string) {
  //   const test_file_root_entry = file_browser_manipulator.file_list.locator('[title^="Name: "]')
  // }
}

var file_browser_manipulator: File_Browser_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  file_browser_manipulator = new File_Browser_Manipulator(page)
  // await page.waitForTimeout(5_000) // Just for debug purposes
  await file_browser_manipulator.go_home()
  await page.waitForTimeout(5_000) // Just for debug purposes
})

test('sample test', async ({ page }) => {
  await expect(page).toHaveTitle('JupyterLab')
})

test('rmd/D1', async ({ page }) => {

})