import { test, expect, Page } from '@playwright/test';

const URL = 'http://localhost:8765/tests/resize-harness.html';

// Helper: get a property from the mock store
async function getProp(page: Page, key: string): Promise<any> {
  return page.evaluate((k) => (window as any).__picanvas_resize.getProperty(k), key);
}

// ────────────────────────────────────────────────────
// 1. RESIZE ROW RENDERING
// ────────────────────────────────────────────────────

test.describe('Resize Row Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  test('renders resize rows only for JS tabs in contained mode', async ({ page }) => {
    // Tab 1 (JS contained) and Tab 2 (JS contained) should have resize rows
    const resizeRows = page.locator('[data-js-resize]');
    await expect(resizeRows).toHaveCount(2);
  });

  test('does not render resize row for non-JS tab', async ({ page }) => {
    // Tab 3 is a webpart tab — no resize row
    const tab3Resize = page.locator('[data-js-resize="3"]');
    await expect(tab3Resize).toHaveCount(0);
  });

  test('each resize row has drag handle, label, Auto button, and warning', async ({ page }) => {
    const handle = page.locator('[data-drag-handle="1"]');
    const label = page.locator('[data-height-label="1"]');
    const autoBtn = page.locator('[data-auto-height="1"]');
    const warning = page.locator('[data-height-warning="1"]');

    await expect(handle).toBeVisible();
    await expect(label).toBeVisible();
    await expect(autoBtn).toBeVisible();
    await expect(warning).toBeAttached(); // hidden by default
  });

  test('height label shows configured value for tab 1', async ({ page }) => {
    const label = page.locator('[data-height-label="1"]');
    await expect(label).toHaveText('300px');
  });

  test('height label shows "auto" when no height configured', async ({ page }) => {
    const label = page.locator('[data-height-label="2"]');
    await expect(label).toHaveText('auto');
  });

  test('warning icon is hidden by default', async ({ page }) => {
    const warning = page.locator('[data-height-warning="1"]');
    await expect(warning).toHaveCSS('display', 'none');
  });
});

// ────────────────────────────────────────────────────
// 2. DRAG-TO-RESIZE
// ────────────────────────────────────────────────────

test.describe('Drag to Resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  test('dragging handle updates height label live', async ({ page }) => {
    const handle = page.locator('[data-drag-handle="1"]');
    const label = page.locator('[data-height-label="1"]');

    // Starting at 300px; drag down by 100px
    const box = await handle.boundingBox();
    if (!box) throw new Error('Handle not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 100, { steps: 5 });

    // Label should show ~400px during drag
    const text = await label.textContent();
    expect(text).toBe('400px');

    await page.mouse.up();
  });

  test('drag persists final height to property store', async ({ page }) => {
    const handle = page.locator('[data-drag-handle="1"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Handle not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 5 });
    await page.mouse.up();

    const height = await getProp(page, 'tab1JavaScriptHeight');
    expect(height).toBe('350px');
  });

  test('drag enforces minimum height of 50px', async ({ page }) => {
    const handle = page.locator('[data-drag-handle="1"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Handle not visible');

    // Drag up by 500px (from 300 → would be -200, clamped to 50)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 500, { steps: 5 });
    await page.mouse.up();

    const height = await getProp(page, 'tab1JavaScriptHeight');
    expect(height).toBe('50px');
  });

  test('body gets compactJsResizeActive class during drag', async ({ page }) => {
    const handle = page.locator('[data-drag-handle="1"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Handle not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 20, { steps: 2 });

    // During drag, body should have the class
    const hasClass = await page.evaluate(() => document.body.classList.contains('compactJsResizeActive'));
    expect(hasClass).toBe(true);

    await page.mouse.up();

    // After drag, class should be removed
    const hasClassAfter = await page.evaluate(() => document.body.classList.contains('compactJsResizeActive'));
    expect(hasClassAfter).toBe(false);
  });

  test('drag on tab 2 (no initial height) defaults to 300 start', async ({ page }) => {
    const handle = page.locator('[data-drag-handle="2"]');
    const label = page.locator('[data-height-label="2"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Handle not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 5 });
    await page.mouse.up();

    const text = await label.textContent();
    expect(text).toBe('350px');
    const height = await getProp(page, 'tab2JavaScriptHeight');
    expect(height).toBe('350px');
  });
});

// ────────────────────────────────────────────────────
// 3. AUTO-SIZE BUTTON
// ────────────────────────────────────────────────────

test.describe('Auto-Size Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  test('clicking Auto triggers height detection for tab 1', async ({ page }) => {
    const autoBtn = page.locator('[data-auto-height="1"]');
    const label = page.locator('[data-height-label="1"]');

    await autoBtn.click();

    // Should show "..." briefly, then a numeric height
    await expect(label).not.toHaveText('...', { timeout: 2000 });
    const text = await label.textContent();
    expect(text).toMatch(/^\d+px$/);
  });

  test('clicking Auto for tab 2 detects content height', async ({ page }) => {
    const autoBtn = page.locator('[data-auto-height="2"]');
    const label = page.locator('[data-height-label="2"]');

    await autoBtn.click();
    await expect(label).not.toHaveText('...', { timeout: 2000 });

    const text = await label.textContent();
    expect(text).toMatch(/^\d+px$/);

    // Should also persist to properties
    const height = await getProp(page, 'tab2JavaScriptHeight');
    expect(height).toMatch(/^\d+px$/);
  });

  test('auto-detected height is stored in autoDetectedHeights map', async ({ page }) => {
    const autoBtn = page.locator('[data-auto-height="1"]');
    await autoBtn.click();
    await page.waitForTimeout(500);

    const hasEntry = await page.evaluate(() => (window as any).__picanvas_resize.autoDetectedHeights.has(1));
    expect(hasEntry).toBe(true);
  });
});

