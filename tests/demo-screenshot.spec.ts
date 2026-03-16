/**
 * Click Copilot button and find the panel element.
 */
import { test as base, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const test = base.extend({});

test.describe('Copilot Panel', () => {
  test('find copilot panel', async () => {
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
    await page.waitForTimeout(8000);

    // Click the Copilot button
    const copilotBtn = page.locator('#SUITENAV_COPILOT');
    if (await copilotBtn.count() > 0) {
      console.log('🤖 Clicking Copilot button...');
      await copilotBtn.click();
      await page.waitForTimeout(3000);

      // Screenshot after click
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'copilot-click.png'), type: 'png' });

      // Find new panels/overlays that appeared
      const diag = await page.evaluate(() => {
        const i: Record<string, string> = {};

        // Look for panels, dialogs, overlays
        const allEls = document.querySelectorAll('*');
        let panels = 0;
        for (let j = 0; j < allEls.length && panels < 15; j++) {
          const el = allEls[j] as HTMLElement;
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          // Look for fixed/absolute elements that appeared (likely panels)
          if ((cs.position === 'fixed' || cs.position === 'absolute') &&
              rect.width > 200 && rect.height > 200 &&
              rect.right > 1000 && // right side of screen
              cs.display !== 'none' && cs.visibility !== 'hidden') {
            const tag = el.tagName.toLowerCase();
            const id = el.id || '';
            const cls = (el.className?.toString() || '').substring(0, 80);
            const role = el.getAttribute('role') || '';
            const aid = el.getAttribute('data-automation-id') || '';
            i[`panel_${panels}`] = `<${tag}> id="${id}" aid="${aid}" role="${role}" cls="${cls}" ${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)},${Math.round(rect.top)}) z=${cs.zIndex} pos=${cs.position}`;
            panels++;
          }
        }
        i['panels_total'] = String(panels);

        // Also check for iframes (Copilot might be in an iframe)
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe, idx) => {
          const rect = iframe.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) {
            const cs = getComputedStyle(iframe);
            i[`iframe_${idx}`] = `src="${(iframe.src || '').substring(0, 100)}" ${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)},${Math.round(rect.top)}) z=${cs.zIndex}`;
          }
        });

        // Check for aria-expanded on copilot button
        const btn = document.querySelector('#SUITENAV_COPILOT') as HTMLElement;
        if (btn) {
          i['copilot_expanded'] = btn.getAttribute('aria-expanded') || 'not set';
          i['copilot_pressed'] = btn.getAttribute('aria-pressed') || 'not set';
        }

        return i;
      });

      console.log('\n── After Copilot Click ──');
      for (const [k, v] of Object.entries(diag)) console.log(`  ${k}: ${v}`);
      console.log('📸 copilot-click.png');
    } else {
      console.log('❌ No Copilot button found');
    }

    await context.close();
  });
});
