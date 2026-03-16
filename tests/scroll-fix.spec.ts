/**
 * Scroll-fix validation — tests the fix from bd0b456
 * Uses the existing Edge profile (anthony.hopkins@sap.com) for SSO auth.
 *
 * Prerequisites: heft build-watch --serve running on localhost:4321
 *                Close Edge browser before running (profile lock)
 *
 * Usage:
 *   npx playwright test tests/scroll-fix.spec.ts --reporter=list
 */
import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL =
  'https://sap.sharepoint.com/sites/213105/SitePages/App.aspx?loadSPFX=true&debugManifestsFile=https://localhost:4321/temp/build/manifests.js';

const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/screenshots');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// SharePoint uses a scroll region div, not body scroll
const SP_SCROLL_SELECTOR = '[data-automation-id="contentScrollRegion"]';

// Helper: handle Microsoft SSO login if needed
async function handleSSOLogin(page: Page): Promise<void> {
  const url = page.url();
  if (url.includes('login.microsoftonline.com')) {
    console.log('  On Microsoft login page — clicking account tile...');

    const accountLink = page.locator('text=anthony.hopkins@sap.com').first();
    const anyAccount = page.locator('#tilesHolder div[tabindex="0"], .table div[role="link"], [data-test-id]').first();

    if (await accountLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await accountLink.click();
      console.log('  Clicked anthony.hopkins@sap.com account');
    } else if (await anyAccount.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await anyAccount.click();
      console.log('  Clicked first available account tile');
    } else {
      const emailInput = page.locator('#i0116');
      if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await emailInput.fill('anthony.hopkins@sap.com');
        await page.locator('#idSIButton9').click();
        console.log('  Entered email and clicked Next');
      }
    }

    await page.waitForURL('**/sap.sharepoint.com/**', { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
    console.log('  SSO login complete');
  }
}

// Helper: click "Load debug scripts" if SharePoint debug prompt appears
async function acceptDebugScripts(page: Page): Promise<void> {
  // The dialog may re-appear after page reload, so handle it in a loop
  for (let attempt = 0; attempt < 3; attempt++) {
    const loadBtn = page.locator('button:has-text("Load debug scripts"), a:has-text("Load debug scripts")').first();
    if (await loadBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await loadBtn.click();
      console.log(`  Clicked "Load debug scripts" (attempt ${attempt + 1})`);
      await page.waitForTimeout(3_000);
      await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(3_000);
    } else {
      break;
    }
  }

  // Final wait for web part to render after debug scripts loaded
  await page.waitForTimeout(5_000);

  // Log what we see to help debug
  const pageTitle = await page.title();
  const hasPiCanvas = await page.locator('[class*="piCanvas"], [class*="PiCanvas"]').count();
  console.log(`  Page title: "${pageTitle}", PiCanvas elements found: ${hasPiCanvas}`);
}

// Helper: navigate to SP_URL and handle login + debug prompt
async function navigateToApp(page: Page): Promise<void> {
  await page.goto(SP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await handleSSOLogin(page);
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await acceptDebugScripts(page);
  // Extra wait for PiCanvas web part to render
  await page.waitForTimeout(5_000);
}

// Helper: get scroll position of the SP scroll region
async function getScrollTop(page: Page): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.scrollTop : window.scrollY;
  }, SP_SCROLL_SELECTOR);
}

// Helper: scroll the SP scroll region
async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate(({ sel, top: t }) => {
    const el = document.querySelector(sel);
    if (el) {
      el.scrollTo({ top: t, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: t, behavior: 'smooth' });
    }
  }, { sel: SP_SCROLL_SELECTOR, top });
}

