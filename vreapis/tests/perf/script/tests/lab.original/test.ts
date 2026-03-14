import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8888/lab');
  const main_sidebar = page.getByRole('complementary', { name: 'main sidebar' });
  // await main_sidebar.waitFor({ state: "visible" })
  const file_browser_icon = main_sidebar.getByRole('tab').filter({ has: page.locator(`[data-id="filebrowser"]`) });
  await file_browser_icon.click();
  const file_browser = page.getByRole('region', { name: 'File Browser Section' });
  // await file_browser.waitFor({ state: "visible" })
  const home_dir_icon = file_browser.locator(`[data-icon="ui-components:folder"]`).first();
  await home_dir_icon.click();
})

test('rmd/D1', async ({ page }) => {
  await expect(page).toHaveTitle('JupyterLab')
})