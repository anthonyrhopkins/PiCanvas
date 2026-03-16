/**
 * Diagnose: Two PiCanvas instances on page — only the lower one works in Read mode.
 *
 * Steps:
 * 1. Load the page in Read mode (with debug manifests from localhost:4321)
 * 2. Capture screenshots + DOM state of both PiCanvas instances
 * 3. Check which one renders tabs, which one is broken, and why
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const DEBUG_PARAMS = 'debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/dual-picanvas-bug');

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

test.describe('Dual PiCanvas Bug — Read Mode Diagnosis', () => {
  test.setTimeout(300_000);

  test('diagnose two PiCanvas instances in read mode', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]') || (msg.type() === 'error' && !text.includes('ERR_') && !text.includes('favicon'))) {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 500) });
      }
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('DUAL PICANVAS BUG — READ MODE DIAGNOSIS');
    console.log(`${'═'.repeat(70)}\n`);

    // ── 1. Load in READ mode with debug manifests ──
    console.log('Loading page in READ mode...');
    await page.goto(`${SP_URL}?${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await acceptDebugScripts(page);
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    console.log('Waiting 20s for all webparts to render...');
    await page.waitForTimeout(20_000);

    // ── 2. Full-page screenshot ──
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-read-mode-top.png') });

    // ── 3. Find ALL PiCanvas instances ──
    const diagnosis = await page.evaluate(() => {
      // Find PiCanvas feature tags
      const piCanvasFeatures = document.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]');

      // Find addui-Tabs containers (rendered tab UI)
      const tabContainers = document.querySelectorAll('[data-addui="tabs"]');

      // Find all CanvasControls that contain PiCanvas
      const allControls = document.querySelectorAll('[data-automation-id="CanvasControl"]');

      const instances: Array<{
        index: number;
        featureTag: string;
        instanceId: string;
        webPartId: string;
        rect: { top: number; height: number; width: number };
        hasTabUI: boolean;
        tabCount: number;
        tabLabels: string[];
        parentControlRect: { top: number; height: number; width: number } | null;
        parentControlDisplay: string;
        parentControlVisibility: string;
        parentSectionIndex: number;
        innerHTML: string;
        bodyClasses: string;
        hidingActive: boolean;
        preHideStyles: string[];
        ancestorChain: string[];
      }> = [];

      piCanvasFeatures.forEach((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        const featureTag = h.getAttribute('data-sp-feature-tag') || '';
        const instanceId = h.getAttribute('data-sp-feature-instance-id') || '';
        const webPartId = h.getAttribute('data-sp-web-part-id') || '';

        // Find tab UI inside this instance
        const tabUI = h.querySelector('[data-addui="tabs"]');
        const tabHolder = tabUI?.querySelector('[role="tabs"]');
        const tabs = tabHolder?.querySelectorAll('.addui-Tabs-tab') || [];
        const tabLabels = Array.from(tabs).map(t => (t as HTMLElement).textContent?.trim() || '');

        // Find parent CanvasControl
        const parentControl = h.closest('[data-automation-id="CanvasControl"]');
        const parentControlRect = parentControl ? {
          top: Math.round((parentControl as HTMLElement).getBoundingClientRect().top),
          height: Math.round((parentControl as HTMLElement).getBoundingClientRect().height),
          width: Math.round((parentControl as HTMLElement).getBoundingClientRect().width),
        } : null;
        const parentControlStyle = parentControl ? window.getComputedStyle(parentControl as HTMLElement) : null;

        // Section index
        const sections = document.querySelectorAll('[data-automation-id="CanvasSection"]');
        const parentSection = h.closest('[data-automation-id="CanvasSection"]');
        const sectionIdx = parentSection ? Array.from(sections).indexOf(parentSection) : -1;

        // Ancestor chain for debugging
        const ancestors: string[] = [];
        let anc: HTMLElement | null = h;
        for (let j = 0; j < 20 && anc && anc !== document.body; j++) {
          const cs = window.getComputedStyle(anc);
          const aRect = anc.getBoundingClientRect();
          ancestors.push(
            `L${j}: <${anc.tagName.toLowerCase()}> h=${Math.round(aRect.height)} w=${Math.round(aRect.width)} display=${cs.display} visibility=${cs.visibility} opacity=${cs.opacity} class="${anc.className?.toString().substring(0, 60)}"`
          );
          anc = anc.parentElement;
        }

        // Check for pre-hide styles
        const allStyles = document.querySelectorAll('style[id*="picanvas-prehide"]');
        const preHideStyles = Array.from(allStyles).map(s => `id="${s.id}" content="${(s as HTMLStyleElement).textContent?.substring(0, 200)}"`);

        instances.push({
          index: i,
          featureTag: featureTag.substring(0, 80),
          instanceId,
          webPartId,
          rect: { top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width) },
          hasTabUI: !!tabUI,
          tabCount: tabs.length,
          tabLabels,
          parentControlRect,
          parentControlDisplay: parentControlStyle?.display || 'N/A',
          parentControlVisibility: parentControlStyle?.visibility || 'N/A',
          parentSectionIndex: sectionIdx,
          innerHTML: h.innerHTML.substring(0, 300),
          bodyClasses: document.body.className.substring(0, 200),
          hidingActive: document.body.classList.contains('picanvas-hiding-active'),
          preHideStyles,
          ancestorChain: ancestors,
        });
      });

      // Also check: which webparts are hidden by picanvas-hiding-active?
      const hiddenByCSS: Array<{ id: string; display: string; visibility: string; height: number }> = [];
      allControls.forEach(ctrl => {
        const h = ctrl as HTMLElement;
        const cs = window.getComputedStyle(h);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
          const ft = h.querySelector('[data-sp-feature-tag]');
          hiddenByCSS.push({
            id: ft?.getAttribute('data-sp-feature-tag') || h.id || '(unknown)',
            display: cs.display,
            visibility: cs.visibility,
            height: Math.round(h.getBoundingClientRect().height),
          });
        }
      });

      // Check for any content inside addui-Tabs containers
      const tabContainerDetails = Array.from(tabContainers).map((tc, i) => {
        const h = tc as HTMLElement;
        const rect = h.getBoundingClientRect();
        const tabs = h.querySelectorAll('.addui-Tabs-tab');
        const contents = h.querySelector('[role="contents"]');
        const contentChildren = contents?.children.length || 0;
        return {
          index: i,
          rect: { top: Math.round(rect.top), height: Math.round(rect.height) },
          tabCount: tabs.length,
          contentChildCount: contentChildren,
          tabLabels: Array.from(tabs).map(t => (t as HTMLElement).textContent?.trim().substring(0, 30) || ''),
          parentFeatureTag: h.closest('[data-sp-feature-tag]')?.getAttribute('data-sp-feature-tag') || '',
        };
      });

      // Check global registry info if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globalInfo = (window as any).__picanvasDebug || null;

      return {
        piCanvasCount: piCanvasFeatures.length,
        tabContainerCount: tabContainers.length,
        totalControls: allControls.length,
        instances,
        hiddenByCSS,
        tabContainerDetails,
        globalInfo,
        bodyScrollHeight: document.body.scrollHeight,
        localStorage: (() => {
          try {
            return localStorage.getItem('picanvas-connected-webparts')?.substring(0, 500) || 'null';
          } catch { return 'error'; }
        })(),
      };
    });

    // ── 4. Print diagnosis ──
    console.log(`\nPiCanvas instances found: ${diagnosis.piCanvasCount}`);
    console.log(`Tab containers (addui-Tabs): ${diagnosis.tabContainerCount}`);
    console.log(`Total CanvasControls: ${diagnosis.totalControls}`);
    console.log(`Body scroll height: ${diagnosis.bodyScrollHeight}`);
    console.log(`LocalStorage picanvas: ${diagnosis.localStorage}`);

    for (const inst of diagnosis.instances) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PICANVAS INSTANCE #${inst.index}`);
      console.log(`${'─'.repeat(60)}`);
      console.log(`  Feature tag: ${inst.featureTag}`);
      console.log(`  Instance ID: ${inst.instanceId}`);
      console.log(`  WebPart ID:  ${inst.webPartId}`);
      console.log(`  Section:     ${inst.parentSectionIndex}`);
      console.log(`  Rect:        top=${inst.rect.top} h=${inst.rect.height} w=${inst.rect.width}`);
      console.log(`  Has tab UI:  ${inst.hasTabUI}`);
      console.log(`  Tab count:   ${inst.tabCount}`);
      console.log(`  Tab labels:  ${JSON.stringify(inst.tabLabels)}`);
      console.log(`  Parent ctrl: ${inst.parentControlRect ? `top=${inst.parentControlRect.top} h=${inst.parentControlRect.height}` : 'N/A'}`);
      console.log(`  Parent display: ${inst.parentControlDisplay}`);
      console.log(`  Parent visibility: ${inst.parentControlVisibility}`);
      console.log(`  Hiding active: ${inst.hidingActive}`);
      console.log(`  Body classes: ${inst.bodyClasses}`);
      console.log(`  Pre-hide styles: ${inst.preHideStyles.length > 0 ? inst.preHideStyles.join('\n    ') : 'none'}`);
      console.log(`  innerHTML (300): ${inst.innerHTML}`);
      console.log(`  Ancestor chain:`);
      for (const a of inst.ancestorChain) {
        console.log(`    ${a}`);
      }
    }

    console.log(`\n── TAB CONTAINER DETAILS ──`);
    for (const tc of diagnosis.tabContainerDetails) {
      console.log(`  Container #${tc.index}: tabs=${tc.tabCount} contentChildren=${tc.contentChildCount}`);
      console.log(`    rect: top=${tc.rect.top} h=${tc.rect.height}`);
      console.log(`    labels: ${JSON.stringify(tc.tabLabels)}`);
      console.log(`    parent feature: ${tc.parentFeatureTag}`);
    }

    console.log(`\n── HIDDEN CONTROLS (${diagnosis.hiddenByCSS.length}) ──`);
    for (const h of diagnosis.hiddenByCSS) {
      console.log(`  ${h.id}: display=${h.display} visibility=${h.visibility} h=${h.height}`);
    }

    // ── 5. Scroll through page and take screenshots ──
    const scrollHeight = await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      return (sr || document.documentElement).scrollHeight;
    });

    for (let i = 0; i <= 6; i++) {
      const pos = Math.round(scrollHeight * i / 6);
      await page.evaluate(({ p }) => {
        const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
        (sr || document.documentElement).scrollTop = p;
      }, { p: pos });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `02-scroll-${i}.png`) });
    }

    // ── 6. Try scrolling to each PiCanvas instance and take close-up shots ──
    for (const inst of diagnosis.instances) {
      if (inst.rect.top > 0) {
        await page.evaluate(({ top }) => {
          const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
          (sr || document.documentElement).scrollTop = top - 100;
        }, { top: inst.rect.top });
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `03-picanvas-${inst.index}.png`) });
      }
    }

    // ── 7. Console messages ──
    console.log(`\n── Console Messages (${consoleMessages.length}) ──`);
    for (const m of consoleMessages.slice(0, 40)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log('DIAGNOSIS COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
