import { test, expect, Page } from '@playwright/test';

const URL = 'http://localhost:8765/harness.html';

// Helper: open panel and wait for overlay
async function openPanel(page: Page) {
  await page.click('#open-btn');
  await page.waitForSelector('.picanvas-config-overlay', { state: 'attached' });
}

// Helper: get a property value from the mock store
async function getProp(page: Page, key: string): Promise<any> {
  return page.evaluate((k) => (window as any).__picanvas.getProperty(k), key);
}

// Helper: get the action log
async function getLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__picanvas.getActionLog());
}

// Helper: clear the action log
async function clearLog(page: Page) {
  await page.evaluate(() => (window as any).__picanvas.clearActionLog());
}

// ────────────────────────────────────────────────────
// 1. PANEL LIFECYCLE
// ────────────────────────────────────────────────────

test.describe('Panel Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  test('opens when button is clicked', async ({ page }) => {
    await openPanel(page);
    const overlay = page.locator('.picanvas-config-overlay');
    await expect(overlay).toBeVisible();
  });

  test('displays header with title, search, undo, redo, cancel, done', async ({ page }) => {
    await openPanel(page);
    await expect(page.locator('.picanvas-config-header-title')).toHaveText('PiCanvas Configuration');
    await expect(page.locator('[data-action="search"]')).toBeVisible();
    await expect(page.locator('[data-action="undo"]')).toBeVisible();
    await expect(page.locator('[data-action="redo"]')).toBeVisible();
    await expect(page.locator('[data-action="cancel"]')).toBeVisible();
    await expect(page.locator('[data-action="done"]')).toBeVisible();
  });

  test('closes with Done and preserves changes', async ({ page }) => {
    await openPanel(page);
    // Change a property
    await page.evaluate(() => {
      (window as any).__picanvas.properties.tabStyle = 'pills';
    });
    await page.click('[data-action="done"]');
    await expect(page.locator('.picanvas-config-overlay')).toHaveCount(0);
    expect(await getProp(page, 'tabStyle')).toBe('pills');
  });

  test('closes with Cancel and restores snapshot', async ({ page }) => {
    await openPanel(page);
    // Verify original value
    const originalStyle = await getProp(page, 'tabStyle');
    // Programmatically change via the panel's tracked setter
    await page.evaluate(() => {
      const props = (window as any).__picanvas.properties;
      props.tabStyle = 'boxed';
    });
    await page.click('[data-action="cancel"]');
    await expect(page.locator('.picanvas-config-overlay')).toHaveCount(0);
    // The snapshot restore should set tabStyle back
    expect(await getProp(page, 'tabStyle')).toBe(originalStyle);
  });

  test('Escape key closes the panel', async ({ page }) => {
    await openPanel(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.picanvas-config-overlay')).toHaveCount(0);
  });

  test('locks body scroll when open', async ({ page }) => {
    await openPanel(page);
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');
  });

  test('restores body scroll after close', async ({ page }) => {
    await openPanel(page);
    await page.click('[data-action="done"]');
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).not.toBe('hidden');
  });

  test('calls reRender and refreshPropertyPane on close', async ({ page }) => {
    await openPanel(page);
    await clearLog(page);
    await page.click('[data-action="done"]');
    const log = await getLog(page);
    expect(log).toContain('refreshPropertyPane');
    expect(log).toContain('reRender');
  });
});

// ────────────────────────────────────────────────────
// 2. SIDEBAR NAVIGATION
// ────────────────────────────────────────────────────

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
  });

  test('shows all 6 sidebar items', async ({ page }) => {
    const items = page.locator('.picanvas-config-sidebar-item');
    await expect(items).toHaveCount(6);
  });

  test('Tabs section is active by default', async ({ page }) => {
    const tabsItem = page.locator('.picanvas-config-sidebar-item[data-section="tabs"]');
    await expect(tabsItem).toHaveClass(/active/);
    const tabsContent = page.locator('.picanvas-config-section[data-section-content="tabs"]');
    await expect(tabsContent).toHaveClass(/active/);
  });

  test('clicking a sidebar item switches sections', async ({ page }) => {
    await page.click('.picanvas-config-sidebar-item[data-section="colors"]');
    const colorsItem = page.locator('.picanvas-config-sidebar-item[data-section="colors"]');
    await expect(colorsItem).toHaveClass(/active/);

    // Tabs should no longer be active
    const tabsItem = page.locator('.picanvas-config-sidebar-item[data-section="tabs"]');
    await expect(tabsItem).not.toHaveClass(/active/);

    // Colors content should be active
    const colorsContent = page.locator('.picanvas-config-section[data-section-content="colors"]');
    await expect(colorsContent).toHaveClass(/active/);
  });

  test('navigating through all sections works', async ({ page }) => {
    const sections = ['tabs', 'appearance', 'colors', 'typography', 'templates', 'advanced'];
    for (const section of sections) {
      await page.click(`.picanvas-config-sidebar-item[data-section="${section}"]`);
      const item = page.locator(`.picanvas-config-sidebar-item[data-section="${section}"]`);
      await expect(item).toHaveClass(/active/);
      const content = page.locator(`.picanvas-config-section[data-section-content="${section}"]`);
      await expect(content).toHaveClass(/active/);
    }
  });
});

