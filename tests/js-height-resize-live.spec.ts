/**
 * Live SharePoint test — verify JS height resize controls render
 * in edit mode on the SecAware Championship page.
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const DEBUG_PARAMS = 'debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/js-height-resize-live');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function handleSSOLogin(page: Page): Promise<void> {
  if (page.url().includes('login.microsoftonline.com')) {
    const accountLink = page.locator('text=anthony.hopkins@sap.com').first();
    if (await accountLink.isVisible({ timeout: 5_000 }).catch(() => false)) await accountLink.click();
    await page.waitForURL('**/sap.sharepoint.com/**', { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
  }
}

/**
 * Accept the "Load debug scripts" dialog.
 * Clicking the button causes a full page reload, so we must wait for navigation.
 */
async function acceptDebugScripts(page: Page): Promise<boolean> {
  // Wait for page content to be there
  await page.waitForTimeout(3_000);

  // Check if dialog is in the DOM by searching body text
  const hasDialog = await page.evaluate(() =>
    document.body.innerText.includes('Load debug scripts')
  ).catch(() => false);

  if (!hasDialog) {
    console.log('  No debug scripts dialog in DOM.');
    return false;
  }

  console.log('  Debug scripts dialog detected in DOM — clicking...');

  // Find and click via evaluate + waitForNavigation
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 60_000 }).catch(() => {}),
      page.evaluate(() => {
        // Find all buttons, click the one with "Load debug scripts"
        const allButtons = document.querySelectorAll('button');
        for (const btn of Array.from(allButtons)) {
          if (btn.textContent && btn.textContent.includes('Load debug scripts')) {
            console.log('[test] Found and clicking Load debug scripts button');
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
          }
        }
        // Also try anchor tags or other clickable elements
        const allElements = document.querySelectorAll('a, [role="button"], input[type="button"]');
        for (const el of Array.from(allElements)) {
          if (el.textContent && el.textContent.includes('Load debug scripts')) {
            (el as HTMLElement).click();
            return true;
          }
        }
        return false;
      }),
    ]);
    console.log('  Page navigation completed after debug script acceptance.');
  } catch (e) {
    console.log(`  Post-click: ${(e as Error).message.substring(0, 100)}`);
    await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
  }

  // Check if dialog is gone
  await page.waitForTimeout(3_000);
  const stillThere = await page.evaluate(() =>
    document.body.innerText.includes('Allow debug scripts')
  ).catch(() => true);

  if (!stillThere) {
    console.log('  Debug scripts loaded successfully!');
    return true;
  }

  console.log('  Dialog may still be present after click.');
  return false;
}