// ────────────────────────────────────────────────────
// 4. HEIGHT MISMATCH WARNING
// ────────────────────────────────────────────────────

test.describe('Height Mismatch Warning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  test('warning shows when manual height differs significantly from auto-detected', async ({ page }) => {
    const warning = page.locator('[data-height-warning="1"]');

    // First auto-detect to establish baseline
    await page.locator('[data-auto-height="1"]').click();
    await page.waitForTimeout(500);

    // Now drag to a very different height
    const handle = page.locator('[data-drag-handle="1"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Handle not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 400, { steps: 5 });
    await page.mouse.up();

    // Warning should be visible (content is small, we set height very large)
    const display = await warning.evaluate(el => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
  });

  test('warning has descriptive tooltip', async ({ page }) => {
    // Auto-detect first
    await page.locator('[data-auto-height="1"]').click();
    await page.waitForTimeout(500);

    // Drag far
    const handle = page.locator('[data-drag-handle="1"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error('Handle not visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 400, { steps: 5 });
    await page.mouse.up();

    const warning = page.locator('[data-height-warning="1"]');
    const title = await warning.getAttribute('title');
    expect(title).toContain('Height mismatch');
  });

  test('warning is hidden when heights are close', async ({ page }) => {
    // Auto-detect to establish baseline
    await page.locator('[data-auto-height="1"]').click();
    await page.waitForTimeout(500);

    // Get the auto-detected height
    const autoHeight = await page.evaluate(() => (window as any).__picanvas_resize.autoDetectedHeights.get(1));

    // Set manual height close to auto-detected
    await page.evaluate((h) => {
      (window as any).__picanvas_resize.setProperty('tab1JavaScriptHeight', `${h}px`);
    }, autoHeight);

    // Re-render to update
    await page.evaluate(() => (window as any).__picanvas_resize.render());

    // Auto-detect again so checkHeightWarning runs
    await page.locator('[data-auto-height="1"]').click();
    await page.waitForTimeout(500);

    const warning = page.locator('[data-height-warning="1"]');
    await expect(warning).toHaveCSS('display', 'none');
  });
});

// ────────────────────────────────────────────────────
// 5. TAB ROW STRUCTURE
// ────────────────────────────────────────────────────

test.describe('Tab Row Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  test('all 3 tabs are rendered', async ({ page }) => {
    const tabRows = page.locator('[data-configure-tab]');
    await expect(tabRows).toHaveCount(3);
  });

  test('tab labels match configuration', async ({ page }) => {
    await expect(page.locator('.compactTabName').nth(0)).toHaveText('Dashboard');
    await expect(page.locator('.compactTabName').nth(1)).toHaveText('Charts');
    await expect(page.locator('.compactTabName').nth(2)).toHaveText('Overview');
  });

  test('JS tabs show JS badge', async ({ page }) => {
    const badges = page.locator('.compactBadgeType');
    await expect(badges.nth(0)).toHaveText('JS');
    await expect(badges.nth(1)).toHaveText('JS');
    await expect(badges.nth(2)).toHaveText('WP');
  });

  test('resize handle has row-resize cursor', async ({ page }) => {
    const handle = page.locator('[data-drag-handle="1"]');
    await expect(handle).toHaveCSS('cursor', 'row-resize');
  });
});