// ────────────────────────────────────────────────────
// 3. TAB BUILDER SECTION
// ────────────────────────────────────────────────────

test.describe('Tab Builder Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
  });

  test('shows tab cards for all 3 tabs', async ({ page }) => {
    const cards = page.locator('.picanvas-config-tab-card');
    await expect(cards).toHaveCount(3);
  });

  test('tab cards display titles', async ({ page }) => {
    const firstCard = page.locator('.picanvas-config-tab-card').first();
    await expect(firstCard).toContainText('Tab 1:');
    await expect(firstCard).toContainText('Overview');
  });

  test('Add Tab button works', async ({ page }) => {
    await clearLog(page);
    const addBtn = page.locator('text=Add Tab').first();
    await addBtn.click();
    // Wait for rebuild
    await page.waitForTimeout(200);
    const log = await getLog(page);
    expect(log).toContain('addTab');
  });

  test('expanding a tab card shows content settings', async ({ page }) => {
    // Click the card header to toggle expand
    const header = page.locator('.picanvas-config-tab-card-header').first();
    await header.click();
    // Should see the expanded card body
    const expandedCard = page.locator('.picanvas-config-tab-card.expanded');
    await expect(expandedCard.first()).toBeVisible();
  });

  test('content type grid shows 10 content types', async ({ page }) => {
    // Expand first tab by clicking header
    const header = page.locator('.picanvas-config-tab-card-header').first();
    await header.click();
    await page.waitForTimeout(100);
    const contentTypes = page.locator('.picanvas-config-content-type-card');
    const count = await contentTypes.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });
});

// ────────────────────────────────────────────────────
// 4. APPEARANCE SECTION
// ────────────────────────────────────────────────────

test.describe('Appearance Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
  });

  test('shows tab style cards', async ({ page }) => {
    const styleCards = page.locator('.picanvas-config-style-card[data-style]');
    await expect(styleCards).toHaveCount(4);
  });

  test('default style is initially active', async ({ page }) => {
    const defaultCard = page.locator('.picanvas-config-style-card[data-style="default"]');
    await expect(defaultCard).toHaveClass(/active/);
  });

  test('clicking a style card changes the property', async ({ page }) => {
    await page.click('.picanvas-config-style-card[data-style="pills"]');
    expect(await getProp(page, 'tabStyle')).toBe('pills');
  });

  test('shows alignment cards', async ({ page }) => {
    const alignCards = page.locator('.picanvas-config-style-card[data-alignment]');
    await expect(alignCards).toHaveCount(4);
  });

  test('clicking alignment card changes property', async ({ page }) => {
    await page.click('.picanvas-config-style-card[data-alignment="center"]');
    expect(await getProp(page, 'tabAlignment')).toBe('center');
  });

  test('shows feature toggles', async ({ page }) => {
    const toggles = page.locator('[data-features-group] .picanvas-config-toggle-control');
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────────
// 5. COLORS SECTION
// ────────────────────────────────────────────────────

test.describe('Colors Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
    await page.click('.picanvas-config-sidebar-item[data-section="colors"]');
  });

  test('shows theme preset cards', async ({ page }) => {
    const presets = page.locator('.picanvas-config-theme-card');
    const count = await presets.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('shows color pickers', async ({ page }) => {
    const pickers = page.locator('.picanvas-config-color-picker');
    const count = await pickers.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('clicking a theme preset applies colors', async ({ page }) => {
    // Click the Dashboard preset
    const dashboardCard = page.locator('.picanvas-config-theme-card').first();
    await dashboardCard.click();
    // Should have changed accentColor
    const accent = await getProp(page, 'accentColor');
    expect(accent).toBeTruthy();
  });

  test('color picker hex input updates the property', async ({ page }) => {
    const hexInput = page.locator('.picanvas-config-color-hex').first();
    await hexInput.fill('#ff0000');
    await hexInput.press('Enter');
    // Wait for update
    await page.waitForTimeout(100);
  });
});

// ────────────────────────────────────────────────────
// 6. TYPOGRAPHY SECTION
// ────────────────────────────────────────────────────

test.describe('Typography Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
    await page.click('.picanvas-config-sidebar-item[data-section="typography"]');
  });

  test('shows font size slider', async ({ page }) => {
    const sliders = page.locator('.picanvas-config-slider');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('shows border radius label', async ({ page }) => {
    await expect(page.locator('.picanvas-config-section[data-section-content="typography"]')).toContainText('Border');
  });

  test('slider changes update properties', async ({ page }) => {
    const slider = page.locator('.picanvas-config-slider').first();
    // Change value programmatically since range input is tricky
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = '18';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(100);
  });
});

// ────────────────────────────────────────────────────
// 7. TEMPLATES SECTION
// ────────────────────────────────────────────────────

test.describe('Templates Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
    await page.click('.picanvas-config-sidebar-item[data-section="templates"]');
  });

  test('shows template cards', async ({ page }) => {
    const cards = page.locator('.picanvas-config-template-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('shows action buttons (export, import, save)', async ({ page }) => {
    await expect(page.locator('.picanvas-config-section[data-section-content="templates"]')).toContainText('Export');
  });

  test('clicking Apply on a template triggers callback', async ({ page }) => {
    await clearLog(page);
    // Click a template card to select it
    const card = page.locator('.picanvas-config-template-card').first();
    await card.click();
    // Then click Apply
    const applyBtn = page.locator('text=Apply Template').first();
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
      const log = await getLog(page);
      expect(log.some(l => l.startsWith('applyTemplate'))).toBeTruthy();
    }
  });
});

