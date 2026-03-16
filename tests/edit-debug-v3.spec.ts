/**
 * Edit mode debug v3 — robust dialog handling and edit mode entry.
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const DEBUG_PARAMS = 'debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/edit-debug-v3');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function handleSSOLogin(page: Page): Promise<void> {
  if (page.url().includes('login.microsoftonline.com')) {
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

async function acceptDebugScripts(page: Page): Promise<void> {
  // Wait for the dialog to appear and click "Load debug scripts"
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // The dialog has specific button text
      const loadBtn = page.locator('button', { hasText: 'Load debug scripts' });
      if (await loadBtn.isVisible({ timeout: 5_000 })) {
        console.log(`  Debug dialog found (attempt ${attempt + 1}), clicking "Load debug scripts"...`);
        await loadBtn.click();
        await page.waitForTimeout(3_000);
        // Check if dialog is gone
        if (!await loadBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          console.log('  Dialog dismissed.');
          return;
        }
      }
    } catch {
      // Dialog not found, move on
    }
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

test.describe('Edit Mode Debug v3', () => {
  test.setTimeout(300_000);

  test('full edit mode diagnosis with local code', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]') || (msg.type() === 'error' && !text.includes('favicon') && !text.includes('ERR_'))) {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 400) });
      }
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT MODE DEBUG v3');
    console.log(`${'═'.repeat(70)}\n`);

    // ── Step 1: Load page in read mode with debug manifests ──
    console.log('Step 1: Loading read mode + debug manifests...');
    await page.goto(`${SP_URL}?${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await acceptDebugScripts(page);
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    console.log('Waiting 15s for PiCanvas...');
    await page.waitForTimeout(15_000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-read-mode.png'), fullPage: true });
    console.log(`Read mode loaded: ${await page.title()}`);

    // Quick read-mode count
    const readCount = await page.evaluate(() => {
      return {
        vpcs: document.querySelectorAll('[id*="PiCanvasWebPart"]').length,
        featureTags: document.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]').length,
        sections: document.querySelectorAll('[data-automation-id="CanvasSection"]').length,
      };
    });
    console.log(`  Read mode: ${readCount.vpcs} VPCs, ${readCount.featureTags} feature tags, ${readCount.sections} sections`);

    // ── Step 2: Enter edit mode by clicking the Edit button in UI ──
    console.log('\nStep 2: Entering edit mode...');

    // First try the Edit button
    let editMode = false;

    // SP modern Edit button selectors
    const editButtonSelectors = [
      '[data-automation-id="pageCommandBarEditButton"]',
      'button[name="Edit"]',
      'button:has-text("Edit")',
      'span:has-text("Edit")',
    ];

    for (const sel of editButtonSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2_000 })) {
          console.log(`  Clicking: ${sel}`);
          await btn.click();
          editMode = true;
          break;
        }
      } catch { /* next */ }
    }

    if (!editMode) {
      // Navigate directly to edit mode URL
      console.log('  No Edit button found, navigating to edit URL...');
      const editUrl = SP_URL.replace('.aspx', '.aspx') + `?Mode=Edit&${DEBUG_PARAMS}`;
      await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await handleSSOLogin(page);
      await acceptDebugScripts(page);
    }

    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    console.log('Waiting 25s for edit mode...');
    await page.waitForTimeout(25_000);

    // Take screenshot to see current state
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-after-edit-click.png') });

    // Check if we're actually in edit mode
    const editModeCheck = await page.evaluate(() => {
      const checks = {
        hasSlotManager: !!document.querySelector('[data-automation-id="fabricSlotManager"]'),
        hasDesignMode: document.body.classList.contains('sp-pageLayout-designMode'),
        hasCanvasToolbox: !!document.querySelector('[data-automation-id="canvasToolboxAddButton"]'),
        hasSaveButton: !!document.querySelector('[data-automation-id="pageCommandBarSaveButton"]'),
        hasCommandBar: !!document.querySelector('[data-automation-id="pageCommandBar"]'),
        urlHasMode: window.location.href.includes('Mode=Edit'),
        // Also check for the "Allow debug scripts?" dialog that blocks everything
        hasDebugDialog: document.body.innerHTML.includes('Allow debug scripts') || document.body.innerHTML.includes('Load debug scripts'),
      };
      return checks;
    });
    console.log('Edit mode checks:', JSON.stringify(editModeCheck, null, 2));

    // If debug dialog is still showing, try clicking it
    if (editModeCheck.hasDebugDialog) {
      console.log('  Debug dialog still present! Trying to click it...');
      // Try clicking by evaluating in the page
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('Load debug scripts')) {
            (btn as HTMLElement).click();
            return 'clicked';
          }
        }
        return 'not found';
      });
      await page.waitForTimeout(10_000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02b-after-dialog-click.png') });
    }

    // ── Step 3: Full scan ──
    console.log('\nStep 3: Full PiCanvas scan...');

    // Force scroll to load all content
    await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      const target = sr || document.documentElement;
      // Scroll all the way down in steps
      const step = 500;
      let pos = 0;
      const scroll = () => {
        if (pos < target.scrollHeight) {
          target.scrollTop = pos;
          pos += step;
          setTimeout(scroll, 100);
        } else {
          target.scrollTop = 0;
        }
      };
      scroll();
    });
    await page.waitForTimeout(5_000);

    const fullScan = await page.evaluate(() => {
      const vpcs = document.querySelectorAll('[id*="PiCanvasWebPart"]');
      const featureTags = document.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]');
      const allSections = document.querySelectorAll('[data-automation-id="CanvasSection"]');
      const allControls = document.querySelectorAll('[data-automation-id="CanvasControl"]');

      const picanvasDetails = Array.from(featureTags).map((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        const instanceId = h.getAttribute('data-sp-feature-instance-id') || '';

        // Walk up to find if anything hides this
        let hiddenBy = '';
        let anc: HTMLElement | null = h;
        for (let j = 0; j < 30 && anc; j++) {
          const cs = window.getComputedStyle(anc);
          if (cs.display === 'none') {
            hiddenBy = `display:none @ level ${j}: <${anc.tagName.toLowerCase()}> id="${anc.id?.substring(0, 50) || ''}" class="${anc.className?.toString().substring(0, 50) || ''}"`;
            break;
          }
          anc = anc.parentElement;
        }

        // Get section info
        const section = h.closest('[data-automation-id="CanvasSection"]');
        const sectionIdx = section ? Array.from(allSections).indexOf(section) : -1;
        const sectionHeight = section ? Math.round((section as HTMLElement).getBoundingClientRect().height) : -1;
        const sectionDisplay = section ? window.getComputedStyle(section as HTMLElement).display : 'n/a';

        // Check if it's inside a tab panel (nested PiCanvas)
        const insideTabPanel = !!h.closest('[role="tabpanel"], .tab-pane, .addui-Tabs-panel');

        return {
          index: i,
          instanceId,
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          hiddenBy,
          sectionIndex: sectionIdx,
          sectionHeight,
          sectionDisplay,
          insideTabPanel,
          innerHTML: h.innerHTML.substring(0, 300),
        };
      });

      const sectionDetails = Array.from(allSections).map((s, i) => {
        const el = s as HTMLElement;
        const rect = el.getBoundingClientRect();
        const display = window.getComputedStyle(el).display;
        const hasPiCanvas = !!el.querySelector('[data-sp-feature-tag*="PiCanvas"]');
        const piCanvasCount = el.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]').length;
        const controlCount = el.querySelectorAll('[data-automation-id="CanvasControl"]').length;

        // Walk up to find parent
        let hiddenBy = '';
        let anc: HTMLElement | null = el;
        for (let j = 0; j < 20 && anc; j++) {
          if (window.getComputedStyle(anc).display === 'none') {
            hiddenBy = `level ${j}: <${anc.tagName.toLowerCase()}> id="${anc.id?.substring(0, 50) || ''}"`;
            break;
          }
          anc = anc.parentElement;
        }

        return {
          index: i,
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          display,
          hasPiCanvas,
          piCanvasCount,
          controlCount,
          hiddenBy,
        };
      });

      return {
        vpcCount: vpcs.length,
        featureTagCount: featureTags.length,
        sectionCount: allSections.length,
        controlCount: allControls.length,
        picanvas: picanvasDetails,
        sections: sectionDetails,
        isEditMode: !!document.querySelector('[data-automation-id="fabricSlotManager"]') ||
                    !!document.querySelector('[data-automation-id="canvasToolboxAddButton"]') ||
                    !!document.querySelector('[data-automation-id="pageCommandBarSaveButton"]'),
        hasDebugDialog: document.body.innerHTML.includes('Load debug scripts'),
        bodyLength: document.body.innerHTML.length,
      };
    });

    console.log(`  Edit mode: ${fullScan.isEditMode}`);
    console.log(`  Debug dialog still showing: ${fullScan.hasDebugDialog}`);
    console.log(`  Body HTML: ${(fullScan.bodyLength / 1024).toFixed(0)} KB`);
    console.log(`  VPCs: ${fullScan.vpcCount}, Feature tags: ${fullScan.featureTagCount}`);
    console.log(`  Sections: ${fullScan.sectionCount}, Controls: ${fullScan.controlCount}`);

    console.log(`\n── PiCanvas Instances (${fullScan.picanvas.length}) ──`);
    for (const p of fullScan.picanvas) {
      const vis = p.hiddenBy ? 'HIDDEN' : p.height > 0 ? 'VISIBLE' : 'ZERO-H';
      const nested = p.insideTabPanel ? ' (NESTED in tab panel)' : '';
      console.log(`\n  #${p.index} [${vis}] instance=${p.instanceId}${nested}`);
      console.log(`    h=${p.height} top=${p.top} section=${p.sectionIndex} (section h=${p.sectionHeight}, display=${p.sectionDisplay})`);
      if (p.hiddenBy) console.log(`    HIDDEN BY: ${p.hiddenBy}`);
      console.log(`    html: ${p.innerHTML.substring(0, 200)}`);
    }

    console.log(`\n── Sections (${fullScan.sections.length}) ──`);
    for (const s of fullScan.sections) {
      const vis = s.hiddenBy ? 'HIDDEN' : s.height > 0 ? 'VISIBLE' : 'EMPTY';
      const pc = s.hasPiCanvas ? ` ◀ ${s.piCanvasCount} PICANVAS` : '';
      console.log(`  Section ${s.index}: [${vis}] h=${s.height} controls=${s.controlCount}${pc}`);
      if (s.hiddenBy) console.log(`    hidden: ${s.hiddenBy}`);
    }

    // Take scroll screenshots
    for (let i = 0; i <= 5; i++) {
      await page.evaluate((frac) => {
        const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
        const target = sr || document.documentElement;
        target.scrollTop = Math.round(target.scrollHeight * frac);
      }, i / 5);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `10-scroll-${i}.png`) });
    }

    console.log(`\n── Console (${consoleMessages.length}) ──`);
    for (const m of consoleMessages.slice(0, 40)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log('DONE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
