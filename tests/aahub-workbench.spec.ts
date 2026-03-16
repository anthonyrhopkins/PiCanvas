/**
 * AA HUB Workbench Test — Uses Edge SAP profile cookies for auth,
 * adds PiCanvas to workbench, configures 9 tabs via property pane.
 *
 * Usage:
 *   1. CLOSE Microsoft Edge completely (Playwright needs exclusive access to profile)
 *   2. npx playwright test tests/aahub-workbench.spec.ts --headed --project chromium
 */
import { test as base, chromium, expect, Page, BrowserContext } from '@playwright/test';

// ─── Config ─────────────────────────────────────────────────────────────────

const EDGE_PROFILE = `${process.env.HOME}/Library/Application Support/Microsoft Edge/Default`;
const WORKBENCH = 'https://sap.sharepoint.com/sites/206992/_layouts/15/workbench.aspx';
const DEBUG_QS = 'debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&loadSPFX=true';
const PICANVAS_WP_ID = '6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5';

// ─── Tab Data ───────────────────────────────────────────────────────────────

const HERO_HTML = `<style>.aahub-header{background:linear-gradient(135deg,#1a0a2e 0%,#16213e 50%,#0f3460 100%);color:#fff;padding:20px 32px;cursor:pointer;user-select:none;border-radius:8px 8px 0 0}.aahub-header h1{margin:0;font-size:22px;font-weight:600}.aahub-header .subtitle{font-size:13px;opacity:.8;margin-top:4px}.aahub-hero{position:relative;min-height:480px;background:url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600') center/cover no-repeat;border-radius:0 0 8px 8px;overflow:hidden}.aahub-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);display:grid;grid-template-columns:repeat(6,1fr);gap:16px;padding:32px;align-content:start}.aahub-col{color:#fff;font-size:14px;line-height:1.6}.aahub-col h2{font-size:16px;margin:0 0 12px 0;border-bottom:2px solid rgba(255,255,255,.3);padding-bottom:6px}.aahub-col ul{margin:0;padding:0 0 0 16px}.aahub-col li{margin-bottom:4px}.aahub-col a{color:#7dd3fc;text-decoration:none}.aahub-col a:hover{text-decoration:underline}.aahub-callout{font-size:28px;font-weight:700;text-align:center;padding-top:20px;text-shadow:0 2px 8px rgba(0,0,0,.5)}.aahub-gandalf{text-align:center}.aahub-gandalf img{max-width:120px;border-radius:50%;border:3px solid rgba(255,255,255,.4)}</style><div class="aahub-header" onclick="var h=this.nextElementSibling;h.style.display=h.style.display==='none'?'block':'none'"><h1>Global Architecture Advisory — Central Tavern &amp; Inn</h1><div class="subtitle">Welcome, traveler. Your journey through Middle-earth architecture starts here.</div></div><div class="aahub-hero"><div class="aahub-overlay"><div class="aahub-col" style="grid-column:span 2"><h2>Welcome</h2><p>The Architecture Advisory team supports SAP's global architecture landscape. Explore our resources, deliverables, and community hubs.</p><p>Use the navigation tabs above to browse by category.</p></div><div class="aahub-col aahub-gandalf"><img src="https://upload.wikimedia.org/wikipedia/en/e/e9/Gandalf600ppx.jpg" alt="Gandalf" /><p style="margin-top:8px;font-style:italic">"All we have to decide is what to do with the time that is given us."</p></div><div class="aahub-col aahub-callout">YOU'VE FOUND US!!!</div><div class="aahub-col"><h2>Top News</h2><ul><li><a href="#">Q1 Architecture Review Complete</a></li><li><a href="#">New Cloud Foundry Patterns Published</a></li><li><a href="#">Architecture Community Day — March 2026</a></li><li><a href="#">Updated Reference Architecture Library</a></li></ul></div><div class="aahub-col" style="grid-column:span 2"><h2>Good to Know</h2><ul><li><a href="#">Architecture Decision Records (ADR) Template</a></li><li><a href="#">Cloud Foundry Migration Playbook</a></li><li><a href="#">SAP BTP Best Practices Guide</a></li><li><a href="#">Security Architecture Checklist</a></li><li><a href="#">Integration Patterns Catalog</a></li></ul></div></div></div>`;

