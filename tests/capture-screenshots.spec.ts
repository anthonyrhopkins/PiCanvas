/**
 * PiCanvas Screenshot Capture — uses test harness, no SharePoint auth needed.
 *
 * Usage:
 *   npx playwright test tests/capture-screenshots.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/images');
const HARNESS_URL = 'http://localhost:8765/tests/harness.html';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function shot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, type: 'png' });
  console.log(`  ✓ ${name}.png`);
}

async function openPanel(page: Page) {
  await page.evaluate(() => (window as any).__picanvas.openPanel());
  await page.waitForSelector('.picanvas-config-overlay', { state: 'attached' });
  await page.waitForTimeout(300);
}

async function goTo(page: Page, section: string) {
  await page.click(`.picanvas-config-sidebar-item[data-section="${section}"]`);
  await page.waitForTimeout(400);
}

test.describe('Screenshot Capture', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Tabs section', async ({ page }) => {
    await openPanel(page);
    await shot(page, 'config-panel-tabs');
  });

  test('Tabs with expanded tab', async ({ page }) => {
    await openPanel(page);
    const header = page.locator('.picanvas-config-tab-card-header').first();
    await header.click();
    await page.waitForTimeout(400);
    await shot(page, 'config-panel-tabs-expanded');
  });

  test('Appearance', async ({ page }) => {
    await openPanel(page);
    await goTo(page, 'appearance');
    await shot(page, 'settings-appearance');
  });

  test('Colors', async ({ page }) => {
    await openPanel(page);
    await goTo(page, 'colors');
    await shot(page, 'settings-colors');
  });

  test('Typography', async ({ page }) => {
    await openPanel(page);
    await goTo(page, 'typography');
    await shot(page, 'settings-typography');
  });

  test('Borders (Typography scrolled)', async ({ page }) => {
    await openPanel(page);
    await goTo(page, 'typography');
    const borders = page.locator('text=Corner Radius').first();
    await borders.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, 'settings-borders');
  });

  test('Templates', async ({ page }) => {
    await openPanel(page);
    await goTo(page, 'templates');
    await shot(page, 'settings-templates');
  });

  test('Advanced / Troubleshooting', async ({ page }) => {
    await openPanel(page);
    await goTo(page, 'advanced');
    await shot(page, 'settings-troubleshooting');
  });

  test('Permissions in tab', async ({ page }) => {
    await openPanel(page);
    await goTo(page, 'tabs');
    // Expand first tab card
    const header = page.locator('.picanvas-config-tab-card-header').first();
    await header.click();
    await page.waitForSelector('.picanvas-config-tab-card.expanded', { timeout: 3000 });
    await page.waitForTimeout(300);
    // Scroll to permissions if visible
    const perms = page.locator('text=Permissions').first();
    if (await perms.isVisible()) {
      await perms.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await shot(page, 'settings-permissions');
  });

  // Help section not available in test harness — capture from SharePoint
});
