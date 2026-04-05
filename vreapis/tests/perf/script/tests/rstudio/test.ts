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

  static {
    const instance_members = Object.getOwnPropertyNames(File_Browser_Manipulator.prototype)
    for (const member of instance_members) { File_Browser_Manipulator.logger[member] = log.getLogger(`${File_Browser_Manipulator.name}.${member}`) }
  }

  public constructor(page: Page) {
    this.page = page
  }

  public async init() {
    this.region_TabSet2 = this.page.getByRole('region', { name: 'TabSet2' })
    this.button_Minimize_or_Maximize_or_Restore_Tabset2 = await this.page.getByRole('button', { name: /(Minimize|Maximize|Restore) TabSet2/ }).all()
    for (const button of this.button_Minimize_or_Maximize_or_Restore_Tabset2) {
      if (await button.getAttribute('aria-label') === 'Maximize TabSet2') {
        await button.click() // Maximize file browser to make the UI as similar to JupyterLab [file browser + editor] as possible.
        await setTimeout(Util.preset_action_delay.medium)
      }
    }
  }

  public async visible() {

  }

  public async toggle() {

  }
}

var file_browser_manipulator: File_Browser_Manipulator

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8787/')
  file_browser_manipulator = new File_Browser_Manipulator(page)
  await file_browser_manipulator.init()
  await setTimeout(Util.preset_action_delay.long)
})

test('sample test', async ({ page }) => {
  await expect(page).toHaveTitle('RStudio Server')
})

// test('D1', async ({ page }) => {
//
// })