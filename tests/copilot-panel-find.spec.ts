/**
 * Verify Copilot panel appears above the hero after CSS fix.
 */
import { test as base, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const test = base.extend({});

test.describe('Copilot Panel Verify', () => {
  test('copilot panel visible above hero', async () => {
    test.setTimeout(300000);

    const context = await chromium.launchPersistentContext(
      path.resolve(__dirname, '../.playwright-user-data'),
      { channel: 'msedge', headless: false, viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true }
    );

    const page = context.pages()[0] || await context.newPage();
    page.goto('https://sap.sharepoint.com/teams/AAHUB/SitePages/demo.aspx').catch(() => {});
    try {
      await page.waitForURL(url => url.href.includes('SitePages/'), { timeout: 15000, waitUntil: 'commit' });
    } catch {
      await page.waitForURL(url => url.href.includes('SitePages/'), { timeout: 240000, waitUntil: 'commit' });
    }
    try { await page.waitForLoadState('domcontentloaded', { timeout: 15000 }); } catch {}
    await page.waitForTimeout(12000);

    // Screenshot before click
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'copilot-verify-before.png'), type: 'png' });

    // Click the Copilot button (should be visible in waffle-clean mode header)
    const copilotBtn = page.locator('#SUITENAV_COPILOT');
    const count = await copilotBtn.count();
    console.log(`Copilot button found: ${count}`);

    if (count === 0) {
      console.log('Copilot button not found - checking if header is accessible...');
      // Check if the header bar is above hero
      const headerCheck = await page.evaluate(() => {
        const wrapper = document.querySelector('#SuiteNavWrapper') as HTMLElement;
        if (!wrapper) return 'No #SuiteNavWrapper';
        const cs = getComputedStyle(wrapper);
        return `z=${cs.zIndex} pos=${cs.position} visible=${cs.visibility} pointer=${cs.pointerEvents}`;
      });
      console.log(`Header: ${headerCheck}`);
      await context.close();
      return;
    }

    // Click Copilot
    console.log('Clicking Copilot...');
    await copilotBtn.click();
    await page.waitForTimeout(8000);

    // Screenshot after click
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'copilot-verify-after.png'), type: 'png' });

    // Check the panel z-index
    const panelInfo = await page.evaluate(() => {
      const result: string[] = [];

      // Check spPropertyPaneContainer
      const pane = document.querySelector('#spPropertyPaneContainer') as HTMLElement;
      if (pane) {
        const cs = getComputedStyle(pane);
        const rect = pane.getBoundingClientRect();
        result.push(`spPropertyPaneContainer: z=${cs.zIndex} pos=${cs.position} ${Math.round(rect.width)}x${Math.round(rect.height)} at(${Math.round(rect.left)},${Math.round(rect.top)})`);
      } else {
        result.push('spPropertyPaneContainer: NOT FOUND');
      }

      // Check copilot pane
      const copilotPane = document.querySelector('.propertyPaneCopilotPane') as HTMLElement;
      if (copilotPane) {
        const cs = getComputedStyle(copilotPane);
        const rect = copilotPane.getBoundingClientRect();
        result.push(`propertyPaneCopilotPane: z=${cs.zIndex} pos=${cs.position} ${Math.round(rect.width)}x${Math.round(rect.height)} at(${Math.round(rect.left)},${Math.round(rect.top)})`);
      } else {
        result.push('propertyPaneCopilotPane: NOT FOUND');
      }

      // Check hero z-index
      const hero = document.querySelector('.aahub-root') as HTMLElement;
      if (hero) {
        const cs = getComputedStyle(hero);
        result.push(`hero: z=${cs.zIndex}`);
      }

      // Check if copilot iframe is visible
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe, idx) => {
        const rect = iframe.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 200) {
          const cs = getComputedStyle(iframe);
          result.push(`visible_iframe_${idx}: ${Math.round(rect.width)}x${Math.round(rect.height)} at(${Math.round(rect.left)},${Math.round(rect.top)}) z=${cs.zIndex} src="${(iframe.src || '').substring(0, 80)}"`);
        }
      });

      return result;
    });

    console.log('\n-- Panel Info After Fix --');
    panelInfo.forEach(l => console.log(l));

    await context.close();
  });
});
