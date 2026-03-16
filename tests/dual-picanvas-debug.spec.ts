/**
 * Dual PiCanvas diagnostic — troubleshoot two PiCanvas webparts on one page.
 * Target: https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx
 */
import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/dual-picanvas');

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

test.describe('Dual PiCanvas Debug — /sites/202833 SecAware', () => {
  test.setTimeout(180_000);

  test('diagnose two PiCanvas instances on one page', async ({ edgePage: page }) => {
    // ── 1. Navigate & authenticate ──
    console.log(`\n${'═'.repeat(70)}`);
    console.log('DUAL PICANVAS DIAGNOSTIC');
    console.log(`${'═'.repeat(70)}\n`);

    await page.goto(SP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await page.waitForLoadState('load', { timeout: 60_000 });

    // Wait for PiCanvas to initialize (it hides/moves webparts after render)
    console.log('Waiting 20s for PiCanvas initialization...');
    await page.waitForTimeout(20_000);

    const title = await page.title();
    console.log(`Page: "${title}" — ${page.url()}\n`);

    // ── 2. Full-page screenshot ──
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-initial-load.png'), fullPage: true });

    // ── 3. Detect PiCanvas instances ──
    const picanvasInfo = await page.evaluate(() => {
      // PiCanvas renders tabs inside elements with the module-scoped CSS class
      // Look for the tab containers and the surrounding webpart wrappers
      const allWpContainers = document.querySelectorAll('[data-sp-web-part]');
      const picanvasInstances: Array<{
        index: number;
        instanceId: string;
        wpId: string;
        tabCount: number;
        tabLabels: string[];
        visibleTabs: string[];
        activeTab: string;
        boundingRect: { top: number; left: number; width: number; height: number };
        isVisible: boolean;
        hiddenWebparts: number;
        containerHTML: string;
      }> = [];

      // Find PiCanvas webparts by looking for the characteristic tab UL or picanvas data attributes
      allWpContainers.forEach((wp, idx) => {
        const wpId = wp.getAttribute('data-sp-web-part') || '';
        const innerHtml = wp.innerHTML;

        // PiCanvas detection: look for tab ULs, picanvas class patterns, or the AddTabs structure
        const hasTabUl = wp.querySelector('ul.nav-tabs, ul[role="tablist"], .picanvas-tabs');
        const hasPiCanvasClass = innerHtml.includes('piCanvas') || innerHtml.includes('PiCanvas') || innerHtml.includes('addTabs');
        const hasTabContent = wp.querySelector('.tab-content, .picanvas-tab-content');

        if (hasTabUl || hasPiCanvasClass || hasTabContent) {
          // Get tab info
          const tabElements = wp.querySelectorAll('ul.nav-tabs li a, ul[role="tablist"] li a, ul[role="tablist"] button, .picanvas-tab');
          const tabLabels: string[] = [];
          const visibleTabs: string[] = [];
          let activeTab = '';

          tabElements.forEach(tab => {
            const label = tab.textContent?.trim() || '';
            tabLabels.push(label);
            const el = tab as HTMLElement;
            if (window.getComputedStyle(el).display !== 'none') {
              visibleTabs.push(label);
            }
            if (tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true' ||
                tab.closest('li')?.classList.contains('active')) {
              activeTab = label;
            }
          });

          // Count hidden webparts controlled by this instance
          const hiddenPanels = wp.querySelectorAll('.tab-pane, [role="tabpanel"]');
          let hiddenCount = 0;
          hiddenPanels.forEach(panel => {
            if (window.getComputedStyle(panel as HTMLElement).display === 'none') hiddenCount++;
          });

          const rect = wp.getBoundingClientRect();
          picanvasInstances.push({
            index: idx,
            instanceId: wpId,
            wpId,
            tabCount: tabLabels.length,
            tabLabels,
            visibleTabs,
            activeTab,
            boundingRect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
            isVisible: rect.height > 0 && window.getComputedStyle(wp as HTMLElement).display !== 'none',
            hiddenWebparts: hiddenCount,
            containerHTML: wp.innerHTML.substring(0, 500),
          });
        }
      });

      // Also look for PiCanvas via the known pattern: div IDs containing the instanceId pattern
      const tabsDivs = document.querySelectorAll('[id*="Tabs_"]');
      const tabsDivInfo = Array.from(tabsDivs).map(el => ({
        id: el.id,
        childCount: el.children.length,
        visible: window.getComputedStyle(el as HTMLElement).display !== 'none',
        rect: {
          top: Math.round(el.getBoundingClientRect().top),
          height: Math.round(el.getBoundingClientRect().height),
        },
      }));

      return {
        totalWebparts: allWpContainers.length,
        picanvasInstances,
        tabsDivs: tabsDivInfo,
      };
    });

    console.log(`── WEBPART SCAN ──`);
    console.log(`Total webparts on page: ${picanvasInfo.totalWebparts}`);
    console.log(`PiCanvas instances detected: ${picanvasInfo.picanvasInstances.length}`);
    console.log(`Tabs_ divs found: ${picanvasInfo.tabsDivs.length}\n`);

    for (const inst of picanvasInfo.picanvasInstances) {
      console.log(`  PiCanvas #${inst.index}:`);
      console.log(`    Instance ID: ${inst.instanceId}`);
      console.log(`    Visible: ${inst.isVisible}`);
      console.log(`    Position: top=${inst.boundingRect.top}, left=${inst.boundingRect.left}`);
      console.log(`    Size: ${inst.boundingRect.width}x${inst.boundingRect.height}`);
      console.log(`    Tabs (${inst.tabCount}): [${inst.tabLabels.join(', ')}]`);
      console.log(`    Active tab: "${inst.activeTab}"`);
      console.log(`    Hidden panels: ${inst.hiddenWebparts}`);
      console.log('');
    }

    for (const td of picanvasInfo.tabsDivs) {
      console.log(`  Tabs div: ${td.id} — ${td.childCount} children, visible=${td.visible}, top=${td.rect.top}, h=${td.rect.height}`);
    }

    // ── 4. Check the global registry ──
    const registryInfo = await page.evaluate(() => {
      // PiCanvas stores the registry on the class; we can check window for any exposed refs
      // Also check localStorage for picanvas-connected-webparts
      const storageKey = 'picanvas-connected-webparts';
      const stored = localStorage.getItem(storageKey);

      // Check for console errors related to PiCanvas
      // (can't retroactively capture, but we can look for error indicators)

      // Look for hidden sections/webparts (display:none) that PiCanvas controls
      const hiddenSections = document.querySelectorAll('[style*="display: none"], [style*="display:none"]');
      const picanvasHidden: Array<{ tag: string; id: string; cls: string; dataAttrs: Record<string, string> }> = [];

      hiddenSections.forEach(el => {
        const html = el.innerHTML || '';
        // Only capture webpart-related hidden elements
        if (el.closest('[data-sp-web-part]') || el.getAttribute('data-sp-canvascontrol') ||
            el.classList.toString().includes('CanvasSection') || el.classList.toString().includes('ControlZone')) {
          picanvasHidden.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            cls: el.className?.toString().substring(0, 80) || '',
            dataAttrs: Object.fromEntries(
              Array.from(el.attributes)
                .filter(a => a.name.startsWith('data-'))
                .map(a => [a.name, a.value.substring(0, 60)])
            ),
          });
        }
      });

      return {
        localStorage: stored ? JSON.parse(stored) : null,
        hiddenElements: picanvasHidden.length,
        hiddenDetails: picanvasHidden.slice(0, 20),
      };
    });

    console.log(`\n── PICANVAS STATE ──`);
    console.log(`localStorage (picanvas-connected-webparts):`);
    console.log(JSON.stringify(registryInfo.localStorage, null, 2));
    console.log(`\nHidden webpart/section elements: ${registryInfo.hiddenElements}`);
    for (const h of registryInfo.hiddenDetails) {
      console.log(`  <${h.tag}> id="${h.id}" class="${h.cls}"`);
      for (const [k, v] of Object.entries(h.dataAttrs)) {
        console.log(`    ${k}="${v}"`);
      }
    }

    // ── 5. Console error capture (going forward) ──
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning' && msg.text().includes('PiCanvas')) consoleWarnings.push(msg.text());
    });

    // ── 6. Check for conflicts between instances ──
    const conflictCheck = await page.evaluate(() => {
      // Look for duplicate IDs (a common multi-instance issue)
      const allIds = document.querySelectorAll('[id]');
      const idCounts: Record<string, number> = {};
      allIds.forEach(el => {
        const id = el.id;
        idCounts[id] = (idCounts[id] || 0) + 1;
      });
      const duplicateIds = Object.entries(idCounts).filter(([, count]) => count > 1).map(([id, count]) => ({ id: id.substring(0, 80), count }));

      // Check for CSS conflicts — multiple picanvas style elements
      const picanvasStyles = document.querySelectorAll('style[id*="picanvas"]');
      const styleIds = Array.from(picanvasStyles).map(s => s.id);

      // Check sections — are all expected sections present?
      const allSections = document.querySelectorAll('[data-automation-id="CanvasSection"]');
      const sectionInfo = Array.from(allSections).map((s, i) => {
        const el = s as HTMLElement;
        const display = window.getComputedStyle(el).display;
        const visibility = window.getComputedStyle(el).visibility;
        return {
          index: i,
          display,
          visibility,
          height: Math.round(el.getBoundingClientRect().height),
          hasContent: el.children.length > 0,
          dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => `${a.name}=${a.value.substring(0, 40)}`),
        };
      });

      return {
        duplicateIds: duplicateIds.filter(d => d.id.includes('picanvas') || d.id.includes('Tabs') || d.id.includes('PiCanvas')),
        allDuplicates: duplicateIds.length,
        picanvasStyleElements: styleIds,
        totalSections: allSections.length,
        sections: sectionInfo,
      };
    });

    console.log(`\n── CONFLICT CHECK ──`);
    console.log(`PiCanvas-related duplicate IDs: ${conflictCheck.duplicateIds.length}`);
    for (const d of conflictCheck.duplicateIds) {
      console.log(`  DUPLICATE: "${d.id}" appears ${d.count} times`);
    }
    console.log(`Total duplicate IDs on page: ${conflictCheck.allDuplicates}`);
    console.log(`PiCanvas style elements: [${conflictCheck.picanvasStyleElements.join(', ')}]`);
    console.log(`\nPage sections: ${conflictCheck.totalSections}`);
    for (const s of conflictCheck.sections) {
      const status = s.display === 'none' ? 'HIDDEN' : s.height === 0 ? 'EMPTY' : 'VISIBLE';
      console.log(`  Section ${s.index}: ${status} (display=${s.display}, h=${s.height}, children=${s.hasContent})`);
      for (const attr of s.dataAttrs) {
        console.log(`    ${attr}`);
      }
    }

    // ── 7. Tab interaction test — click each tab on each instance ──
    console.log(`\n── TAB INTERACTION TEST ──`);

    // Find all tab ULs
    const tabInteraction = await page.evaluate(() => {
      const tabLists = document.querySelectorAll('ul.nav-tabs, ul[role="tablist"]');
      const results: Array<{
        listIndex: number;
        listId: string;
        tabs: Array<{ label: string; href: string; isActive: boolean }>;
        parentWpId: string;
      }> = [];

      tabLists.forEach((ul, idx) => {
        const links = ul.querySelectorAll('a[data-toggle="tab"], a[role="tab"], button[role="tab"]');
        const tabs = Array.from(links).map(a => ({
          label: a.textContent?.trim() || '',
          href: a.getAttribute('href') || a.getAttribute('data-bs-target') || '',
          isActive: a.classList.contains('active') || a.getAttribute('aria-selected') === 'true',
        }));

        const wpParent = ul.closest('[data-sp-web-part]');
        results.push({
          listIndex: idx,
          listId: ul.id || `(no id, index ${idx})`,
          tabs,
          parentWpId: wpParent?.getAttribute('data-sp-web-part') || 'unknown',
        });
      });

      return results;
    });

    for (const tl of tabInteraction) {
      console.log(`\n  Tab list #${tl.listIndex} (id="${tl.listId}", parent wp="${tl.parentWpId}"):`);
      for (const t of tl.tabs) {
        const marker = t.isActive ? ' ◀ ACTIVE' : '';
        console.log(`    "${t.label}" → ${t.href}${marker}`);
      }
    }

    // Click through tabs on each list and verify content switches
    for (let listIdx = 0; listIdx < tabInteraction.length; listIdx++) {
      const tl = tabInteraction[listIdx];
      console.log(`\n  Clicking through tabs in list #${listIdx}...`);

      for (let tabIdx = 0; tabIdx < tl.tabs.length; tabIdx++) {
        const tabLabel = tl.tabs[tabIdx].label;
        try {
          // Click the tab
          const tabLocator = page.locator(`ul.nav-tabs, ul[role="tablist"]`).nth(listIdx).locator('a, button').nth(tabIdx);
          await tabLocator.click({ timeout: 5_000 });
          await page.waitForTimeout(1_000);

          // Check what happened
          const afterClick = await page.evaluate((args) => {
            const { listIdx: li, tabIdx: ti } = args;
            const ul = document.querySelectorAll('ul.nav-tabs, ul[role="tablist"]')[li];
            if (!ul) return { error: 'Tab list not found after click' };

            const links = ul.querySelectorAll('a, button');
            const clickedTab = links[ti];
            const isNowActive = clickedTab?.classList.contains('active') ||
                                clickedTab?.getAttribute('aria-selected') === 'true' ||
                                clickedTab?.closest('li')?.classList.contains('active');

            // Check if the linked panel is visible
            const href = clickedTab?.getAttribute('href') || '';
            let panelVisible = false;
            if (href && href.startsWith('#')) {
              const panel = document.querySelector(href);
              if (panel) {
                panelVisible = window.getComputedStyle(panel as HTMLElement).display !== 'none';
              }
            }

            return { isNowActive, panelVisible, href };
          }, { listIdx, tabIdx });

          const status = afterClick.isNowActive ? 'ACTIVE' : 'NOT active';
          const panelStatus = afterClick.panelVisible ? 'panel VISIBLE' : 'panel HIDDEN';
          console.log(`    Tab "${tabLabel}": ${status}, ${panelStatus} (${afterClick.href})`);

          // Screenshot after each tab click
          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, `02-list${listIdx}-tab${tabIdx}-${tabLabel.replace(/[^a-zA-Z0-9]/g, '_')}.png`)
          });
        } catch (err: any) {
          console.log(`    Tab "${tabLabel}": CLICK FAILED — ${err.message}`);
        }
      }
    }

    // ── 8. Check for JS errors accumulated during interaction ──
    if (consoleErrors.length > 0) {
      console.log(`\n── CONSOLE ERRORS (${consoleErrors.length}) ──`);
      for (const err of consoleErrors.slice(0, 20)) {
        console.log(`  ERROR: ${err.substring(0, 200)}`);
      }
    }
    if (consoleWarnings.length > 0) {
      console.log(`\n── PICANVAS WARNINGS (${consoleWarnings.length}) ──`);
      for (const w of consoleWarnings.slice(0, 10)) {
        console.log(`  WARN: ${w.substring(0, 200)}`);
      }
    }

    // ── 9. Deep DOM dump of PiCanvas containers ──
    const deepDump = await page.evaluate(() => {
      // Find all elements whose innerHTML contains 'addTabs' or 'piCanvas'
      const picanvasContainers = document.querySelectorAll('[class*="piCanvas"], [class*="PiCanvas"], [id*="piCanvas"], [id*="PiCanvas"]');
      const containerInfo = Array.from(picanvasContainers).map(el => {
        const h = el as HTMLElement;
        return {
          tag: h.tagName.toLowerCase(),
          id: h.id || '',
          className: h.className?.toString().substring(0, 100) || '',
          display: window.getComputedStyle(h).display,
          height: Math.round(h.getBoundingClientRect().height),
          childElementCount: h.childElementCount,
        };
      });

      // Find any error banners or warnings rendered by PiCanvas
      const errorBanners = document.querySelectorAll('[class*="error"], [class*="warning"], [class*="alert"]');
      const picanvasErrors = Array.from(errorBanners)
        .filter(el => el.closest('[data-sp-web-part]')?.innerHTML.includes('piCanvas'))
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim().substring(0, 200) || '',
          className: el.className?.toString().substring(0, 80) || '',
        }));

      return { picanvasContainers: containerInfo, picanvasErrors };
    });

    console.log(`\n── DEEP DOM DUMP ──`);
    console.log(`PiCanvas DOM elements: ${deepDump.picanvasContainers.length}`);
    for (const c of deepDump.picanvasContainers) {
      console.log(`  <${c.tag}> id="${c.id}" class="${c.className}" display=${c.display} h=${c.height} children=${c.childElementCount}`);
    }
    if (deepDump.picanvasErrors.length > 0) {
      console.log(`\nPiCanvas error/warning banners:`);
      for (const e of deepDump.picanvasErrors) {
        console.log(`  <${e.tag}> class="${e.className}": ${e.text}`);
      }
    }

    // ── 10. Final full-page screenshot ──
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-final-state.png'), fullPage: true });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('DIAGNOSTIC COMPLETE — screenshots in tests/test-results/dual-picanvas/');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