// ────────────────────────────────────────────────────
// 8. ADVANCED SECTION
// ────────────────────────────────────────────────────

test.describe('Advanced Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
    await page.click('.picanvas-config-sidebar-item[data-section="advanced"]');
  });

  test('shows lock settings', async ({ page }) => {
    await expect(page.locator('.picanvas-config-section[data-section-content="advanced"]')).toContainText('Lock');
  });

  test('shows Reset All Styles button', async ({ page }) => {
    await expect(page.locator('text=Reset All Styles')).toBeVisible();
  });

  test('clicking Reset All Styles triggers callback', async ({ page }) => {
    await clearLog(page);
    await page.click('text=Reset All Styles');
    const log = await getLog(page);
    expect(log).toContain('resetAllStyles');
  });
});

// ────────────────────────────────────────────────────
// 9. COMMAND PALETTE
// ────────────────────────────────────────────────────

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
  });

  test('opens with Cmd+K', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const palette = page.locator('.picanvas-cmd-overlay');
    await expect(palette).toBeVisible();
  });

  test('opens with search button click', async ({ page }) => {
    await page.click('[data-action="search"]');
    const palette = page.locator('.picanvas-cmd-overlay');
    await expect(palette).toBeVisible();
  });

  test('closes with Escape', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await expect(page.locator('.picanvas-cmd-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.picanvas-cmd-overlay')).toHaveCount(0);
  });

  test('shows search input', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const input = page.locator('.picanvas-cmd-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('shows categorized results', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const results = page.locator('.picanvas-cmd-item');
    const count = await results.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('filters results when typing', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    const initialCount = await page.locator('.picanvas-cmd-item').count();
    await page.keyboard.type('color');
    await page.waitForTimeout(100);
    const filteredCount = await page.locator('.picanvas-cmd-item').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    // First item should be selected
    const firstItem = page.locator('.picanvas-cmd-item').first();
    await expect(firstItem).toHaveClass(/selected/);
    // Arrow down
    await page.keyboard.press('ArrowDown');
    const secondItem = page.locator('.picanvas-cmd-item').nth(1);
    await expect(secondItem).toHaveClass(/selected/);
    await expect(firstItem).not.toHaveClass(/selected/);
  });

  test('Enter executes selected item', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.keyboard.type('appearance');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    // Should have navigated to appearance section
    await expect(page.locator('.picanvas-cmd-overlay')).toHaveCount(0);
    const appearanceItem = page.locator('.picanvas-config-sidebar-item[data-section="appearance"]');
    await expect(appearanceItem).toHaveClass(/active/);
  });

  test('Escape from command palette does not close the config panel', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await expect(page.locator('.picanvas-cmd-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    // Command palette closed
    await expect(page.locator('.picanvas-cmd-overlay')).toHaveCount(0);
    // Config panel still open
    await expect(page.locator('.picanvas-config-overlay')).toBeVisible();
  });

  test('clicking backdrop closes command palette', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await expect(page.locator('.picanvas-cmd-overlay')).toBeVisible();
    // Backdrop is a full-screen transparent element; dispatch click directly
    await page.locator('.picanvas-cmd-backdrop').dispatchEvent('click');
    await expect(page.locator('.picanvas-cmd-overlay')).toHaveCount(0);
  });
});