const test = base.extend<{ edgePage: Page }>({
  // eslint-disable-next-line no-empty-pattern
  edgePage: async ({}, use) => {
    const context: BrowserContext = await chromium.launchPersistentContext(EDGE_PROFILE_DIR, {
      channel: 'msedge',
      headless: false,
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1024 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const page = context.pages()[0] || await context.newPage();
    page.on('dialog', async (dialog) => await dialog.accept());
    await use(page);
    await context.close();
  },
});

test.describe('JS Height Resize — Live SharePoint', () => {
  test.setTimeout(300_000);

  test('edit mode shows resize controls for JS tabs', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]')) {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 300) });
      }
    });

    console.log('\n' + '═'.repeat(70));
    console.log('JS HEIGHT RESIZE — LIVE SHAREPOINT TEST');
    console.log('═'.repeat(70) + '\n');

    // ── Load page in edit mode ──
    // First, hit localhost to accept the self-signed cert in this browser context
    console.log('Accepting localhost self-signed cert...');
    await page.goto('https://localhost:4321/temp/build/manifests.js', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_000);

    console.log('Loading edit mode...');
    await page.goto(`${SP_URL}?Mode=Edit&${DEBUG_PARAMS}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await handleSSOLogin(page);

    // Accept debug scripts — this triggers a page reload
    let accepted = await acceptDebugScripts(page);
    // Dialog may reappear after reload
    if (accepted) {
      accepted = await acceptDebugScripts(page);
    }

    // If we accepted debug scripts, the page reloaded but may no longer be in edit mode.
    // Re-navigate to edit mode if needed.
    const isEditMode = await page.evaluate(() => {
      return window.location.href.toLowerCase().includes('mode=edit') ||
        !!document.querySelector('[data-automation-id="pageEditButton"][aria-pressed="true"]') ||
        document.body.classList.contains('sp-pageLayout-designMode');
    });
    if (!isEditMode && accepted) {
      console.log('Not in edit mode after debug reload — re-navigating...');
      await page.goto(`${SP_URL}?Mode=Edit&${DEBUG_PARAMS}`, {
        waitUntil: 'load',
        timeout: 60_000,
      });
      await acceptDebugScripts(page);
    }

    // Wait for SPFx webparts to initialize (they load lazily)
    console.log('Waiting 30s for webparts to initialize...');
    await page.waitForTimeout(30_000);

    // Scroll down to make sure PiCanvas webparts get loaded (SPFx lazy-loads)
    await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      if (sr) { sr.scrollTop = 500; }
      else { window.scrollBy(0, 500); }
    });
    await page.waitForTimeout(5_000);
    await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      if (sr) { sr.scrollTop = 0; }
      else { window.scrollTo(0, 0); }
    });
    await page.waitForTimeout(5_000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-edit-mode-loaded.png'), fullPage: false });

    // ── Find PiCanvas compact edit cards ──
    const piCanvasInfo = await page.evaluate(() => {
      const compactContainers = document.querySelectorAll('[class*="compactContainer"]');
      const results: Array<{
        index: number;
        tabCount: number;
        jsResizeRows: number;
        dragHandles: string[];
        heightLabels: Array<{ index: string; text: string }>;
        autoButtons: string[];
        warnings: Array<{ index: string; display: string }>;
      }> = [];

      compactContainers.forEach((container, i) => {
        const resizeRows = container.querySelectorAll('[data-js-resize]');
        const handles = container.querySelectorAll('[data-drag-handle]');
        const labels = container.querySelectorAll('[data-height-label]');
        const autoBtns = container.querySelectorAll('[data-auto-height]');
        const warningEls = container.querySelectorAll('[data-height-warning]');
        const tabRows = container.querySelectorAll('[data-configure-tab]');

        results.push({
          index: i,
          tabCount: tabRows.length,
          jsResizeRows: resizeRows.length,
          dragHandles: Array.from(handles).map(h => (h as HTMLElement).dataset.dragHandle || ''),
          heightLabels: Array.from(labels).map(l => ({
            index: (l as HTMLElement).dataset.heightLabel || '',
            text: (l as HTMLElement).textContent || '',
          })),
          autoButtons: Array.from(autoBtns).map(b => (b as HTMLElement).dataset.autoHeight || ''),
          warnings: Array.from(warningEls).map(w => ({
            index: (w as HTMLElement).dataset.heightWarning || '',
            display: window.getComputedStyle(w as HTMLElement).display,
          })),
        });
      });

      return { totalCompactContainers: compactContainers.length, details: results };
    });

    console.log(`\nFound ${piCanvasInfo.totalCompactContainers} PiCanvas compact edit cards\n`);

    for (const card of piCanvasInfo.details) {
      console.log(`── PiCanvas Card #${card.index} ──`);
      console.log(`  Tabs: ${card.tabCount}`);
      console.log(`  JS Resize Rows: ${card.jsResizeRows}`);
      console.log(`  Drag Handles: [${card.dragHandles.join(', ')}]`);
      for (const l of card.heightLabels) {
        console.log(`  Height Label Tab ${l.index}: "${l.text}"`);
      }
      console.log(`  Auto Buttons: [${card.autoButtons.join(', ')}]`);
      for (const w of card.warnings) {
        console.log(`  Warning Tab ${w.index}: display=${w.display}`);
      }
      console.log('');
    }

    // ── Screenshot compact cards ──
    const compactCards = page.locator('[class*="compactContainer"]');
    const cardCount = await compactCards.count();
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      try {
        await compactCards.nth(i).screenshot({
          path: path.join(SCREENSHOTS_DIR, `02-compact-card-${i}.png`),
        });
        console.log(`Captured screenshot of card ${i}`);
      } catch (e) {
        console.log(`Could not screenshot card ${i}: ${(e as Error).message.substring(0, 80)}`);
      }
    }

    const resizeRowCount = await page.locator('[data-js-resize]').count();
    console.log(`\nTotal resize rows on page: ${resizeRowCount}`);

    if (resizeRowCount > 0) {
      // Screenshot the first resize row
      try {
        await page.locator('[data-js-resize]').first().screenshot({
          path: path.join(SCREENSHOTS_DIR, '03-resize-row-closeup.png'),
        });
        console.log('Captured resize row closeup');
      } catch (e) {
        console.log(`Could not screenshot resize row: ${(e as Error).message.substring(0, 80)}`);
      }

      // ── Test drag interaction via pointer events ──
      const firstCard = page.locator('[class*="compactContainer"]').first();
      const firstHandle = firstCard.locator('[data-drag-handle]').first();
      if (await firstHandle.isVisible()) {
        const handleBox = await firstHandle.boundingBox();
        if (handleBox) {
          const tabIdx = await firstHandle.getAttribute('data-drag-handle');
          const label = firstCard.locator(`[data-height-label="${tabIdx}"]`);
          const beforeText = await label.textContent();

          console.log(`\nDrag test on tab ${tabIdx} (current: "${beforeText}")...`);

          // Dispatch pointer events directly on the handle element
          const cx = handleBox.x + handleBox.width / 2;
          const cy = handleBox.y + handleBox.height / 2;
          const dragDelta = 80;

          await page.evaluate(({ sel, startX, startY, delta }) => {
            const handle = document.querySelector(sel) as HTMLElement;
            if (!handle) return;

            handle.dispatchEvent(new PointerEvent('pointerdown', {
              clientX: startX, clientY: startY, pointerId: 1,
              bubbles: true, cancelable: true,
            }));

            // Simulate drag in steps
            for (let i = 1; i <= 5; i++) {
              handle.dispatchEvent(new PointerEvent('pointermove', {
                clientX: startX, clientY: startY + (delta * i / 5), pointerId: 1,
                bubbles: true, cancelable: true,
              }));
            }

            handle.dispatchEvent(new PointerEvent('pointerup', {
              clientX: startX, clientY: startY + delta, pointerId: 1,
              bubbles: true, cancelable: true,
            }));
          }, {
            sel: `[class*="compactContainer"]:first-child [data-drag-handle="${tabIdx}"], [data-drag-handle="${tabIdx}"]`,
            startX: cx, startY: cy, delta: dragDelta,
          });

          await page.waitForTimeout(200);

          const afterText = await label.textContent();
          console.log(`  After drag (+${dragDelta}px): "${afterText}"`);

          await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-after-drag.png'), fullPage: false });
        }
      }

      // ── Test Auto button ──
      const firstAutoBtn = firstCard.locator('[data-auto-height]').first();
      if (await firstAutoBtn.isVisible()) {
        const tabIdx = await firstAutoBtn.getAttribute('data-auto-height');
        const label = firstCard.locator(`[data-height-label="${tabIdx}"]`);

        console.log(`\nAuto-detect test on tab ${tabIdx}...`);
        await firstAutoBtn.click({ force: true });
        await page.waitForTimeout(1000);

        const autoText = await label.textContent();
        console.log(`  After auto-detect: "${autoText}"`);

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-after-auto.png'), fullPage: false });
      }
    } else {
      console.log('\nNo resize rows found — debug manifests may not have loaded.');
      console.log('This happens when the Playwright Edge context lacks cached debug script acceptance.');

      // Diagnostic dump
      const diag = await page.evaluate(() => {
        const featureTags = document.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]');
        return {
          featureTagCount: featureTags.length,
          hasDebugDialog: document.body.innerText.includes('Allow debug scripts'),
          bodyPreview: document.body.innerText.substring(0, 300),
          url: window.location.href,
        };
      });
      console.log(`  URL: ${diag.url}`);
      console.log(`  PiCanvas feature tags: ${diag.featureTagCount}`);
      console.log(`  Debug dialog still present: ${diag.hasDebugDialog}`);
      console.log(`  Body: ${diag.bodyPreview.substring(0, 200)}`);
    }

    // ── Console summary ──
    console.log(`\n── PiCanvas Console Messages (${consoleMessages.length}) ──`);
    for (const m of consoleMessages.slice(0, 20)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('LIVE TEST COMPLETE');
    console.log('═'.repeat(70) + '\n');
  });
});
