/**
 * Debug v4 — trace the huge gap: find all 45 CanvasControls,
 * map their containers, and identify invisible PiCanvas instances.
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const DEBUG_PARAMS = 'debugManifestsFile=https://localhost:4321/temp/build/manifests.js&debug=true&noredir=true';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/edit-debug-v4');

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

test.describe('Edit Debug v4 — trace the gap', () => {
  test.setTimeout(300_000);

  test('map all controls and find invisible PiCanvas instances', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]') || (msg.type() === 'error' && !text.includes('ERR_') && !text.includes('favicon'))) {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 400) });
      }
    });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('EDIT DEBUG v4 — TRACE THE GAP');
    console.log(`${'═'.repeat(70)}\n`);

    // Load read mode first
    await page.goto(`${SP_URL}?${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await acceptDebugScripts(page);
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(15_000);

    // Switch to edit mode
    console.log('Entering edit mode...');
    await page.goto(`${SP_URL}?Mode=Edit&${DEBUG_PARAMS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptDebugScripts(page);
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    console.log('Waiting 25s...');
    await page.waitForTimeout(25_000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-edit-top.png') });

    // ── Deep DOM trace of ALL controls ──
    const deepTrace = await page.evaluate(() => {
      const controls = document.querySelectorAll('[data-automation-id="CanvasControl"]');
      const sections = document.querySelectorAll('[data-automation-id="CanvasSection"]');

      // Map each control: what it is, where it lives, is it visible?
      const controlMap = Array.from(controls).map((ctrl, i) => {
        const el = ctrl as HTMLElement;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // What webpart is inside?
        const featureTag = el.querySelector('[data-sp-feature-tag]');
        const featureName = featureTag?.getAttribute('data-sp-feature-tag') || '';
        const instanceId = featureTag?.getAttribute('data-sp-feature-instance-id') || '';
        const wpId = featureTag?.getAttribute('data-sp-web-part-id') || '';

        // Is it a PiCanvas?
        const isPiCanvas = featureName.includes('PiCanvas');

        // Find parent section
        const parentSection = el.closest('[data-automation-id="CanvasSection"]');
        const sectionIdx = parentSection ? Array.from(sections).indexOf(parentSection) : -1;

        // Find the ControlZone wrapper
        const controlZone = el.closest('.ControlZone, [class*="controlZone"], [class*="ControlZone"]');
        const czHeight = controlZone ? Math.round((controlZone as HTMLElement).getBoundingClientRect().height) : -1;
        const czDisplay = controlZone ? window.getComputedStyle(controlZone as HTMLElement).display : '';
        const czClass = controlZone ? (controlZone as HTMLElement).className?.toString().substring(0, 80) : '';

        // Walk ancestors to find first hidden one
        let hiddenAt = '';
        let anc: HTMLElement | null = el;
        for (let j = 0; j < 30 && anc && anc !== document.body; j++) {
          const cs = window.getComputedStyle(anc);
          if (cs.display === 'none') {
            hiddenAt = `level ${j}: <${anc.tagName.toLowerCase()}> class="${anc.className?.toString().substring(0, 60)}"`;
            break;
          }
          if (parseFloat(cs.height) === 0 && cs.overflow === 'hidden') {
            hiddenAt = `level ${j}: <${anc.tagName.toLowerCase()}> height=0+overflow:hidden class="${anc.className?.toString().substring(0, 60)}"`;
            break;
          }
          anc = anc.parentElement;
        }

        return {
          index: i,
          featureName: featureName.substring(0, 50),
          instanceId: instanceId.substring(0, 40),
          isPiCanvas,
          rect: { top: Math.round(rect.top), height: Math.round(rect.height), width: Math.round(rect.width) },
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          sectionIdx,
          czHeight,
          czDisplay,
          czClass,
          hiddenAt,
        };
      });

      // Trace the "gap" — find elements between visible content
      // Look for all direct children of the canvas zone with their positions
      const canvasZone = document.querySelector('[data-automation-id="CanvasZone"]') ||
                         document.querySelector('.Canvas--canvasZone') ||
                         document.querySelector('[class*="canvasZone"]');
      let canvasChildren: Array<{ tag: string; cls: string; height: number; top: number; display: string; hasPiCanvas: boolean; childCount: number }> = [];
      if (canvasZone) {
        canvasChildren = Array.from(canvasZone.children).map(child => {
          const ch = child as HTMLElement;
          const rect = ch.getBoundingClientRect();
          const hasPiCanvas = !!ch.querySelector('[data-sp-feature-tag*="PiCanvas"]');
          return {
            tag: ch.tagName.toLowerCase(),
            cls: ch.className?.toString().substring(0, 80) || '',
            height: Math.round(rect.height),
            top: Math.round(rect.top),
            display: window.getComputedStyle(ch).display,
            hasPiCanvas,
            childCount: ch.childElementCount,
          };
        });
      }

      // Also search broader — any element with PiCanvas in its content
      const allPiCanvasRefs = document.querySelectorAll(
        '[data-sp-feature-tag*="PiCanvas"], [id*="PiCanvasWebPart"], [data-sp-web-part-id="6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5"]'
      );
      const picanvasElements = Array.from(allPiCanvasRefs).map((el, i) => {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        const featureTag = h.getAttribute('data-sp-feature-tag') || h.id || '';
        const instanceId = h.getAttribute('data-sp-feature-instance-id') || '';

        // Walk up and log each ancestor
        const ancestors: string[] = [];
        let anc: HTMLElement | null = h;
        for (let j = 0; j < 15 && anc && anc !== document.body; j++) {
          const cs = window.getComputedStyle(anc);
          const aRect = anc.getBoundingClientRect();
          ancestors.push(
            `L${j}: <${anc.tagName.toLowerCase()}> h=${Math.round(aRect.height)} display=${cs.display} class="${anc.className?.toString().substring(0, 50)}"`
          );
          anc = anc.parentElement;
        }

        return {
          index: i,
          featureTag: featureTag.substring(0, 60),
          instanceId,
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          ancestors,
        };
      });

      // Section details
      const sectionDetails = Array.from(sections).map((s, i) => {
        const el = s as HTMLElement;
        const rect = el.getBoundingClientRect();
        const controlsInSection = el.querySelectorAll('[data-automation-id="CanvasControl"]').length;
        const picanvasInSection = el.querySelectorAll('[data-sp-feature-tag*="PiCanvas"]').length;
        return {
          index: i,
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          display: window.getComputedStyle(el).display,
          controls: controlsInSection,
          picanvasCount: picanvasInSection,
          className: el.className?.toString().substring(0, 80) || '',
        };
      });

      return {
        totalControls: controls.length,
        totalSections: sections.length,
        picanvasCount: allPiCanvasRefs.length,
        controlMap: controlMap.filter(c => c.isPiCanvas || c.rect.height === 0 || c.hiddenAt),
        allPiCanvas: controlMap.filter(c => c.isPiCanvas),
        canvasZoneFound: !!canvasZone,
        canvasZoneClass: canvasZone ? (canvasZone as HTMLElement).className?.toString().substring(0, 80) : 'NOT FOUND',
        canvasChildren,
        picanvasElements,
        sections: sectionDetails,
        bodyScrollHeight: document.body.scrollHeight,
      };
    });

    console.log(`Total CanvasControls: ${deepTrace.totalControls}`);
    console.log(`Total Sections: ${deepTrace.totalSections}`);
    console.log(`PiCanvas elements: ${deepTrace.picanvasCount}`);
    console.log(`Body scroll height: ${deepTrace.bodyScrollHeight}`);

    console.log(`\n── ALL PICANVAS ELEMENTS (${deepTrace.picanvasElements.length}) ──`);
    for (const p of deepTrace.picanvasElements) {
      console.log(`\n  PiCanvas #${p.index}: instance=${p.instanceId}`);
      console.log(`    height=${p.height}, top=${p.top}`);
      console.log(`    Ancestor chain:`);
      for (const a of p.ancestors) {
        console.log(`      ${a}`);
      }
    }

    console.log(`\n── PICANVAS CANVAS CONTROLS (${deepTrace.allPiCanvas.length}) ──`);
    for (const c of deepTrace.allPiCanvas) {
      const vis = c.hiddenAt ? 'HIDDEN' : c.rect.height > 0 ? 'VISIBLE' : 'ZERO-H';
      console.log(`  Control #${c.index} [${vis}] ${c.featureName} instance=${c.instanceId}`);
      console.log(`    rect: top=${c.rect.top} h=${c.rect.height} w=${c.rect.width}`);
      console.log(`    display=${c.display} visibility=${c.visibility} opacity=${c.opacity}`);
      console.log(`    section=${c.sectionIdx} czHeight=${c.czHeight} czDisplay=${c.czDisplay}`);
      console.log(`    czClass="${c.czClass}"`);
      if (c.hiddenAt) console.log(`    HIDDEN AT: ${c.hiddenAt}`);
    }

    console.log(`\n── CANVAS ZONE CHILDREN (${deepTrace.canvasChildren.length}) ──`);
    console.log(`Canvas zone: ${deepTrace.canvasZoneClass}`);
    for (const c of deepTrace.canvasChildren) {
      const vis = c.display === 'none' ? 'HIDDEN' : c.height > 0 ? 'VISIBLE' : 'EMPTY';
      const pc = c.hasPiCanvas ? ' ◀ PICANVAS' : '';
      console.log(`  <${c.tag}> [${vis}] h=${c.height} top=${c.top} children=${c.childCount}${pc}`);
      console.log(`    class="${c.cls}"`);
    }

    console.log(`\n── SECTIONS (${deepTrace.sections.length}) ──`);
    for (const s of deepTrace.sections) {
      const pc = s.picanvasCount > 0 ? ` ◀ ${s.picanvasCount} PICANVAS` : '';
      console.log(`  Section ${s.index}: h=${s.height} top=${s.top} controls=${s.controls}${pc}`);
      console.log(`    display=${s.display} class="${s.className}"`);
    }

    console.log(`\n── ZERO-HEIGHT / HIDDEN CONTROLS (${deepTrace.controlMap.length}) ──`);
    for (const c of deepTrace.controlMap) {
      console.log(`  Control #${c.index}: ${c.featureName || '(no feature)'} h=${c.rect.height} section=${c.sectionIdx}`);
      if (c.hiddenAt) console.log(`    HIDDEN: ${c.hiddenAt}`);
    }

    // ── Scroll screenshots through the gap ──
    const scrollHeight = await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      return (sr || document.documentElement).scrollHeight;
    });
    for (let i = 0; i <= 8; i++) {
      const pos = Math.round(scrollHeight * i / 8);
      await page.evaluate(({ p }) => {
        const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
        (sr || document.documentElement).scrollTop = p;
      }, { p: pos });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `10-scroll-${i}.png`) });
    }

    // Console messages
    console.log(`\n── Console (${consoleMessages.length}) ──`);
    for (const m of consoleMessages.slice(0, 30)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log('TRACE COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
