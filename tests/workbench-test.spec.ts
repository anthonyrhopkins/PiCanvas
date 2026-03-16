import { test, chromium } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

test('View AAHUB demo with debug manifests', async () => {
  const tmpProfile = path.join(os.tmpdir(), 'pw-aahub-' + Date.now());
  const browser = await chromium.launchPersistentContext(tmpProfile, {
    headless: false, channel: 'msedge', ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });

  const page = browser.pages()[0] || await browser.newPage();
  const url = 'https://sap.sharepoint.com/teams/AAHUB/SitePages/demo.aspx?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true';

  console.log('Navigating...');
  await page.goto(url, { timeout: 120000, waitUntil: 'commit' });

  // Wait for auth + page load
  console.log('Sign in if prompted, then approve MFA...');
  await page.waitForTimeout(60000);

  // Click "Load debug scripts" if present
  const loadBtn = page.locator('button:has-text("Load debug scripts"), a:has-text("Load debug scripts")');
  if (await loadBtn.isVisible().catch(() => false)) {
    await loadBtn.click();
    console.log('Clicked Load debug scripts');
    await page.waitForTimeout(15000);
  }

  // Wait for PiCanvas to render
  console.log('Waiting for content...');
  await page.waitForTimeout(15000);

  // Viewport screenshot (not fullPage — fixed position causes timeout)
  await page.screenshot({ path: '/tmp/demo-v3-pw.png', timeout: 15000 });
  console.log('Screenshot saved to /tmp/demo-v3-pw.png');

  // Keep open for inspection
  console.log('Browser open for 3 min...');
  await page.waitForTimeout(180000);
  await browser.close();
});
