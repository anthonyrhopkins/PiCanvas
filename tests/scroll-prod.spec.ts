/**
 * Scroll test against PRODUCTION (deployed sppkg, no debug manifests).
 * Tests https://sap.sharepoint.com/sites/213105/SitePages/App.aspx
 */
import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/213105/SitePages/App.aspx';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/screenshots');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function handleSSOLogin(page: Page): Promise<void> {
  const url = page.url();
  if (url.includes('login.microsoftonline.com')) {
    const accountLink = page.locator('text=anthony.hopkins@sap.com').first();
    const anyAccount = page.locator('#tilesHolder div[tabindex="0"], .table div[role="link"], [data-test-id]').first();
    if (await accountLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await accountLink.click();
    } else if (await anyAccount.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await anyAccount.click();
    }
    await page.waitForURL('**/sap.sharepoint.com/**', { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
  }
}

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

test.describe('Production Scroll Test — /sites/213105', () => {
  test.setTimeout(120_000);

  test('full scroll diagnostic', async ({ edgePage: page }) => {
    await page.goto(SP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await page.waitForLoadState('load', { timeout: 60_000 });
    await page.waitForTimeout(15_000);

    const title = await page.title();
    const url = page.url();
    console.log(`Page: "${title}" — ${url}`);

    // Screenshot before scroll
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod-213105-top.png') });

    // Full scroll diagnostic
    const scrollInfo = await page.evaluate(() => {
      const results: Array<{ selector: string; scrollHeight: number; clientHeight: number; overflowY: string; canScroll: boolean }> = [];

      // Body
      const bs = window.getComputedStyle(document.body);
      results.push({
        selector: 'body',
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        overflowY: bs.overflowY,
        canScroll: document.body.scrollHeight > document.body.clientHeight && bs.overflowY !== 'hidden'
      });

      // SP scroll region
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      if (sr) {
        const s = window.getComputedStyle(sr);
        results.push({
          selector: 'contentScrollRegion',
          scrollHeight: sr.scrollHeight,
          clientHeight: sr.clientHeight,
          overflowY: s.overflowY,
          canScroll: sr.scrollHeight > sr.clientHeight && s.overflowY !== 'hidden'
        });
      }

      // Find ALL scrollable containers
      document.querySelectorAll('*').forEach(el => {
        const s = window.getComputedStyle(el);
        const h = el as HTMLElement;
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && h.scrollHeight > h.clientHeight + 50) {
          const cls = el.className ? el.className.toString().substring(0, 60) : '';
          results.push({
            selector: `${el.tagName.toLowerCase()}.${cls}`,
            scrollHeight: h.scrollHeight,
            clientHeight: h.clientHeight,
            overflowY: s.overflowY,
            canScroll: true
          });
        }
      });

      return results;
    });

    console.log('\nScroll containers:');
    for (const info of scrollInfo) {
      const status = info.canScroll ? 'SCROLLABLE' : 'NOT scrollable';
      console.log(`  ${status}: ${info.selector} (${info.scrollHeight}/${info.clientHeight}, overflow-y: ${info.overflowY})`);
    }

    // Try scrolling the main scrollable container
    const scrollResult = await page.evaluate(() => {
      // Try .pr-explorer-grid first, then contentScrollRegion, then window
      const targets = [
        document.querySelector('.pr-explorer-grid') as HTMLElement,
        document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement,
      ];

      for (const el of targets) {
        if (el && el.scrollHeight > el.clientHeight) {
          const before = el.scrollTop;
          el.scrollTop = 400;
          const after = el.scrollTop;
          return { target: el.className?.toString().substring(0, 60) || el.tagName, before, after, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
        }
      }

      // Try window
      const before = window.scrollY;
      window.scrollTo(0, 400);
      return { target: 'window', before, after: window.scrollY, scrollHeight: document.body.scrollHeight, clientHeight: window.innerHeight };
    });

    console.log(`\nScroll test: ${scrollResult.target} — before=${scrollResult.before}, after=${scrollResult.after} (${scrollResult.scrollHeight}/${scrollResult.clientHeight})`);

    if (scrollResult.after > scrollResult.before) {
      console.log('PASS: Page scrolls correctly');
    } else {
      console.log('FAIL: Page cannot scroll!');
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod-213105-scrolled.png') });

    // Deep DOM inspection — find the profile report and its scroll containers
    const domInfo = await page.evaluate(() => {
      const report = document.querySelector('.picanvas-profilereport') as HTMLElement;
      if (!report) return { found: false, detail: 'No .picanvas-profilereport found' };

      const view = report.getAttribute('data-view');
      const displayMode = report.getAttribute('data-display-mode');

      // Walk up from the report to find containers and their overflow settings
      const ancestors: Array<{ tag: string; cls: string; overflow: string; overflowY: string; height: string; scrollH: number; clientH: number }> = [];
      let el: HTMLElement | null = report;
      for (let i = 0; i < 10 && el; i++) {
        const s = window.getComputedStyle(el);
        ancestors.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString().substring(0, 60) || '',
          overflow: s.overflow,
          overflowY: s.overflowY,
          height: s.height,
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
        });
        el = el.parentElement;
      }

      // Check detail scroll container specifically
      const detailScroll = report.querySelector('.pr-detail-scroll') as HTMLElement;
      const explorerGrid = report.querySelector('.pr-explorer-grid') as HTMLElement;
      const detailView = report.querySelector('.pr-detail-view') as HTMLElement;

      const containers: Record<string, any> = {};
      for (const [name, node] of Object.entries({ detailScroll, explorerGrid, detailView, report })) {
        if (node) {
          const s = window.getComputedStyle(node);
          containers[name] = {
            overflow: s.overflow,
            overflowY: s.overflowY,
            height: s.height,
            maxHeight: s.maxHeight,
            display: s.display,
            flex: s.flex,
            scrollH: node.scrollHeight,
            clientH: node.clientHeight,
          };
        }
      }

      return { found: true, view, displayMode, ancestors, containers };
    });

    console.log('\nProfile Report DOM:');
    console.log(JSON.stringify(domInfo, null, 2));

    // Now click into a company to test detail view scroll
    const firstCard = page.locator('.pr-company-card').first();
    if (await firstCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('\n--- Clicking first company card to test detail view ---');
      await firstCard.click();
      await page.waitForTimeout(5_000);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod-213105-detail-top.png') });

      const detailDiag = await page.evaluate(() => {
        const report = document.querySelector('.picanvas-profilereport') as HTMLElement;
        const view = report?.getAttribute('data-view');

        const detailBody = document.querySelector('.pr-detail-body') as HTMLElement;
        const detailView = document.querySelector('.pr-detail-view') as HTMLElement;
        const methodPanels = document.querySelectorAll('.method-panel');

        const containers: Record<string, any> = {};
        for (const [name, node] of Object.entries({ detailBody, detailView })) {
          if (node) {
            const s = window.getComputedStyle(node);
            containers[name] = {
              overflow: s.overflow,
              overflowY: s.overflowY,
              height: s.height,
              maxHeight: s.maxHeight,
              display: s.display,
              flex: s.flex,
              scrollH: node.scrollHeight,
              clientH: node.clientHeight,
            };
          }
        }

        // Find any scrollable in detail view
        const scrollables: string[] = [];
        document.querySelectorAll('*').forEach(el => {
          const s = window.getComputedStyle(el);
          const h = el as HTMLElement;
          if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && h.scrollHeight > h.clientHeight + 50) {
            scrollables.push(`${el.tagName}.${el.className?.toString().substring(0, 50)} (${h.scrollHeight}/${h.clientHeight})`);
          }
        });

        // Try scrolling detailScroll
        let scrollTest = { target: 'none', before: 0, after: 0 };
        if (detailBody) {
          const before = detailBody.scrollTop;
          detailBody.scrollTop = 400;
          scrollTest = { target: 'detailBody', before, after: detailBody.scrollTop };
        }

        return { view, methodPanelCount: methodPanels.length, containers, scrollables, scrollTest };
      });

      console.log('\nDetail view diagnostic:');
      console.log(JSON.stringify(detailDiag, null, 2));

      if (detailDiag.scrollTest.after > detailDiag.scrollTest.before) {
        console.log('PASS: Detail view scrolls');
      } else {
        console.log('FAIL: Detail view cannot scroll!');
      }

      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'prod-213105-detail-scrolled.png') });
    }
  });
});