const DROPDOWN_TABS = [
  { label: 'Strategic Initiatives', items: [
    { label: 'Clean Core Strategy', url: '/teams/AAHUB/SitePages/Clean-Core.aspx', target: '_self' },
    { label: 'Cloud Transformation', url: '/teams/AAHUB/SitePages/Cloud-Transformation.aspx', target: '_self' },
    { label: 'AI & ML Architecture', url: '/teams/AAHUB/SitePages/AI-ML.aspx', target: '_self' },
    { label: 'Sustainability', url: '/teams/AAHUB/SitePages/Sustainability.aspx', target: '_self' },
    { label: 'Integration Strategy', url: '/teams/AAHUB/SitePages/Integration.aspx', target: '_self' },
    { label: 'Data Architecture', url: '/teams/AAHUB/SitePages/Data-Architecture.aspx', target: '_self' },
    { label: 'Platform Engineering', url: '/teams/AAHUB/SitePages/Platform-Engineering.aspx', target: '_self' },
  ]},
  { label: 'Resources / Tools', items: [
    { label: 'Architecture Decision Records', url: '/teams/AAHUB/SitePages/ADR.aspx', target: '_self' },
    { label: 'Reference Architectures', url: '/teams/AAHUB/SitePages/Reference-Arch.aspx', target: '_self' },
    { label: 'BTP Cockpit', url: 'https://cockpit.btp.cloud.sap/', target: '_blank' },
    { label: 'Cloud Foundry CLI', url: '/teams/AAHUB/SitePages/CF-CLI.aspx', target: '_self' },
    { label: 'API Business Hub', url: 'https://api.sap.com/', target: '_blank' },
    { label: 'SAP Graph', url: '/teams/AAHUB/SitePages/SAP-Graph.aspx', target: '_self' },
    { label: 'Integration Suite', url: '/teams/AAHUB/SitePages/Integration-Suite.aspx', target: '_self' },
    { label: 'Build Apps (LCNC)', url: '/teams/AAHUB/SitePages/LCNC.aspx', target: '_self' },
    { label: 'ABAP Cloud', url: '/teams/AAHUB/SitePages/ABAP-Cloud.aspx', target: '_self' },
    { label: 'SAP CAP', url: '/teams/AAHUB/SitePages/CAP.aspx', target: '_self' },
    { label: 'Fiori Tools', url: '/teams/AAHUB/SitePages/Fiori-Tools.aspx', target: '_self' },
    { label: 'EA Templates', url: '/teams/AAHUB/SitePages/EA-Templates.aspx', target: '_self' },
    { label: 'Solution Diagrams', url: '/teams/AAHUB/SitePages/Diagrams.aspx', target: '_self' },
  ]},
  { label: 'Deliverables', items: [
    { label: 'Architecture Reviews', url: '/teams/AAHUB/SitePages/Reviews.aspx', target: '_self' },
    { label: 'Technical Blueprints', url: '/teams/AAHUB/SitePages/Blueprints.aspx', target: '_self' },
    { label: 'Security Assessments', url: '/teams/AAHUB/SitePages/Security.aspx', target: '_self' },
    { label: 'Performance Benchmarks', url: '/teams/AAHUB/SitePages/Benchmarks.aspx', target: '_self' },
    { label: 'Migration Plans', url: '/teams/AAHUB/SitePages/Migration.aspx', target: '_self' },
  ]},
  { label: 'AA Generated Content', items: [
    { label: 'Architecture Blog Posts', url: '/teams/AAHUB/SitePages/Blog.aspx', target: '_self' },
    { label: 'Whitepapers & Publications', url: '/teams/AAHUB/SitePages/Whitepapers.aspx', target: '_self' },
    { label: 'Conference Presentations', url: '/teams/AAHUB/SitePages/Presentations.aspx', target: '_self' },
  ]},
  { label: 'Reference Content', items: [
    { label: 'SAP Technology Map', url: '/teams/AAHUB/SitePages/Tech-Map.aspx', target: '_self' },
    { label: 'Solution Architecture Patterns', url: '/teams/AAHUB/SitePages/Patterns.aspx', target: '_self' },
    { label: 'Security Reference Architecture', url: '/teams/AAHUB/SitePages/Security-Ref.aspx', target: '_self' },
    { label: 'Integration Patterns', url: '/teams/AAHUB/SitePages/Integration-Patterns.aspx', target: '_self' },
    { label: 'Data Architecture Patterns', url: '/teams/AAHUB/SitePages/Data-Patterns.aspx', target: '_self' },
    { label: 'Cloud Native Patterns', url: '/teams/AAHUB/SitePages/Cloud-Native.aspx', target: '_self' },
  ]},
  { label: 'Architecture Communities', items: [
    { label: 'Global Architecture Network', url: '/teams/AAHUB/SitePages/GAN.aspx', target: '_self' },
    { label: 'BTP Architecture Guild', url: '/teams/AAHUB/SitePages/BTP-Guild.aspx', target: '_self' },
    { label: 'Security Architecture Forum', url: '/teams/AAHUB/SitePages/Security-Forum.aspx', target: '_self' },
    { label: 'Integration Community', url: '/teams/AAHUB/SitePages/Integration-Community.aspx', target: '_self' },
    { label: 'Cloud Native CoP', url: '/teams/AAHUB/SitePages/Cloud-CoP.aspx', target: '_self' },
  ]},
  { label: 'Learning Paths', items: [
    { label: 'BTP Architect Certification', url: 'https://learning.sap.com/', target: '_blank' },
    { label: 'Cloud Foundry Fundamentals', url: '/teams/AAHUB/SitePages/CF-Learning.aspx', target: '_self' },
    { label: 'Integration Suite Training', url: '/teams/AAHUB/SitePages/IS-Training.aspx', target: '_self' },
    { label: 'Architecture Kata Workshops', url: '/teams/AAHUB/SitePages/Kata.aspx', target: '_self' },
  ]},
  { label: 'Communications', items: [
    { label: 'Architecture Newsletter', url: '/teams/AAHUB/SitePages/Newsletter.aspx', target: '_self' },
    { label: 'Town Hall Recordings', url: '/teams/AAHUB/SitePages/Town-Hall.aspx', target: '_self' },
    { label: 'Upcoming Events', url: '/teams/AAHUB/SitePages/Events.aspx', target: '_self' },
  ]},
];

