/**
 * Quick re-check: how many PiCanvas instances are visible after v2.4.0 upgrade?
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
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

test.describe('PiCanvas v2.4.0 visibility check', () => {
  test.setTimeout(180_000);

  test('count visible PiCanvas instances and their tab configs', async ({ edgePage: page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PiCanvas]') || msg.type() === 'error') {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 300) });
      }
    });

    await page.goto(SP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await page.waitForLoadState('load', { timeout: 60_000 });
    console.log('Waiting 20s for PiCanvas init...');
    await page.waitForTimeout(20_000);

    console.log(`\n${'═'.repeat(70)}`);
    console.log('PICANVAS v2.4.0 VISIBILITY CHECK');
    console.log(`${'═'.repeat(70)}\n`);

    // Full page screenshot
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '20-v240-fullpage.png'), fullPage: true });

    const results = await page.evaluate(() => {
      // Find all PiCanvas VPC containers
      const vpcContainers = document.querySelectorAll('[id*="vpc_WebPart.PiCanvasWebPart"]');

      const instances = Array.from(vpcContainers).map((vpc, i) => {
        const el = vpc as HTMLElement;
        const rect = el.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(el);

        // Find the addui-Tabs container inside
        const tabsContainer = el.querySelector('[data-addui="tabs"], .addui-Tabs');
        const tabHolder = el.querySelector('[role="tablist"], .addui-Tabs-tabHolder');
        const tabs = tabHolder ? tabHolder.querySelectorAll('[role="tab"], .addui-Tabs-tab') : [];
        const tabLabels = Array.from(tabs).map(t => {
          const label = t.textContent?.trim() || '';
          const isActive = t.classList.contains('addui-Tabs-tab--active') ||
                           t.getAttribute('aria-selected') === 'true' ||
                           t.classList.contains('active');
          return { label, isActive };
        });

        // Find tab content panels
        const tabPanels = el.querySelectorAll('[role="tabpanel"], .addui-Tabs-panel, .tab-pane');
        const panelInfo = Array.from(tabPanels).map((p, pi) => {
          const ph = p as HTMLElement;
          return {
            index: pi,
            display: window.getComputedStyle(ph).display,
            height: Math.round(ph.getBoundingClientRect().height),
            hasContent: ph.innerHTML.length > 50,
            contentPreview: ph.innerHTML.substring(0, 200),
          };
        });

        // Check data-content-only attribute
        const contentOnly = tabsContainer?.getAttribute('data-content-only') || '';

        // Walk up to find the section and check if it's hidden
        let parentSection: HTMLElement | null = el;
        let sectionDisplay = '';
        let sectionHeight = 0;
        for (let j = 0; j < 15 && parentSection; j++) {
          if (parentSection.getAttribute('data-automation-id') === 'CanvasSection' ||
              parentSection.classList.contains('CanvasSection')) {
            sectionDisplay = window.getComputedStyle(parentSection).display;
            sectionHeight = Math.round(parentSection.getBoundingClientRect().height);
            break;
          }
          parentSection = parentSection.parentElement;
        }

        // Check all ancestors for display:none
        let hiddenAncestor = '';
        let ancestor: HTMLElement | null = el;
        for (let j = 0; j < 20 && ancestor; j++) {
          const ad = window.getComputedStyle(ancestor).display;
          if (ad === 'none') {
            hiddenAncestor = `${ancestor.tagName}#${ancestor.id || ''}.${ancestor.className?.toString().substring(0, 50) || ''}`;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        return {
          index: i,
          instanceId: el.id.replace('vpc_WebPart.PiCanvasWebPart.external.', ''),
          rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          tabCount: tabLabels.length,
          tabLabels,
          panelCount: panelInfo.length,
          panels: panelInfo,
          contentOnly,
          sectionDisplay,
          sectionHeight,
          hiddenAncestor,
          parentClass: el.parentElement?.className?.toString().substring(0, 80) || '',
        };
      });

      // Also count visible sections
      const allSections = document.querySelectorAll('[data-automation-id="CanvasSection"]');
      const sectionSummary = Array.from(allSections).map((s, i) => {
        const sh = s as HTMLElement;
        const display = window.getComputedStyle(sh).display;
        const h = Math.round(sh.getBoundingClientRect().height);
        // Check if this section contains a PiCanvas
        const hasPiCanvas = !!sh.querySelector('[id*="vpc_WebPart.PiCanvasWebPart"]');
        return { index: i, display, height: h, hasPiCanvas };
      });

      return { instances, sectionSummary, totalSections: allSections.length };
    });

    console.log(`Found ${results.instances.length} PiCanvas instances:\n`);

    for (const inst of results.instances) {
      const visible = inst.rect.height > 0 && !inst.hiddenAncestor;
      const status = visible ? 'VISIBLE' : 'HIDDEN';
      console.log(`  PiCanvas #${inst.index + 1} [${status}] — ${inst.instanceId}`);
      console.log(`    Position: top=${inst.rect.top}, h=${inst.rect.height}, w=${inst.rect.width}`);
      console.log(`    Display: ${inst.display}, visibility: ${inst.visibility}, opacity: ${inst.opacity}`);
      console.log(`    Parent class: "${inst.parentClass}"`);
      console.log(`    Content-only: ${inst.contentOnly}`);
      if (inst.hiddenAncestor) {
        console.log(`    Hidden by ancestor: ${inst.hiddenAncestor}`);
      }
      console.log(`    Section: display=${inst.sectionDisplay}, h=${inst.sectionHeight}`);
      console.log(`    Tabs (${inst.tabCount}):`);
      for (const t of inst.tabLabels) {
        console.log(`      ${t.isActive ? '→' : ' '} "${t.label}"`);
      }
      console.log(`    Panels (${inst.panelCount}):`);
      for (const p of inst.panels) {
        console.log(`      Panel ${p.index}: display=${p.display}, h=${p.height}, content=${p.hasContent}`);
        if (p.contentPreview) console.log(`        preview: ${p.contentPreview.substring(0, 120)}`);
      }
      console.log('');
    }

    console.log(`\nPage sections: ${results.totalSections}`);
    const visibleSections = results.sectionSummary.filter(s => s.display !== 'none' && s.height > 0);
    const hiddenSections = results.sectionSummary.filter(s => s.display === 'none' || s.height === 0);
    console.log(`  Visible: ${visibleSections.length}`);
    console.log(`  Hidden: ${hiddenSections.length}`);
    for (const s of results.sectionSummary) {
      const marker = s.hasPiCanvas ? ' ◀ HAS PICANVAS' : '';
      const vis = s.display === 'none' ? 'HIDDEN' : s.height === 0 ? 'COLLAPSED' : 'VISIBLE';
      console.log(`    Section ${s.index}: ${vis} (display=${s.display}, h=${s.height})${marker}`);
    }

    // Console log summary
    console.log(`\n── PiCanvas Console Messages (${consoleMessages.length}) ──`);
    for (const m of consoleMessages.slice(0, 30)) {
      console.log(`  [${m.type}] ${m.text}`);
    }

    // Scroll through the page and take viewport screenshots
    const scrollRegion = await page.evaluate(() => {
      const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      return sr ? { scrollHeight: sr.scrollHeight, clientHeight: sr.clientHeight } : null;
    });

    if (scrollRegion) {
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const scrollTop = Math.round((scrollRegion.scrollHeight - scrollRegion.clientHeight) * (i / steps));
        await page.evaluate((top) => {
          const sr = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
          if (sr) sr.scrollTop = top;
        }, scrollTop);
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `21-scroll-${i}.png`) });
      }
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log('CHECK COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
