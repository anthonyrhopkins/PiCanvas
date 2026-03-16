/**
 * Edit mode debug v2 — click Edit button in UI, scroll to load all sections,
 * then find all PiCanvas instances.
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const DEBUG_PARAMS = 'debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/edit-debug-v2');

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

test.describe('Edit Mode Debug v2 — UI-triggered edit', () => {
  test.setTimeout(300_000);

  test('find all PiCanvas instances by scrolling edit mode', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]') || (msg.type() === 'error' && !text.includes('favicon'))) {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 400) });
      }
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT MODE DEBUG v2 — UI-triggered edit');
    console.log(`${'═'.repeat(70)}\n`);

    // ── 1. Load page in read mode with debug manifests ──
    console.log('Step 1: Loading page with debug manifests (read mode)...');
    await page.goto(`${SP_URL}?${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);

    // Handle "Load debug scripts?" dialog
    const debugBtn = page.locator('button:has-text("Load debug scripts")');
    if (await debugBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log('Accepting debug scripts dialog...');
      await debugBtn.click();
    }

    await page.waitForLoadState('networkidle', { timeout: 60_000 });
    console.log('Waiting 15s for full page load...');
    await page.waitForTimeout(15_000);

    // ── 2. Click the Edit button in the SP toolbar ──
    console.log('\nStep 2: Clicking Edit button...');

    // Try multiple selectors for the Edit button
    const editSelectors = [
      'button[data-automation-id="pageCommandBarEditButton"]',
      'button:has-text("Edit")',
      '[data-automation-id="pageEditButton"]',
      'button[aria-label="Edit"]',
      'span:has-text("Edit")',
    ];

    let editClicked = false;
    for (const sel of editSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        console.log(`  Found Edit button with selector: ${sel}`);
        await btn.click();
        editClicked = true;
        break;
      }
    }

    if (!editClicked) {
      console.log('  Edit button not found — trying keyboard shortcut...');
      await page.keyboard.press('e');
      await page.waitForTimeout(2_000);
      // Check if edit mode activated
      const isEditing = await page.evaluate(() => {
        return !!document.querySelector('[data-automation-id="fabricSlotManager"]') ||
               document.body.classList.contains('sp-pageLayout-designMode');
      });
      if (!isEditing) {
        console.log('  Keyboard shortcut failed — navigating with Mode=Edit...');
        await page.goto(`${SP_URL}?Mode=Edit&${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        const debugBtn2 = page.locator('button:has-text("Load debug scripts")');
        if (await debugBtn2.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await debugBtn2.click();
        }
      }
    }

    console.log('Waiting 20s for edit mode to fully load...');
    await page.waitForLoadState('load', { timeout: 60_000 });
    await page.waitForTimeout(20_000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-edit-mode.png') });

    // ── 3. Scroll through entire page to force lazy-load of all sections ──
    console.log('\nStep 3: Scrolling to force all sections to render...');

    const scrollInfo = await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      const target = sr || document.documentElement;
      return {
        scrollHeight: target.scrollHeight,
        clientHeight: target.clientHeight,
        useScrollRegion: !!sr,
      };
    });

    console.log(`  Scroll container: ${scrollInfo.useScrollRegion ? 'contentScrollRegion' : 'document'}`);
    console.log(`  Total height: ${scrollInfo.scrollHeight}, viewport: ${scrollInfo.clientHeight}`);

    // Scroll incrementally to trigger lazy loading
    const scrollStep = 500;
    const maxScroll = scrollInfo.scrollHeight;
    for (let pos = 0; pos <= maxScroll; pos += scrollStep) {
      await page.evaluate(({ pos: p, useScrollRegion }) => {
        const sr = useScrollRegion
          ? document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement
          : document.documentElement;
        if (sr) sr.scrollTop = p;
      }, { pos, useScrollRegion: scrollInfo.useScrollRegion });
      await page.waitForTimeout(200);
    }

    // Scroll back to top
    await page.evaluate(({ useScrollRegion }) => {
      const sr = useScrollRegion
        ? document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement
        : document.documentElement;
      if (sr) sr.scrollTop = 0;
    }, { useScrollRegion: scrollInfo.useScrollRegion });
    await page.waitForTimeout(3_000);

    // Check new scroll height (lazy-loaded content may have expanded it)
    const newScrollHeight = await page.evaluate(({ useScrollRegion }) => {
      const sr = useScrollRegion
        ? document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement
        : document.documentElement;
      return sr?.scrollHeight || 0;
    }, { useScrollRegion: scrollInfo.useScrollRegion });
    console.log(`  Scroll height after lazy-load: ${newScrollHeight} (was ${scrollInfo.scrollHeight})`);

    // ── 4. Full scan of all PiCanvas instances ──
    console.log('\nStep 4: Scanning all PiCanvas instances...');

    const fullScan = await page.evaluate(() => {
      // Find PiCanvas by VPC container
      const vpcs = document.querySelectorAll('[id*="PiCanvasWebPart"]');
      // Also find by data-sp-feature-tag
      const featureTags = document.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]');
      // Also find by webpart ID
      const byWpId = document.querySelectorAll('[data-sp-web-part-id="6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5"]');
      // Also check addui-Tabs
      const adduiTabs = document.querySelectorAll('[data-addui="tabs"]');

      const allSections = document.querySelectorAll('[data-automation-id="CanvasSection"]');
      const allControls = document.querySelectorAll('[data-automation-id="CanvasControl"]');

      // Get details for each method
      const vpcDetails = Array.from(vpcs).map((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        let hiddenAncestor = '';
        let anc: HTMLElement | null = h;
        for (let j = 0; j < 30 && anc; j++) {
          const cs = window.getComputedStyle(anc);
          if (cs.display === 'none') {
            hiddenAncestor = `level ${j}: ${anc.tagName}#${anc.id?.substring(0, 40) || ''} display:none`;
            break;
          }
          anc = anc.parentElement;
        }
        return {
          index: i,
          id: h.id.substring(0, 80),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          display: window.getComputedStyle(h).display,
          hiddenAncestor,
          childCount: h.childElementCount,
        };
      });

      const featureTagDetails = Array.from(featureTags).map((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        const instanceId = h.getAttribute('data-sp-feature-instance-id') || '';
        let hiddenAncestor = '';
        let anc: HTMLElement | null = h;
        for (let j = 0; j < 30 && anc; j++) {
          const cs = window.getComputedStyle(anc);
          if (cs.display === 'none') {
            hiddenAncestor = `level ${j}: ${anc.tagName}#${anc.id?.substring(0, 40) || ''}`;
            break;
          }
          anc = anc.parentElement;
        }
        // Check section parent
        const section = h.closest('[data-automation-id="CanvasSection"]');
        const sectionIdx = section ? Array.from(allSections).indexOf(section) : -1;
        return {
          index: i,
          instanceId,
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          hiddenAncestor,
          sectionIndex: sectionIdx,
        };
      });

      // Check sections
      const sectionDetails = Array.from(allSections).map((s, i) => {
        const el = s as HTMLElement;
        const rect = el.getBoundingClientRect();
        const hasPiCanvas = !!el.querySelector('[data-sp-feature-tag*="PiCanvas"], [id*="PiCanvasWebPart"]');
        const controlCount = el.querySelectorAll('[data-automation-id="CanvasControl"]').length;
        let hiddenBy = '';
        let anc: HTMLElement | null = el;
        for (let j = 0; j < 20 && anc; j++) {
          if (window.getComputedStyle(anc).display === 'none') {
            hiddenBy = `level ${j}: ${anc.tagName}#${anc.id?.substring(0, 40) || ''}`;
            break;
          }
          anc = anc.parentElement;
        }
        return {
          index: i,
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          display: window.getComputedStyle(el).display,
          hasPiCanvas,
          controlCount,
          hiddenBy,
        };
      });

      return {
        vpcCount: vpcs.length,
        featureTagCount: featureTags.length,
        wpIdCount: byWpId.length,
        adduiTabsCount: adduiTabs.length,
        sectionCount: allSections.length,
        controlCount: allControls.length,
        vpcs: vpcDetails,
        featureTags: featureTagDetails,
        sections: sectionDetails,
        bodyHTML_length: document.body.innerHTML.length,
        isEditMode: !!document.querySelector('[data-automation-id="fabricSlotManager"]') ||
                    document.body.classList.contains('sp-pageLayout-designMode') ||
                    !!document.querySelector('[data-automation-id="canvasToolboxAddButton"]'),
      };
    });

    console.log(`\n  Edit mode confirmed: ${fullScan.isEditMode}`);
    console.log(`  Body HTML size: ${(fullScan.bodyHTML_length / 1024).toFixed(0)} KB`);
    console.log(`  Detection methods:`);
    console.log(`    VPC containers [id*=PiCanvasWebPart]: ${fullScan.vpcCount}`);
    console.log(`    Feature tags [data-sp-feature-tag*=PiCanvas]: ${fullScan.featureTagCount}`);
    console.log(`    WebPart ID [6bcd9bfc]: ${fullScan.wpIdCount}`);
    console.log(`    addui-Tabs containers: ${fullScan.adduiTabsCount}`);
    console.log(`    Total sections: ${fullScan.sectionCount}`);
    console.log(`    Total CanvasControls: ${fullScan.controlCount}`);

    console.log(`\n── PiCanvas by VPC (${fullScan.vpcs.length}) ──`);
    for (const v of fullScan.vpcs) {
      const vis = v.hiddenAncestor ? 'HIDDEN' : v.height > 0 ? 'VISIBLE' : 'ZERO-H';
      console.log(`  #${v.index} [${vis}] id="${v.id}" h=${v.height} top=${v.top} children=${v.childCount}`);
      if (v.hiddenAncestor) console.log(`    hidden by: ${v.hiddenAncestor}`);
    }

    console.log(`\n── PiCanvas by feature tag (${fullScan.featureTags.length}) ──`);
    for (const f of fullScan.featureTags) {
      const vis = f.hiddenAncestor ? 'HIDDEN' : f.height > 0 ? 'VISIBLE' : 'ZERO-H';
      console.log(`  #${f.index} [${vis}] instance=${f.instanceId} h=${f.height} section=${f.sectionIndex}`);
      if (f.hiddenAncestor) console.log(`    hidden by: ${f.hiddenAncestor}`);
    }

    console.log(`\n── All Sections (${fullScan.sections.length}) ──`);
    for (const s of fullScan.sections) {
      const vis = s.hiddenBy ? 'HIDDEN' : s.height > 0 ? 'VISIBLE' : 'EMPTY';
      const marker = s.hasPiCanvas ? ' ◀ PICANVAS' : '';
      console.log(`  Section ${s.index}: [${vis}] h=${s.height} top=${s.top} controls=${s.controlCount}${marker}`);
      if (s.hiddenBy) console.log(`    hidden by: ${s.hiddenBy}`);
    }

    // ── 5. Screenshots at key scroll positions ──
    const picanvasSections = fullScan.sections.filter(s => s.hasPiCanvas);
    for (const s of picanvasSections) {
      await page.evaluate(({ pos, useScrollRegion }) => {
        const sr = useScrollRegion
          ? document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement
          : document.documentElement;
        if (sr) sr.scrollTop = pos;
      }, { pos: Math.max(0, s.top - 200), useScrollRegion: scrollInfo.useScrollRegion });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `05-picanvas-section-${s.index}.png`) });
    }

    // Take screenshots scrolling through entire page
    for (let i = 0; i <= 6; i++) {
      const scrollPos = Math.round((newScrollHeight * i) / 6);
      await page.evaluate(({ pos, useScrollRegion }) => {
        const sr = useScrollRegion
          ? document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement
          : document.documentElement;
        if (sr) sr.scrollTop = pos;
      }, { pos: scrollPos, useScrollRegion: scrollInfo.useScrollRegion });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `06-scroll-${i}.png`) });
    }

    // ── 6. Console log dump ──
    console.log(`\n── Console (${consoleMessages.length}) ──`);
    for (const m of consoleMessages.slice(0, 40)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT DEBUG v2 COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