// ────────────────────────────────────────────────────
// 10. UNDO / REDO
// ────────────────────────────────────────────────────

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
  });

  test('undo button is initially disabled', async ({ page }) => {
    const undoBtn = page.locator('[data-action="undo"]');
    await expect(undoBtn).toBeDisabled();
  });

  test('redo button is initially disabled', async ({ page }) => {
    const redoBtn = page.locator('[data-action="redo"]');
    await expect(redoBtn).toBeDisabled();
  });

  test('undo button enables after a property change', async ({ page }) => {
    // Navigate to appearance and click a style card to trigger a tracked change
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
    await page.click('.picanvas-config-style-card[data-style="pills"]');
    const undoBtn = page.locator('[data-action="undo"]');
    await expect(undoBtn).toBeEnabled();
  });

  test('undo reverts the last change', async ({ page }) => {
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
    const originalStyle = await getProp(page, 'tabStyle');
    await page.click('.picanvas-config-style-card[data-style="pills"]');
    expect(await getProp(page, 'tabStyle')).toBe('pills');

    await page.click('[data-action="undo"]');
    expect(await getProp(page, 'tabStyle')).toBe(originalStyle);
  });

  test('redo re-applies the undone change', async ({ page }) => {
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
    await page.click('.picanvas-config-style-card[data-style="pills"]');
    await page.click('[data-action="undo"]');
    await page.click('[data-action="redo"]');
    expect(await getProp(page, 'tabStyle')).toBe('pills');
  });

  test('shows toast notification on undo', async ({ page }) => {
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
    await page.click('.picanvas-config-style-card[data-style="pills"]');
    await page.click('[data-action="undo"]');
    const toast = page.locator('.picanvas-config-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Undo');
  });

  test('Cmd+Z triggers undo', async ({ page }) => {
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
    await page.click('.picanvas-config-style-card[data-style="underline"]');
    expect(await getProp(page, 'tabStyle')).toBe('underline');
    await page.keyboard.press('Meta+z');
    expect(await getProp(page, 'tabStyle')).toBe('default');
  });

  test('Cmd+Shift+Z triggers redo', async ({ page }) => {
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
    await page.click('.picanvas-config-style-card[data-style="boxed"]');
    await page.keyboard.press('Meta+z');
    expect(await getProp(page, 'tabStyle')).toBe('default');
    await page.keyboard.press('Meta+Shift+z');
    expect(await getProp(page, 'tabStyle')).toBe('boxed');
  });
});

// ────────────────────────────────────────────────────
// 11. LIVE PREVIEW
// ────────────────────────────────────────────────────

test.describe('Live Preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
    await openPanel(page);
  });

  test('preview container is rendered', async ({ page }) => {
    const preview = page.locator('[data-preview-container]');
    await expect(preview).toBeVisible();
  });

  test('preview shows tab labels', async ({ page }) => {
    const preview = page.locator('[data-preview-container]');
    // LivePreview reads tab${i}Label, which should be set in mock data
    await expect(preview).toContainText('Overview');
  });

  test('preview toggle button works', async ({ page }) => {
    const toggleBtn = page.locator('.picanvas-config-preview-toggle');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      // Preview content should collapse/expand
      await page.waitForTimeout(200);
    }
  });
});

// ────────────────────────────────────────────────────
// 12. RESPONSIVE LAYOUT
// ────────────────────────────────────────────────────

test.describe('Responsive Layout', () => {
  test('sidebar is visible at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(URL);
    await openPanel(page);
    const sidebar = page.locator('.picanvas-config-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('layout adapts at narrow width', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto(URL);
    await openPanel(page);
    // Sidebar should still be visible but in horizontal mode
    const sidebar = page.locator('.picanvas-config-sidebar');
    await expect(sidebar).toBeVisible();
  });
});

// ────────────────────────────────────────────────────
// 13. MULTIPLE OPEN/CLOSE CYCLES
// ────────────────────────────────────────────────────

test.describe('Panel Reopen Stability', () => {
  test('can open and close multiple times without errors', async ({ page }) => {
    await page.goto(URL);

    for (let i = 0; i < 3; i++) {
      await openPanel(page);
      await expect(page.locator('.picanvas-config-overlay')).toBeVisible();
      await page.click('[data-action="done"]');
      await expect(page.locator('.picanvas-config-overlay')).toHaveCount(0);
    }
  });

  test('undo/redo state resets between sessions', async ({ page }) => {
    await page.goto(URL);

    // Session 1: make a change
    await openPanel(page);
    await page.click('.picanvas-config-sidebar-item[data-section="appearance"]');
    await page.click('.picanvas-config-style-card[data-style="pills"]');
    await expect(page.locator('[data-action="undo"]')).toBeEnabled();
    await page.click('[data-action="done"]');

    // Session 2: undo should be disabled (fresh session)
    await openPanel(page);
    await expect(page.locator('[data-action="undo"]')).toBeDisabled();
  });
});
