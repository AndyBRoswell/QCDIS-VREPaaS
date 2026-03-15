import { test, expect } from '@playwright/test'

var main_sidebar
var file_browser_icon
var file_browser_section
var home_dir_icon
var file_list

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab') // Use the local JupyterLab instance to reduce measuring errors
  main_sidebar = page.getByRole('complementary', { name: 'main sidebar' })
  const Running_Terminals_and_Kernels_sidebar_icon = main_sidebar.locator(`[data-id="jp-running-sessions"]`)
  await Running_Terminals_and_Kernels_sidebar_icon.click() // Click elsewhere on the main sidebar before the click on file browser icon to make the latter click catchable by playwright
  file_browser_icon = main_sidebar.locator(`[data-id="filebrowser"]`)
  file_browser_icon.click()
  file_browser_section = page.getByRole('region', { name: 'File Browser Section' }) // Locate the file browser
  file_list = file_browser_section.locator(`ul`) // Get the file list for tests
  home_dir_icon = file_browser_section.locator(`[data-icon="ui-components:folder"]`).first().locator('path') // Locate the only child with click event handler
  await page.waitForTimeout(5_000) // Just for debug purposes
  await home_dir_icon.click() // Go back to the home directory
  // const test_file_root_entry = file_list.getByTitle()
})

test('sample test', async ({ page }) => {
  await expect(page).toHaveTitle('JupyterLab')
})

test('rmd/D1', async ({ page }) => {

})