function buildAllProperties(): Record<string, unknown> {
  const props: Record<string, unknown> = {
    description: 'AA HUB Homepage',
    tabCount: 9,
    themeMode: 'auto',
    tabStyle: 'default',
    tabAlignment: 'stretch',
    tabTextColor: '#ffffff',
    tabActiveTextColor: '#ffffff',
    tabBackgroundColor: '#333333',
    tabActiveBackgroundColor: '#555555',
    tabHoverBackgroundColor: '#444444',
    tabFontSize: '13px',
    tabFontWeight: '500',
    tabPaddingVertical: '10px',
    tabPaddingHorizontal: '16px',
    tabGap: '0px',
    tabBorderRadius: '0px',
    showActiveIndicator: false,
    showTabSeparator: false,
    tabContentGap: '0px',
    enableDeepLinking: true,
    enableLazyLoading: true,
    enableTransitions: true,
    iconStyle: 'svg',
    tab1Label: 'Home',
    tab1ContentType: 'html',
    tab1CustomContent: HERO_HTML,
    tab1ContentFullWidth: true,
    tab1ContentSourceType: 'manual',
  };
  DROPDOWN_TABS.forEach((tab, idx) => {
    const n = idx + 2;
    props[`tab${n}Label`] = tab.label;
    props[`tab${n}ContentType`] = 'html';
    props[`tab${n}DropdownEnabled`] = true;
    props[`tab${n}DropdownItems`] = JSON.stringify(tab.items);
    props[`tab${n}DropdownStyle`] = 'dark';
  });
  return props;
}

// ─── Test ───────────────────────────────────────────────────────────────────

const test = base.extend({});

