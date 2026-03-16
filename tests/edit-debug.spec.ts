/**
 * Debug PiCanvas in edit mode with local dev server manifests.
 * Loads the page with ?debugManifestsFile=https://localhost:4321/temp/build/manifests.js
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const DEBUG_URL = `${SP_URL}?debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true`;
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/edit-debug');

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
      viewport: { width: 1440, height: 1024 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const page = context.pages()[0] || await context.newPage();
    page.on('dialog', async (dialog) => await dialog.accept());
    await use(page);
    await context.close();
  },
});

test.describe('Edit Mode Debug — local dev server', () => {
  test.setTimeout(300_000);

  test('debug PiCanvas instances in edit mode with local manifests', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]') || msg.type() === 'error') {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 400) });
      }
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT MODE DEBUG — LOCAL DEV SERVER');
    console.log(`${'═'.repeat(70)}\n`);

    // ── 1. Load page with debug manifests (read mode first) ──
    console.log('Loading page with debug manifests...');
    await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);

    // Handle the "Load debug scripts?" dialog if it appears
    const debugDialog = page.locator('text=Load debug scripts');
    if (await debugDialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
      console.log('Clicking "Load debug scripts" button...');
      await page.locator('button:has-text("Load debug scripts")').click();
      await page.waitForTimeout(3_000);
    }

    await page.waitForLoadState('load', { timeout: 60_000 });
    console.log('Waiting 20s for PiCanvas to initialize with local code...');
    await page.waitForTimeout(20_000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-read-mode.png'), fullPage: true });
    console.log(`Page loaded: "${await page.title()}"`);

    // ── 2. Scan PiCanvas instances in read mode ──
    const readModeScan = await page.evaluate(() => {
      const vpcs = document.querySelectorAll('[id*="vpc_WebPart.PiCanvasWebPart"]');
      return Array.from(vpcs).map((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        // Check for error UI (our new catch block)
        const hasError = !!h.querySelector('[style*="d13438"]') || h.innerHTML.includes('failed to render');
        return {
          index: i,
          id: h.id.replace('vpc_WebPart.PiCanvasWebPart.external.', ''),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          hasContent: h.childElementCount > 0 && h.innerHTML.length > 100,
          hasError,
          parentClass: h.parentElement?.className?.toString().substring(0, 80) || '',
          innerHTML: h.innerHTML.substring(0, 300),
        };
      });
    });

    console.log(`\n── READ MODE: ${readModeScan.length} PiCanvas instances ──`);
    for (const inst of readModeScan) {
      const status = inst.hasError ? 'ERROR' : inst.height > 0 ? 'VISIBLE' : 'HIDDEN (h=0)';
      console.log(`  #${inst.index}: [${status}] id=${inst.id} h=${inst.height} top=${inst.top}`);
      console.log(`    parent: "${inst.parentClass}"`);
      if (inst.hasError) console.log(`    HAS ERROR UI`);
      if (inst.height === 0) console.log(`    html: ${inst.innerHTML}`);
    }

    // ── 3. Switch to edit mode ──
    console.log('\n── Switching to Edit Mode ──');
    const editUrl = `${SP_URL}?Mode=Edit&debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true`;
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);

    // Handle debug scripts dialog again
    const debugDialog2 = page.locator('text=Load debug scripts');
    if (await debugDialog2.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('button:has-text("Load debug scripts")').click();
      await page.waitForTimeout(3_000);
    }

    await page.waitForLoadState('load', { timeout: 60_000 });
    console.log('Waiting 25s for edit mode to fully load...');
    await page.waitForTimeout(25_000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-edit-mode-top.png'), fullPage: true });

    // ── 4. Scan PiCanvas instances in edit mode ──
    const editModeScan = await page.evaluate(() => {
      const vpcs = document.querySelectorAll('[id*="vpc_WebPart.PiCanvasWebPart"]');
      return Array.from(vpcs).map((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        const hasError = !!h.querySelector('[style*="d13438"]') || h.innerHTML.includes('failed to render');
        const hasPiSymbol = h.innerHTML.includes('&pi;') || h.innerHTML.includes('π');
        const hasConfigBtn = !!h.querySelector('[data-action="configure"]');
        const hasCompactUI = h.innerHTML.includes('compactContainer') || h.innerHTML.includes('PiCanvas</h2>');

        // Check ancestors for display:none or height=0
        let hiddenBy = '';
        let ancestor: HTMLElement | null = h;
        for (let j = 0; j < 25 && ancestor; j++) {
          const cs = window.getComputedStyle(ancestor);
          if (cs.display === 'none') {
            hiddenBy = `display:none on ${ancestor.tagName}#${ancestor.id || ''}.${ancestor.className?.toString().substring(0, 60) || ''} (ancestor level ${j})`;
            break;
          }
          if (cs.visibility === 'hidden') {
            hiddenBy = `visibility:hidden on ${ancestor.tagName}#${ancestor.id || ''}.${ancestor.className?.toString().substring(0, 60) || ''} (ancestor level ${j})`;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        // Get the CanvasControl parent
        const canvasControl = h.closest('[data-automation-id="CanvasControl"]');
        let canvasControlInfo = null;
        if (canvasControl) {
          const cc = canvasControl as HTMLElement;
          const ccRect = cc.getBoundingClientRect();
          canvasControlInfo = {
            display: window.getComputedStyle(cc).display,
            height: Math.round(ccRect.height),
            top: Math.round(ccRect.top),
          };
        }

        // Get the CanvasSection parent
        const canvasSection = h.closest('[data-automation-id="CanvasSection"]');
        let sectionInfo = null;
        if (canvasSection) {
          const cs = canvasSection as HTMLElement;
          const csRect = cs.getBoundingClientRect();
          const sectionIdx = Array.from(document.querySelectorAll('[data-automation-id="CanvasSection"]')).indexOf(canvasSection);
          sectionInfo = {
            index: sectionIdx,
            display: window.getComputedStyle(cs).display,
            height: Math.round(csRect.height),
            top: Math.round(csRect.top),
          };
        }

        return {
          index: i,
          id: h.id.replace('vpc_WebPart.PiCanvasWebPart.external.', ''),
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          top: Math.round(rect.top),
          hasError,
          hasPiSymbol,
          hasConfigBtn,
          hasCompactUI,
          hiddenBy,
          canvasControlInfo,
          sectionInfo,
          parentClass: h.parentElement?.className?.toString().substring(0, 80) || '',
          innerHTML: h.innerHTML.substring(0, 500),
        };
      });
    });

    console.log(`\n── EDIT MODE: ${editModeScan.length} PiCanvas instances ──`);
    for (const inst of editModeScan) {
      const status = inst.hasError ? 'ERROR-UI' :
                     inst.hiddenBy ? 'HIDDEN' :
                     inst.height > 0 ? 'VISIBLE' : 'ZERO-HEIGHT';
      console.log(`\n  PiCanvas #${inst.index} [${status}] — ${inst.id}`);
      console.log(`    Size: ${inst.width}x${inst.height}, top=${inst.top}`);
      console.log(`    Has pi symbol: ${inst.hasPiSymbol}, config btn: ${inst.hasConfigBtn}, compact UI: ${inst.hasCompactUI}`);
      if (inst.hiddenBy) console.log(`    HIDDEN BY: ${inst.hiddenBy}`);
      if (inst.canvasControlInfo) {
        console.log(`    CanvasControl: display=${inst.canvasControlInfo.display}, h=${inst.canvasControlInfo.height}`);
      }
      if (inst.sectionInfo) {
        console.log(`    Section #${inst.sectionInfo.index}: display=${inst.sectionInfo.display}, h=${inst.sectionInfo.height}, top=${inst.sectionInfo.top}`);
      }
      console.log(`    parent: "${inst.parentClass}"`);
      if (inst.height === 0 || inst.hiddenBy) {
        console.log(`    innerHTML: ${inst.innerHTML}`);
      }
    }

    // ── 5. Scroll through edit mode and take screenshots at each PiCanvas ──
    console.log('\n── Scrolling through sections ──');
    const sectionPositions = await page.evaluate(() => {
      const sections = document.querySelectorAll('[data-automation-id="CanvasSection"]');
      const scrollRegion = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      return {
        sectionCount: sections.length,
        sections: Array.from(sections).map((s, i) => {
          const el = s as HTMLElement;
          const hasPiCanvas = !!el.querySelector('[id*="vpc_WebPart.PiCanvasWebPart"]');
          return {
            index: i,
            offsetTop: el.offsetTop,
            height: Math.round(el.getBoundingClientRect().height),
            display: window.getComputedStyle(el).display,
            hasPiCanvas,
          };
        }),
        scrollRegionExists: !!scrollRegion,
        scrollHeight: scrollRegion?.scrollHeight || document.body.scrollHeight,
      };
    });

    console.log(`Total sections: ${sectionPositions.sectionCount}`);
    for (const s of sectionPositions.sections) {
      const marker = s.hasPiCanvas ? ' ◀ PICANVAS' : '';
      const vis = s.display === 'none' ? 'HIDDEN' : s.height === 0 ? 'EMPTY' : 'VISIBLE';
      console.log(`  Section ${s.index}: ${vis} (h=${s.height})${marker}`);
    }

    // Scroll to each PiCanvas section and take screenshots
    for (const s of sectionPositions.sections.filter(s => s.hasPiCanvas)) {
      await page.evaluate((top) => {
        const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
        if (sr) sr.scrollTop = top - 100;
        else window.scrollTo(0, top - 100);
      }, s.offsetTop);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `03-section-${s.index}-picanvas.png`) });
      console.log(`  Screenshot: section ${s.index} (scrolled to ${s.offsetTop})`);
    }

    // ── 6. Check if hidden PiCanvas instances have data-picanvas-hiding-active ──
    const bodyClasses = await page.evaluate(() => {
      return {
        bodyClasses: document.body.className,
        hasHidingActive: document.body.classList.contains('picanvas-hiding-active'),
        hasBannerFullwidth: document.body.classList.contains('picanvas-banner-fullwidth'),
        preHideStyles: Array.from(document.querySelectorAll('style[id*="picanvas-prehide"]')).map(s => ({
          id: s.id,
          content: s.textContent?.substring(0, 200) || '',
        })),
      };
    });

    console.log(`\n── BODY STATE ──`);
    console.log(`  picanvas-hiding-active: ${bodyClasses.hasHidingActive}`);
    console.log(`  picanvas-banner-fullwidth: ${bodyClasses.hasBannerFullwidth}`);
    console.log(`  Pre-hide style elements: ${bodyClasses.preHideStyles.length}`);
    for (const s of bodyClasses.preHideStyles) {
      console.log(`    ${s.id}: ${s.content}`);
    }

    // ── 7. Console messages ──
    console.log(`\n── CONSOLE (${consoleMessages.length} messages) ──`);
    for (const m of consoleMessages.slice(0, 50)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    // Final full page screenshot
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '99-final.png'), fullPage: true });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT MODE DEBUG COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
