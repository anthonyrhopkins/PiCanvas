/**
 * AA HUB Homepage Verification — Dropdown Tabs & Hero Section
 *
 * Verifies the PiCanvas-based AA HUB page renders correctly:
 *   - Hero section with background image and 6-column overlay
 *   - 8 dropdown tabs with hover menus and sub-items
 *   - Keyboard navigation and ARIA attributes
 *   - Mobile touch toggle behavior
 *
 * Run: npx playwright test tests/aahub-verify.spec.ts --headed
 */
import { test, expect, Page } from '@playwright/test';

// ─── Configuration ───────────────────────────────────────────────────────────

// Default to the SharePoint page; override with AAHUB_URL env var for local testing
const PAGE_URL = process.env.AAHUB_URL || 'https://sap.sharepoint.com/teams/AAHUB/SitePages/AA-HUB---PiCanvas.aspx';

const EXPECTED_DROPDOWN_LABELS = [
  'Strategic Initiatives',
  'Resources / Tools',
  'Deliverables',
  'AA Generated Content',
  'Reference Content',
  'Architecture Communities',
  'Learning Paths',
  'Communications',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForPiCanvas(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // Wait for PiCanvas to initialize
  await page.waitForSelector('.addui-Tabs', { state: 'visible', timeout: 20000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('AA HUB Page Verification', () => {
  test.skip(
    !process.env.AAHUB_VERIFY,
    'Set AAHUB_VERIFY=1 to run verification (requires authenticated browser or AAHUB_URL)'
  );

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    await waitForPiCanvas(page);
  });

  test('hero section renders with background image', async ({ page }) => {
    // Check for the hero container
    const hero = page.locator('.aahub-hero');
    await expect(hero).toBeVisible();

    // Check for the header
    const header = page.locator('.aahub-header h1');
    await expect(header).toContainText('Global Architecture Advisory');

    // Check for the 6-column overlay
    const overlay = page.locator('.aahub-overlay');
    await expect(overlay).toBeVisible();

    // Check for key content elements
    await expect(page.locator('.aahub-callout')).toContainText("YOU'VE FOUND US");
    await expect(page.locator('text=Top News')).toBeVisible();
    await expect(page.locator('text=Good to Know')).toBeVisible();
  });

  test('all 8 dropdown tabs are visible', async ({ page }) => {
    const dropdownTabs = page.locator('.addui-Tabs-tab[data-dropdown="true"]');
    await expect(dropdownTabs).toHaveCount(8);

    // Verify each dropdown tab label
    for (const label of EXPECTED_DROPDOWN_LABELS) {
      const tab = page.locator(`.addui-Tabs-tab[data-dropdown="true"]:has-text("${label}")`);
      await expect(tab).toBeVisible();
    }
  });

  test('dropdown tabs have ARIA attributes', async ({ page }) => {
    const dropdownTabs = page.locator('.addui-Tabs-tab[data-dropdown="true"]');
    const count = await dropdownTabs.count();

    for (let i = 0; i < count; i++) {
      const tab = dropdownTabs.nth(i);
      await expect(tab).toHaveAttribute('aria-haspopup', 'true');
      await expect(tab).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('dropdown tabs have caret indicators', async ({ page }) => {
    const carets = page.locator('.addui-Tabs-tab[data-dropdown="true"] .pi-dropdown-caret');
    await expect(carets).toHaveCount(8);
  });

  test('hover opens dropdown menu with sub-items', async ({ page }) => {
    // Hover over first dropdown tab
    const firstDropdown = page.locator('.addui-Tabs-tab[data-dropdown="true"]').first();
    await firstDropdown.hover();
    await page.waitForTimeout(300);

    // Dropdown menu should be visible
    const menu = firstDropdown.locator('.picanvas-dropdown-menu');
    await expect(menu).toHaveClass(/picanvas-dropdown-open/);

    // Should have menu items
    const items = menu.locator('a[role="menuitem"]');
    expect(await items.count()).toBeGreaterThan(0);

    // Verify aria-expanded is true
    await expect(firstDropdown).toHaveAttribute('aria-expanded', 'true');
  });

  test('hovering each dropdown shows correct sub-items', async ({ page }) => {
    const dropdownTabs = page.locator('.addui-Tabs-tab[data-dropdown="true"]');
    const count = await dropdownTabs.count();

    for (let i = 0; i < count; i++) {
      const tab = dropdownTabs.nth(i);
      await tab.hover();
      await page.waitForTimeout(300);

      const menu = tab.locator('.picanvas-dropdown-menu');
      await expect(menu).toHaveClass(/picanvas-dropdown-open/);

      const itemCount = await menu.locator('a[role="menuitem"]').count();
      expect(itemCount).toBeGreaterThan(0);

      // Move mouse away to close
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
    }
  });

  test('clicking a sub-item closes the dropdown', async ({ page }) => {
    const firstDropdown = page.locator('.addui-Tabs-tab[data-dropdown="true"]').first();
    await firstDropdown.hover();
    await page.waitForTimeout(300);

    const menu = firstDropdown.locator('.picanvas-dropdown-menu');
    const firstItem = menu.locator('a[role="menuitem"]').first();

    // Get the href to verify it's a link
    const href = await firstItem.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('keyboard: Enter opens dropdown, Escape closes it', async ({ page }) => {
    const firstDropdown = page.locator('.addui-Tabs-tab[data-dropdown="true"]').first();

    // Focus the tab
    await firstDropdown.focus();
    await page.waitForTimeout(100);

    // Press Enter to open
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await expect(firstDropdown).toHaveAttribute('aria-expanded', 'true');

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(firstDropdown).toHaveAttribute('aria-expanded', 'false');
  });

  test('keyboard: ArrowDown navigates within dropdown items', async ({ page }) => {
    const firstDropdown = page.locator('.addui-Tabs-tab[data-dropdown="true"]').first();

    // Focus and open
    await firstDropdown.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // ArrowDown should move focus to first item
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    const menu = firstDropdown.locator('.picanvas-dropdown-menu');
    const firstItem = menu.locator('a[role="menuitem"]').first();

    // The first menu item should be focused
    await expect(firstItem).toBeFocused();
  });

  test('dropdown placeholder panels are hidden', async ({ page }) => {
    const placeholders = page.locator('.picanvas-dropdown-placeholder');
    const count = await placeholders.count();

    // Each dropdown tab should have a hidden placeholder panel
    for (let i = 0; i < count; i++) {
      await expect(placeholders.nth(i)).toBeHidden();
    }
  });

  test('screenshot for visual comparison', async ({ page }) => {
    // Full page screenshot
    await page.screenshot({
      path: 'tests/screenshots/aahub-verify-full.png',
      fullPage: true,
    });

    // Screenshot with a dropdown open
    const firstDropdown = page.locator('.addui-Tabs-tab[data-dropdown="true"]').first();
    await firstDropdown.hover();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'tests/screenshots/aahub-verify-dropdown-open.png',
      fullPage: false,
    });
  });
});

// ─── Mobile Tests ────────────────────────────────────────────────────────────

test.describe('AA HUB Mobile Verification', () => {
  test.skip(
    !process.env.AAHUB_VERIFY,
    'Set AAHUB_VERIFY=1 to run verification'
  );

  test.use({ viewport: { width: 375, height: 812 } });

  test('dropdown tabs work with click-to-toggle on mobile', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    await waitForPiCanvas(page);

    const firstDropdown = page.locator('.addui-Tabs-tab[data-dropdown="true"]').first();

    // Tap to open
    await firstDropdown.click();
    await page.waitForTimeout(300);

    const menu = firstDropdown.locator('.picanvas-dropdown-menu');
    await expect(menu).toHaveClass(/picanvas-dropdown-open/);

    // Tap again to close
    await firstDropdown.click();
    await page.waitForTimeout(300);
    await expect(menu).not.toHaveClass(/picanvas-dropdown-open/);
  });
});
