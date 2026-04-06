import { setTimeout } from "node:timers/promises";
import { expect, type Locator, type Page, test } from '@playwright/test'
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
  public location_element!: Locator

  static {
    const instance_members = Object.getOwnPropertyNames(File_Browser_Manipulator.prototype)
    for (const member of instance_members) { File_Browser_Manipulator.logger[member] = log.getLogger(`${File_Browser_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page) {
    this.page = page
  }

  public async init() {
    this.region_TabSet2 = this.page.getByRole('region', { name: 'TabSet2' })
    this.button_Minimize_or_Maximize_or_Restore_Tabset2 = await this.region_TabSet2.getByRole('button', { name: /(Minimize|Maximize|Restore) TabSet2/ }).all()
    for (const button of this.button_Minimize_or_Maximize_or_Restore_Tabset2) {
      if (await button.getAttribute('aria-label') === 'Maximize TabSet2') {
        await button.click() // Maximize file browser to make the UI as similar to JupyterLab [file browser + editor] as possible.
        await setTimeout(Util.preset_action_delay.medium)
      }
    }
    this.tablist_TabSet2 = this.region_TabSet2.getByRole('tablist', { name: 'TabSet2' })
    this.tab_files = this.tablist_TabSet2.locator('[role="tab"][aria-controls="rstudio_workbench_panel_files"]')
    await this.toggle()
    this.tabpanel_Files = this.region_TabSet2.getByRole('tabpanel', { name: 'Files' })
    this.Selected_path_breadcrumb = this.tabpanel_Files.getByLabel('Selected path breadcrumb')
    this.location_element = this.Selected_path_breadcrumb.getByLabel('[aria-current="location"]')
  }

  public async visible() {
    return await this.tab_files.getAttribute('aria-selected') === 'true'
  }

  public async toggle() {
    while (await this.visible() === false) {
      await this.tab_files.click()
      await setTimeout(Util.preset_action_delay.short)
    }
  }


}

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
  await setTimeout(Util.preset_action_delay.medium)
})

test('sample test', async ({ page }) => {
  await expect(page).toHaveTitle('RStudio Server')
})

// test('D1', async ({ page }) => {
//
// })