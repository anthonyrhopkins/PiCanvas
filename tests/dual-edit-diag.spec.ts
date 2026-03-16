/**
 * Edit mode diagnostic — inspect both PiCanvas instances' configurations
 * to understand why one doesn't work in read mode.
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const DEBUG_PARAMS = 'debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/dual-edit-diag');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function handleSSOLogin(page: Page): Promise<void> {
  if (page.url().includes('login.microsoftonline.com')) {
    const accountLink = page.locator('text=anthony.hopkins@sap.com').first();
    if (await accountLink.isVisible({ timeout: 5_000 }).catch(() => false)) await accountLink.click();
    await page.waitForURL('**/sap.sharepoint.com/**', { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
  }
}

async function acceptDebugScripts(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('button', { hasText: 'Load debug scripts' });
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(3_000);
      if (!await btn.isVisible({ timeout: 2_000 }).catch(() => false)) return;
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

test.describe('Edit Mode — Dual PiCanvas Config Inspection', () => {
  test.setTimeout(300_000);

  test('inspect both PiCanvas configs in edit mode', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]')) {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 500) });
      }
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT MODE — DUAL PICANVAS CONFIG INSPECTION');
    console.log(`${'═'.repeat(70)}\n`);

    // Load in read mode first (to get SSO)
    await page.goto(`${SP_URL}?${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await acceptDebugScripts(page);
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(10_000);

    // Switch to edit mode
    console.log('Switching to edit mode...');
    await page.goto(`${SP_URL}?Mode=Edit&${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptDebugScripts(page);
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    console.log('Waiting 25s for edit mode...');
    await page.waitForTimeout(25_000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-edit-top.png') });

    // Find both PiCanvas instances and their full webpart property configurations
    const editDiag = await page.evaluate(() => {
      const piCanvasFeatures = document.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]');
      const allControls = document.querySelectorAll('[data-automation-id="CanvasControl"]');
      const allSections = document.querySelectorAll('[data-automation-id="CanvasSection"]');

      // Map each PiCanvas with its section/column position and DOM context
      const instances = Array.from(piCanvasFeatures).map((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        const instanceId = h.getAttribute('data-sp-feature-instance-id') || '';

        // Parent control
        const parentCtrl = h.closest('[data-automation-id="CanvasControl"]');
        const parentSection = h.closest('[data-automation-id="CanvasSection"]');
        const sectionIdx = parentSection ? Array.from(allSections).indexOf(parentSection) : -1;

        // Count controls in the same section
        const controlsInSection = parentSection ? parentSection.querySelectorAll('[data-automation-id="CanvasControl"]').length : 0;

        // Find what's in the same section as this PiCanvas
        const sectionControls: Array<{ featureTag: string; id: string; height: number; top: number }> = [];
        if (parentSection) {
          parentSection.querySelectorAll('[data-automation-id="CanvasControl"]').forEach(ctrl => {
            const c = ctrl as HTMLElement;
            const ft = c.querySelector('[data-sp-feature-tag]');
            sectionControls.push({
              featureTag: ft?.getAttribute('data-sp-feature-tag')?.substring(0, 60) || '(none)',
              id: c.id || ft?.id || '',
              height: Math.round(c.getBoundingClientRect().height),
              top: Math.round(c.getBoundingClientRect().top),
            });
          });
        }

        // Get the domElement content (the webpart's rendered HTML)
        const domEl = h.querySelector('[data-addui="tabs"]');
        const tabsHolder = domEl?.querySelector('[role="tablist"], [role="tabs"]');
        const contentsHolder = domEl?.querySelector('[role="contents"]');
        const tabCount = tabsHolder?.querySelectorAll('.addui-Tabs-tab').length || 0;
        const contentCount = contentsHolder?.children.length || 0;

        // Check for the PiCanvas edit UI
        const hasConfigButton = !!h.querySelector('[data-action="configure"], button[title*="Configure"]');
        const editUIText = h.querySelector('.piCanvas')?.textContent?.substring(0, 200) || '';

        // Check the domElement innerHTML for property clues
        const domContent = h.innerHTML.substring(0, 500);

        return {
          index: i,
          instanceId,
          sectionIdx,
          controlsInSection,
          rect: { top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width) },
          tabCount,
          contentCount,
          hasConfigButton,
          editUIText: editUIText.substring(0, 200),
          domContent,
          sectionControls: sectionControls.slice(0, 10),
        };
      });

      // Build a map of ALL sections with their controls
      const sectionMap = Array.from(allSections).map((s, i) => {
        const section = s as HTMLElement;
        const rect = section.getBoundingClientRect();
        const controls = section.querySelectorAll('[data-automation-id="CanvasControl"]');
        const controlList = Array.from(controls).map(c => {
          const ft = c.querySelector('[data-sp-feature-tag]');
          return {
            featureTag: ft?.getAttribute('data-sp-feature-tag')?.substring(0, 50) || '(none)',
            instanceId: ft?.getAttribute('data-sp-feature-instance-id') || '',
            id: (c as HTMLElement).id || '',
            height: Math.round((c as HTMLElement).getBoundingClientRect().height),
          };
        });

        return {
          index: i,
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          controlCount: controls.length,
          controls: controlList,
          hasPiCanvas: controlList.some(c => c.featureTag.includes('PiCanvas')),
        };
      });

      return {
        piCanvasCount: piCanvasFeatures.length,
        totalControls: allControls.length,
        totalSections: allSections.length,
        instances,
        sectionMap: sectionMap.filter(s => s.hasPiCanvas || s.controlCount > 0),
        bodyClasses: document.body.className.substring(0, 200),
      };
    });

    // Print results
    console.log(`PiCanvas count: ${editDiag.piCanvasCount}`);
    console.log(`Total controls: ${editDiag.totalControls}`);
    console.log(`Total sections: ${editDiag.totalSections}`);
    console.log(`Body classes: ${editDiag.bodyClasses}`);

    for (const inst of editDiag.instances) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PICANVAS #${inst.index} — ${inst.instanceId}`);
      console.log(`${'─'.repeat(60)}`);
      console.log(`  Section: ${inst.sectionIdx} (${inst.controlsInSection} controls in section)`);
      console.log(`  Rect: top=${inst.rect.top} h=${inst.rect.height} w=${inst.rect.width}`);
      console.log(`  Tabs: ${inst.tabCount}, Content panels: ${inst.contentCount}`);
      console.log(`  Config button: ${inst.hasConfigButton}`);
      console.log(`  Edit UI text: ${inst.editUIText}`);
      console.log(`  DOM content: ${inst.domContent}`);
      console.log(`  Section controls:`);
      for (const c of inst.sectionControls) {
        console.log(`    ${c.featureTag} id=${c.id} h=${c.height} top=${c.top}`);
      }
    }

    console.log(`\n── SECTIONS WITH PICANVAS ──`);
    for (const s of editDiag.sectionMap.filter(s => s.hasPiCanvas)) {
      console.log(`\n  Section ${s.index}: h=${s.height} top=${s.top} controls=${s.controlCount}`);
      for (const c of s.controls) {
        const pc = c.featureTag.includes('PiCanvas') ? ' ◀ PICANVAS' : '';
        console.log(`    ${c.featureTag} instance=${c.instanceId} id=${c.id} h=${c.height}${pc}`);
      }
    }

    // Now scroll to each PiCanvas and take close-up screenshots
    for (const inst of editDiag.instances) {
      await page.evaluate(({ top }) => {
        const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
        (sr || document.documentElement).scrollTop = Math.max(0, top - 200);
      }, { top: inst.rect.top });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `02-picanvas-${inst.index}-edit.png`) });
    }

    // Scroll through the full page in edit mode
    const scrollHeight = await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      return (sr || document.documentElement).scrollHeight;
    });
    for (let i = 0; i <= 10; i++) {
      const pos = Math.round(scrollHeight * i / 10);
      await page.evaluate(({ p }) => {
        const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
        (sr || document.documentElement).scrollTop = p;
      }, { p: pos });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `03-scroll-${String(i).padStart(2, '0')}.png`) });
    }

    // Console messages
    console.log(`\n── Console (${consoleMessages.length}) ──`);
    for (const m of consoleMessages.slice(0, 30)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT INSPECTION COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
