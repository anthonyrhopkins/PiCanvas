/**
 * Tests detail view scrolling with debug manifests (local build with CSS fix).
 */
import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL =
  'https://sap.sharepoint.com/sites/213105/SitePages/App.aspx?loadSPFX=true&debugManifestsFile=https://localhost:4321/temp/build/manifests.js';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function handleSSOLogin(page: Page): Promise<void> {
  if (page.url().includes('login.microsoftonline.com')) {
    const acct = page.locator('text=anthony.hopkins@sap.com').first();
    const any = page.locator('#tilesHolder div[tabindex="0"], .table div[role="link"]').first();
    if (await acct.isVisible({ timeout: 5_000 }).catch(() => false)) await acct.click();
    else if (await any.isVisible({ timeout: 3_000 }).catch(() => false)) await any.click();
    await page.waitForURL('**/sap.sharepoint.com/**', { timeout: 60_000 });
  }
}

async function acceptDebugScripts(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('button:has-text("Load debug scripts"), a:has-text("Load debug scripts")').first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(3_000);
      await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(3_000);
    } else break;
  }
  await page.waitForTimeout(5_000);
}

const test = base.extend<{ edgePage: Page }>({
  // eslint-disable-next-line no-empty-pattern
  edgePage: async ({}, use) => {
    const ctx: BrowserContext = await chromium.launchPersistentContext(EDGE_PROFILE_DIR, {
      channel: 'msedge', headless: false, ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const page = ctx.pages()[0] || await ctx.newPage();
    page.on('dialog', async d => await d.accept());
    await use(page);
    await ctx.close();
  },
});

test('detail view Method-K tab scrolls with debug build', async ({ edgePage: page }) => {
  test.setTimeout(120_000);

  // Navigate and load debug scripts
  await page.goto(SP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await handleSSOLogin(page);
  await page.waitForLoadState('load', { timeout: 60_000 });
  await acceptDebugScripts(page);

  // Click first company card
  const card = page.locator('.pr-company-card').first();
  await card.waitFor({ state: 'visible', timeout: 15_000 });
  await card.click();
  await page.waitForTimeout(3_000);

  // Click Method-K tab
  const methodTab = page.locator('text=Method-K').first();
  if (await methodTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await methodTab.click();
    await page.waitForTimeout(3_000);
    console.log('Clicked Method-K tab');
  } else {
    console.log('Method-K tab not found, staying on current tab');
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug-detail-methodk-top.png'), timeout: 15_000 }).catch(() => console.log('Screenshot timed out'));

  // Diagnostic
  const diag = await page.evaluate(() => {
    const detailBody = document.querySelector('.pr-detail-body') as HTMLElement;
    const detailView = document.querySelector('.pr-detail-view') as HTMLElement;
    const report = document.querySelector('.picanvas-profilereport') as HTMLElement;

    const info: Record<string, any> = {};
    for (const [name, el] of Object.entries({ detailBody, detailView, report })) {
      if (el) {
        const s = window.getComputedStyle(el);
        info[name] = {
          overflow: s.overflow, overflowY: s.overflowY,
          height: s.height, display: s.display,
          scrollH: el.scrollHeight, clientH: el.clientHeight,
        };
      }
    }

    // Try scrolling detailBody
    let scrollResult = { before: 0, after: 0 };
    if (detailBody) {
      scrollResult.before = detailBody.scrollTop;
      detailBody.scrollTop = 400;
      scrollResult.after = detailBody.scrollTop;
    }

    return { ...info, scrollResult };
  });

  console.log('Detail diagnostic:', JSON.stringify(diag, null, 2));

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug-detail-methodk-scrolled.png'), timeout: 15_000 }).catch(() => console.log('Screenshot timed out'));

  if (diag.scrollResult.after > diag.scrollResult.before) {
    console.log('PASS: Detail view scrolls!');
  } else {
    console.log('FAIL: Detail view still cannot scroll');
  }
});
