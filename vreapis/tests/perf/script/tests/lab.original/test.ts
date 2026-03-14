import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab')
  const main_sidebar = page.getByRole('complementary', { name: 'main sidebar' })
  const Running_Terminals_and_Kernels_icon = main_sidebar.locator(`[data-id="jp-running-sessions"]`)
  await Running_Terminals_and_Kernels_icon.click()
  const file_browser_icon = main_sidebar.locator(`[data-id="filebrowser"]`)
  await file_browser_icon.click()
  const file_browser = page.getByRole('region', { name: 'File Browser Section' })
  const home_dir_icon = file_browser.locator(`[data-icon="ui-components:folder"]`).first().locator('path') // locate the only child with click event handler
  await page.waitForTimeout(5_000)
  await home_dir_icon.click()
})

test('rmd/D1', async ({ page }) => {
  await expect(page).toHaveTitle('JupyterLab')
  await page.waitForTimeout(10_000)
})