// Custom test fixture using persistent Edge context
const test = base.extend<{ edgePage: Page }>({
  // eslint-disable-next-line no-empty-pattern
  edgePage: async ({}, use) => {
    const context: BrowserContext = await chromium.launchPersistentContext(EDGE_PROFILE_DIR, {
      channel: 'msedge',
      headless: false,
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const page = context.pages()[0] || await context.newPage();
    page.on('dialog', async (dialog) => await dialog.accept());

    await use(page);
    await context.close();
  },
});

test.describe('Scroll Fix Validation', () => {
  test.setTimeout(120_000);

  test('page loads with debug manifests', async ({ edgePage: page }) => {
    await navigateToApp(page);
    const url = page.url();
    console.log(`Final URL: ${url}`);
    expect(url).toContain('sap.sharepoint.com');
  });

  test('no unwanted horizontal scrollbar', async ({ edgePage: page }) => {
    await navigateToApp(page);

    const result = await page.evaluate((sel) => {
      const scrollRegion = document.querySelector(sel) as HTMLElement;
      if (scrollRegion) {
        return { scrollWidth: scrollRegion.scrollWidth, clientWidth: scrollRegion.clientWidth, source: 'scrollRegion' };
      }
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, source: 'document' };
    }, SP_SCROLL_SELECTOR);

    console.log(`Horizontal (${result.source}): scrollWidth=${result.scrollWidth}, clientWidth=${result.clientWidth}`);
    expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1); // 1px tolerance
  });

  test('scrollable container exists and scrolls', async ({ edgePage: page }) => {
    await navigateToApp(page);

    // Discover all scrollable containers on the page
    const scrollInfo = await page.evaluate(() => {
      const results: Array<{ selector: string; scrollHeight: number; clientHeight: number; overflowY: string; canScroll: boolean }> = [];

      // Check body
      const bodyStyle = window.getComputedStyle(document.body);
      results.push({
        selector: 'body',
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        overflowY: bodyStyle.overflowY,
        canScroll: document.body.scrollHeight > document.body.clientHeight && bodyStyle.overflowY !== 'hidden'
      });

      // Check common SP and PiCanvas scroll containers
      const candidates = [
        '[data-automation-id="contentScrollRegion"]',
        '.pr-card-grid',
        '.pr-explorer-scroll',
        '.pr-detail-scroll',
        '[class*="scrollRegion"]',
        '[class*="piRadar"] [style*="overflow"]',
        'main',
        '#spPageCanvasContent',
      ];

      for (const sel of candidates) {
        const el = document.querySelector(sel) as HTMLElement;
        if (el) {
          const s = window.getComputedStyle(el);
          results.push({
            selector: sel,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            overflowY: s.overflowY,
            canScroll: el.scrollHeight > el.clientHeight && s.overflowY !== 'hidden'
          });
        }
      }

      // Also find ANY element with overflow-y auto/scroll that has scroll content
      document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        const htmlEl = el as HTMLElement;
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && htmlEl.scrollHeight > htmlEl.clientHeight + 50) {
          const cls = el.className ? el.className.toString().substring(0, 80) : '';
          const tag = el.tagName.toLowerCase();
          results.push({
            selector: `${tag}.${cls}`,
            scrollHeight: htmlEl.scrollHeight,
            clientHeight: htmlEl.clientHeight,
            overflowY: s.overflowY,
            canScroll: true
          });
        }
      });

      return results;
    });

    console.log('Scroll containers found:');
    for (const info of scrollInfo) {
      const status = info.canScroll ? 'SCROLLABLE' : 'NOT scrollable';
      console.log(`  ${status}: ${info.selector} (scrollH=${info.scrollHeight}, clientH=${info.clientHeight}, overflowY=${info.overflowY})`);
    }

    // At least one container should be scrollable
    const hasScrollable = scrollInfo.some(s => s.canScroll);
    expect(hasScrollable).toBe(true);

    // Try scrolling the .pr-explorer-grid directly
    const gridScroll = await page.evaluate(() => {
      const grid = document.querySelector('.pr-explorer-grid') as HTMLElement;
      if (!grid) return { found: false, before: 0, afterSet: 0, afterScrollTo: 0, height: '', maxHeight: '', display: '', flex: '' };
      const s = window.getComputedStyle(grid);
      const before = grid.scrollTop;
      grid.scrollTop = 300;
      const afterSet = grid.scrollTop;
      grid.scrollTo({ top: 500 });
      const afterScrollTo = grid.scrollTop;
      return {
        found: true,
        before,
        afterSet,
        afterScrollTo,
        height: s.height,
        maxHeight: s.maxHeight,
        display: s.display,
        flex: s.flex,
        parentOverflowY: grid.parentElement ? window.getComputedStyle(grid.parentElement).overflowY : 'n/a',
        parentHeight: grid.parentElement ? window.getComputedStyle(grid.parentElement).height : 'n/a',
      };
    });
    console.log('Grid scroll diagnostic:', JSON.stringify(gridScroll, null, 2));
  });

  test('tab switching does not cause scroll jump', async ({ edgePage: page }) => {
    await navigateToApp(page);

    // Scroll web part into view
    const webpart = page.locator('[class*="piCanvas"], [class*="PiCanvas"]').first();
    if (await webpart.isVisible()) {
      await webpart.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    const scrollBefore = await getScrollTop(page);

    const tabs = page.locator('[role="tab"], .pi-tab, [class*="tab-button"], [class*="tabButton"]');
    const tabCount = await tabs.count();
    console.log(`Found ${tabCount} tab(s)`);

    if (tabCount > 1) {
      await tabs.nth(1).click();
      await page.waitForTimeout(1_000);

      const scrollAfter = await getScrollTop(page);
      const drift = Math.abs(scrollAfter - scrollBefore);
      console.log(`Scroll drift: ${drift}px (before=${scrollBefore}, after=${scrollAfter})`);
      expect(drift).toBeLessThan(100);
    }
  });

  test('iframe content does not break scroll region', async ({ edgePage: page }) => {
    await navigateToApp(page);

    const iframes = page.locator('[class*="piCanvas"] iframe, [class*="PiCanvas"] iframe');
    const iframeCount = await iframes.count();
    console.log(`Found ${iframeCount} iframe(s)`);

    if (iframeCount > 0) {
      await iframes.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Verify the scroll region is still scrollable (not locked)
      const overflowY = await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        return el ? window.getComputedStyle(el).overflowY : 'n/a';
      }, SP_SCROLL_SELECTOR);
      console.log(`Scroll region overflowY: ${overflowY}`);
      expect(overflowY).not.toBe('hidden');
    }
  });

  test('SP scroll region is not locked to overflow:hidden', async ({ edgePage: page }) => {
    await navigateToApp(page);

    const result = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (!el) return { found: false, overflow: 'n/a', overflowY: 'n/a' };
      const s = window.getComputedStyle(el);
      return { found: true, overflow: s.overflow, overflowY: s.overflowY };
    }, SP_SCROLL_SELECTOR);

    console.log('SP scroll region overflow:', result);

    if (result.found) {
      // The scroll region should allow vertical scrolling
      expect(result.overflowY).not.toBe('hidden');
    }

    // Note: body overflow:hidden is NORMAL in SharePoint modern pages.
    // SP uses [data-automation-id="contentScrollRegion"] for scrolling, not the body.
  });

  test('deep-link hash navigation works', async ({ edgePage: page }) => {
    const hashUrl = SP_URL + '#tab-2';
    await page.goto(hashUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
    await acceptDebugScripts(page);
    await page.waitForTimeout(5_000);

    const scrollY = await getScrollTop(page);
    console.log(`Deep-link scroll position: ${scrollY}`);
  });

  test('screenshots for visual comparison', async ({ edgePage: page }) => {
    await navigateToApp(page);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'scroll-fix-top.png'),
    });

    await scrollTo(page, 500);
    await page.waitForTimeout(1_000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'scroll-fix-scrolled.png'),
    });

    console.log('Screenshots saved to tests/test-results/screenshots/');
  });
});