test.describe('AA HUB Workbench', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    // Launch Chromium (Edge channel) with persistent profile for auth cookies
    context = await chromium.launchPersistentContext(EDGE_PROFILE, {
      headless: false,
      channel: 'msedge',
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
      ],
    });
    page = context.pages()[0] || await context.newPage();
  });

  test.afterAll(async () => {
    // Don't close — let the user inspect
  });

  test('configure PiCanvas with dropdown tabs', async () => {
    test.setTimeout(300_000);

    // ── 1. Open workbench ───────────────────────────────────────────────────
    console.log('1. Opening workbench...');
    await page.goto(`${WORKBENCH}?${DEBUG_QS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Accept "Load debug scripts" if it appears
    try {
      const loadBtn = page.locator('button:has-text("Load debug scripts"), a:has-text("Load debug scripts")');
      await loadBtn.waitFor({ state: 'visible', timeout: 8_000 });
      await loadBtn.click();
      console.log('   Accepted debug scripts dialog.');
    } catch {
      console.log('   No debug dialog (already accepted or not shown).');
    }

    // Wait for workbench canvas to be ready
    await page.waitForSelector('.CanvasZone, [data-automation-id="CanvasZone"], .spPageCanvasContent', { timeout: 60_000 });
    await page.waitForTimeout(3_000);
    console.log('   Workbench ready.');

    // ── 2. Add PiCanvas webpart ─────────────────────────────────────────────
    console.log('2. Adding PiCanvas webpart...');

    // Click the "+" button in the empty canvas
    const plusBtn = page.locator('[data-automation-id="addWebPartBtn"], button.controlZoneEmptyButton, button[aria-label*="Add a new web part"]').first();
    try {
      await plusBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await plusBtn.click();
    } catch {
      // Click the canvas zone itself, then the + button
      await page.locator('.CanvasZone').first().click();
      await page.waitForTimeout(1_000);
      const addBtns = page.locator('button[data-automation-id="addWebPartButton"], button.addPartButton, button[aria-label*="Add a"]');
      await addBtns.first().click();
    }
    await page.waitForTimeout(2_000);

    // Search for PiCanvas in the toolbox
    const searchInput = page.locator('input[data-automation-id="toolboxSearchBox"], input[placeholder*="Search"], input[aria-label*="search" i]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 10_000 });
    await searchInput.fill('PiCanvas');
    await page.waitForTimeout(2_000);

    // Click PiCanvas button in results
    const piBtn = page.locator('button:has-text("PiCanvas")').first();
    await piBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await piBtn.click();
    console.log('   PiCanvas inserted.');
    await page.waitForTimeout(4_000);

    // ── 3. Config panel may have auto-opened. If not, open it. ────────────
    console.log('3. Checking for config panel...');

    const allProps = buildAllProperties();

    // Check if config panel is already open (PiCanvas auto-opens it on first add)
    let panelOpen = await page.locator('.picanvas-config-overlay').isVisible({ timeout: 3_000 }).catch(() => false);
    if (!panelOpen) {
      // Try clicking the webpart and opening the config panel
      const wpContainer = page.locator(`[data-sp-web-part-id="${PICANVAS_WP_ID}"]`).first();
      await wpContainer.click();
      await page.waitForTimeout(1_000);
      const configBtn = page.locator('button:has-text("Open Configuration Panel")').first();
      try {
        await configBtn.waitFor({ state: 'visible', timeout: 5_000 });
        await configBtn.click();
        await page.waitForSelector('.picanvas-config-overlay', { state: 'visible', timeout: 10_000 });
        panelOpen = true;
      } catch {
        console.log('   Could not open config panel.');
      }
    }
    console.log(`   Config panel open: ${panelOpen}`);

    // ── 4. Set all properties via the config panel's internal setProperty ───
    console.log('4. Injecting properties via config panel API...');

    const injected = await page.evaluate((props) => {
      const overlay = document.querySelector('.picanvas-config-overlay');
      if (!overlay) return { ok: false, error: 'no overlay' };

      // The PiCanvas config panel stores a reference to setProperty/getProperty
      // in the TabBuilderSection which is created with an options object.
      // We can find the webpart instance through SPFx internals.

      // SPFx workbench stores webpart instances on __spfx_webparts__
      const win = window as any;

      // Try: iterate all React fiber nodes to find the webpart
      // SPFx workbench uses React; the webpart properties are in the component state
      const wpEl = document.querySelector('[data-sp-web-part-id="6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5"]');
      if (!wpEl) return { ok: false, error: 'webpart element not found' };

      // Walk up to find the React instance
      const fiberKey = Object.keys(wpEl).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (fiberKey) {
        let fiber = (wpEl as any)[fiberKey];
        let attempts = 0;
        while (fiber && attempts < 50) {
          const instance = fiber.stateNode;
          if (instance && instance.properties && typeof instance._renderInternal === 'function') {
            // Found PiCanvas webpart instance!
            Object.keys(props).forEach(key => {
              instance.properties[key] = props[key];
            });
            // Trigger re-render
            instance.render();
            return { ok: true, method: 'react-fiber', propCount: Object.keys(props).length };
          }
          // Also check memoizedProps for functional component wrappers
          if (fiber.memoizedProps?.webPartProperties) {
            Object.assign(fiber.memoizedProps.webPartProperties, props);
            return { ok: true, method: 'fiber-memoized', propCount: Object.keys(props).length };
          }
          fiber = fiber.return;
          attempts++;
        }
      }

      // Fallback: modify the data-sp-controldata JSON
      const controlEl = wpEl.closest('[data-sp-canvascontrol]');
      if (!controlEl) return { ok: false, error: 'no canvas control' };

      const raw = controlEl.getAttribute('data-sp-controldata');
      if (!raw) return { ok: false, error: 'no controldata attr' };

      try {
        const data = JSON.parse(raw);
        if (!data.webPartData) data.webPartData = {};
        if (!data.webPartData.properties) data.webPartData.properties = {};
        Object.assign(data.webPartData.properties, props);
        controlEl.setAttribute('data-sp-controldata', JSON.stringify(data));
        return { ok: true, method: 'controldata-attr', propCount: Object.keys(props).length };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    }, allProps);

    console.log('   Injection result:', JSON.stringify(injected));

    // ── 5. Close config panel and trigger re-render ─────────────────────────
    console.log('5. Closing panel and triggering re-render...');

    if (panelOpen) {
      // If we injected via React fiber, the webpart should already be re-rendering
      if (injected.ok && injected.method === 'react-fiber') {
        // Close the config panel
        const cancelBtn = page.locator('[data-action="cancel"], button:has-text("Cancel")').first();
        await cancelBtn.click().catch(() => {});
        await page.waitForTimeout(2_000);
      } else {
        // Close and reload to pick up the data attribute changes
        const cancelBtn = page.locator('[data-action="cancel"], button:has-text("Cancel")').first();
        await cancelBtn.click().catch(() => {});
        await page.waitForTimeout(1_000);

        // Trigger a page refresh to re-instantiate with new properties
        console.log('   Reloading workbench to apply data-attribute properties...');
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });

        // Accept debug scripts again if needed
        try {
          const loadBtn = page.locator('button:has-text("Load debug scripts")');
          await loadBtn.waitFor({ state: 'visible', timeout: 5_000 });
          await loadBtn.click();
        } catch { /* not shown */ }

        await page.waitForTimeout(5_000);
      }
    }

    // ── 6. Screenshot & verify ──────────────────────────────────────────────
    console.log('6. Taking screenshots...');
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: 'tests/screenshots/aahub-workbench.png', fullPage: true });

    const tabCount = await page.locator('.addui-Tabs-tab').count().catch(() => 0);
    const ddCount = await page.locator('[data-dropdown="true"]').count().catch(() => 0);
    console.log(`   Tabs: ${tabCount}, Dropdown tabs: ${ddCount}`);

    if (ddCount > 0) {
      await page.locator('[data-dropdown="true"]').first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/aahub-workbench-dropdown.png', fullPage: true });
      console.log('   Dropdown hover screenshot saved.');
    }

    console.log('\n=== Done! Inspect the browser. Press Ctrl+C to exit. ===');
    await page.pause();
  });
});

// ─── Configure via PiCanvas Config Panel ────────────────────────────────────

async function configureViaConfigPanel(page: Page, allProps: Record<string, unknown>) {
  // The config panel is open. We can set properties through its internal API.
  const result = await page.evaluate((props) => {
    // The config panel stores a reference to getProperty/setProperty via its options
    // We can find it through the DOM callbacks
    const overlay = document.querySelector('.picanvas-config-overlay') as any;
    if (!overlay) return { ok: false, error: 'overlay not found' };

    // The config panel stores options on the element via data
    // Actually, we need to trigger the setProperty callback for each property
    // The panel builds controls that call opts.setProperty — we can simulate this
    // by dispatching events, but the most reliable approach is to find the webpart instance.

    // Look for the PiCanvas webpart instance on the page
    // SPFx webparts are React components; the properties are stored on the component state
    const wpElements = document.querySelectorAll('[data-picanvas-initialized]');
    if (wpElements.length > 0) {
      // The webpart instance should be reachable via jQuery data
      const $ = (window as any).jQuery;
      if ($) {
        const $wp = $(wpElements[0]).closest('[data-sp-canvascontrol]');
        if ($wp.length) {
          return { ok: true, note: 'Found webpart container, but need SPFx property pane to persist' };
        }
      }
    }

    return { ok: false, error: 'Could not find webpart instance' };
  }, allProps);

  console.log('   Config panel API result:', JSON.stringify(result));

  // Set tabCount via the Tab Builder section
  // Find the slider or number input for tab count
  const tabCountInput = page.locator('.picanvas-config-section input[type="number"], .picanvas-config-slider input').first();
  if (await tabCountInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await tabCountInput.fill('9');
    await tabCountInput.press('Enter');
    await page.waitForTimeout(1_000);
    console.log('   Set tab count to 9.');
  }

  // For each tab, we'd need to:
  // 1. Expand the tab card
  // 2. Set the label
  // 3. For tab 1: select HTML content type, paste hero HTML
  // 4. For tabs 2-9: open Dropdown Navigation accordion, enable dropdown, add items

  // This is very verbose via UI automation. Let's try the "add tab" button approach
  // and then configure each tab through the accordion UI.

  // Since this is complex, let's use a JS injection approach instead:
  const injected = await page.evaluate((props) => {
    // Find the picanvas config panel's internal options object
    // It's attached as a closure to the event handlers on the DOM elements
    // The most reliable way is to modify the webpart properties directly
    // and then trigger a re-render

    // Find ALL picanvas webpart containers
    const controls = document.querySelectorAll('[data-sp-canvascontrol]');
    for (const ctrl of Array.from(controls)) {
      const raw = ctrl.getAttribute('data-sp-controldata');
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        if (data.webPartData?.id === '6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5' ||
            data.webPartId === '6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5') {
          // Found PiCanvas! Merge properties
          if (!data.webPartData) data.webPartData = {};
          if (!data.webPartData.properties) data.webPartData.properties = {};
          Object.assign(data.webPartData.properties, props);
          ctrl.setAttribute('data-sp-controldata', JSON.stringify(data));
          return { ok: true, id: data.id };
        }
      } catch { continue; }
    }
    return { ok: false, error: 'PiCanvas control not found in DOM' };
  }, allProps);

  console.log('   Property injection result:', JSON.stringify(injected));

  if (injected.ok) {
    // Close config panel and trigger re-render
    const doneBtn = page.locator('[data-action="done"], button:has-text("Done")').first();
    if (await doneBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await doneBtn.click();
      await page.waitForTimeout(2_000);
    }

    // Reload workbench to apply the injected properties
    console.log('   Reloading workbench to apply properties...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5_000);
  }
}

// ─── Configure via SPFx Property Pane ───────────────────────────────────────

async function configureViaPropertyPane(page: Page, allProps: Record<string, unknown>) {
  console.log('   Property pane approach — limited to available controls.');
  // This would need to interact with each SPFx property pane field individually.
  // Very brittle and slow. Prefer the config panel approach above.
}
