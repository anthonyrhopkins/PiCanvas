/**
 * AA HUB Homepage Recreation — Page Creation via Playwright
 *
 * This test automates creating a new SharePoint page with PiCanvas configured
 * to recreate the AA HUB homepage layout:
 *   - Tab 1 (Home): HTML content with hero section, collapsible header, 6-column overlay
 *   - Tabs 2-9: Dropdown navigation tabs for 8 BTP menu categories
 *
 * Prerequisites:
 *   - Authenticated Edge/Chrome profile with SharePoint access
 *   - PiCanvas web part deployed to the target site
 *   - Run: npx playwright test tests/aahub-page-create.spec.ts --headed
 */
import { test, expect, Page } from '@playwright/test';

// ─── Configuration ───────────────────────────────────────────────────────────

const SITE_URL = 'https://sap.sharepoint.com/teams/AAHUB';
const PAGE_TITLE = 'AA HUB - PiCanvas';

// Timeout overrides for SharePoint interactions
test.use({
  actionTimeout: 15000,
  navigationTimeout: 30000,
});

// ─── Hero Section HTML ───────────────────────────────────────────────────────

const HERO_HTML = `
<style>
  .aahub-header { background: linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%); color: #fff; padding: 20px 32px; cursor: pointer; user-select: none; border-radius: 8px 8px 0 0; }
  .aahub-header h1 { margin: 0; font-size: 22px; font-weight: 600; }
  .aahub-header .subtitle { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .aahub-hero { position: relative; min-height: 480px; background: url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600') center/cover no-repeat; border-radius: 0 0 8px 8px; overflow: hidden; }
  .aahub-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.45); display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; padding: 32px; align-content: start; }
  .aahub-col { color: #fff; font-size: 14px; line-height: 1.6; }
  .aahub-col h2 { font-size: 16px; margin: 0 0 12px 0; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 6px; }
  .aahub-col h3 { font-size: 20px; margin: 0 0 8px 0; }
  .aahub-col ul { margin: 0; padding: 0 0 0 16px; }
  .aahub-col li { margin-bottom: 4px; }
  .aahub-col a { color: #7dd3fc; text-decoration: none; }
  .aahub-col a:hover { text-decoration: underline; }
  .aahub-callout { font-size: 28px; font-weight: 700; text-align: center; padding-top: 20px; text-shadow: 0 2px 8px rgba(0,0,0,0.5); }
  .aahub-gandalf { text-align: center; }
  .aahub-gandalf img { max-width: 120px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); }
</style>

<div class="aahub-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'block'">
  <h1>Global Architecture Advisory — Central Tavern &amp; Inn</h1>
  <div class="subtitle">Welcome, traveler. Your journey through Middle-earth architecture starts here.</div>
</div>

<div class="aahub-hero">
  <div class="aahub-overlay">
    <div class="aahub-col" style="grid-column: span 2;">
      <h2>Welcome</h2>
      <p>The Architecture Advisory team supports SAP's global architecture landscape. Explore our resources, deliverables, and community hubs.</p>
      <p>Use the navigation tabs above to browse by category.</p>
    </div>
    <div class="aahub-col aahub-gandalf">
      <img src="https://upload.wikimedia.org/wikipedia/en/e/e9/Gandalf600ppx.jpg" alt="Gandalf" />
      <p style="margin-top:8px; font-style:italic;">"All we have to decide is what to do with the time that is given us."</p>
    </div>
    <div class="aahub-col aahub-callout">
      YOU'VE FOUND US!!!
    </div>
    <div class="aahub-col">
      <h2>Top News</h2>
      <ul>
        <li><a href="#">Q1 Architecture Review Complete</a></li>
        <li><a href="#">New Cloud Foundry Patterns Published</a></li>
        <li><a href="#">Architecture Community Day — March 2026</a></li>
        <li><a href="#">Updated Reference Architecture Library</a></li>
      </ul>
    </div>
    <div class="aahub-col" style="grid-column: span 2;">
      <h2>Good to Know</h2>
      <ul>
        <li><a href="#">Architecture Decision Records (ADR) Template</a></li>
        <li><a href="#">Cloud Foundry Migration Playbook</a></li>
        <li><a href="#">SAP BTP Best Practices Guide</a></li>
        <li><a href="#">Security Architecture Checklist</a></li>
        <li><a href="#">Integration Patterns Catalog</a></li>
      </ul>
    </div>
  </div>
</div>
`;

// ─── Dropdown Tab Data ───────────────────────────────────────────────────────

interface IDropdownTabConfig {
  label: string;
  items: Array<{ label: string; url: string; target: '_self' | '_blank' }>;
}

const DROPDOWN_TABS: IDropdownTabConfig[] = [
  {
    label: 'Strategic Initiatives',
    items: [
      { label: 'Clean Core Strategy', url: '#', target: '_self' },
      { label: 'Cloud Transformation', url: '#', target: '_self' },
      { label: 'AI & ML Architecture', url: '#', target: '_self' },
      { label: 'Sustainability', url: '#', target: '_self' },
      { label: 'Integration Strategy', url: '#', target: '_self' },
      { label: 'Data Architecture', url: '#', target: '_self' },
      { label: 'Platform Engineering', url: '#', target: '_self' },
    ],
  },
  {
    label: 'Resources / Tools',
    items: [
      { label: 'Architecture Decision Records', url: '#', target: '_self' },
      { label: 'Reference Architectures', url: '#', target: '_self' },
      { label: 'BTP Cockpit', url: 'https://cockpit.btp.cloud.sap/', target: '_blank' },
      { label: 'Cloud Foundry CLI', url: '#', target: '_self' },
      { label: 'API Business Hub', url: '#', target: '_blank' },
      { label: 'SAP Graph', url: '#', target: '_self' },
      { label: 'Integration Suite', url: '#', target: '_self' },
      { label: 'Build Apps (LCNC)', url: '#', target: '_self' },
      { label: 'ABAP Cloud', url: '#', target: '_self' },
      { label: 'SAP CAP (Cloud Application Programming)', url: '#', target: '_self' },
      { label: 'Fiori Tools', url: '#', target: '_self' },
      { label: 'Enterprise Architecture Templates', url: '#', target: '_self' },
      { label: 'Solution Diagrams', url: '#', target: '_self' },
    ],
  },
  {
    label: 'Deliverables',
    items: [
      { label: 'Architecture Reviews', url: '#', target: '_self' },
      { label: 'Technical Blueprints', url: '#', target: '_self' },
      { label: 'Security Assessments', url: '#', target: '_self' },
      { label: 'Performance Benchmarks', url: '#', target: '_self' },
      { label: 'Migration Plans', url: '#', target: '_self' },
    ],
  },
  {
    label: 'AA Generated Content',
    items: [
      { label: 'Architecture Blog Posts', url: '#', target: '_self' },
      { label: 'Whitepapers & Publications', url: '#', target: '_self' },
      { label: 'Conference Presentations', url: '#', target: '_self' },
    ],
  },
  {
    label: 'Reference Content',
    items: [
      { label: 'SAP Technology Map', url: '#', target: '_self' },
      { label: 'Solution Architecture Patterns', url: '#', target: '_self' },
      { label: 'Security Reference Architecture', url: '#', target: '_self' },
      { label: 'Integration Patterns', url: '#', target: '_self' },
      { label: 'Data Architecture Patterns', url: '#', target: '_self' },
      { label: 'Cloud Native Patterns', url: '#', target: '_self' },
    ],
  },
  {
    label: 'Architecture Communities',
    items: [
      { label: 'Global Architecture Network', url: '#', target: '_self' },
      { label: 'BTP Architecture Guild', url: '#', target: '_self' },
      { label: 'Security Architecture Forum', url: '#', target: '_self' },
      { label: 'Integration Community', url: '#', target: '_self' },
      { label: 'Cloud Native CoP', url: '#', target: '_self' },
    ],
  },
  {
    label: 'Learning Paths',
    items: [
      { label: 'BTP Architect Certification', url: '#', target: '_blank' },
      { label: 'Cloud Foundry Fundamentals', url: '#', target: '_self' },
      { label: 'SAP Integration Suite Training', url: '#', target: '_self' },
      { label: 'Architecture Kata Workshops', url: '#', target: '_self' },
    ],
  },
  {
    label: 'Communications',
    items: [
      { label: 'Architecture Newsletter', url: '#', target: '_self' },
      { label: 'Town Hall Recordings', url: '#', target: '_self' },
      { label: 'Upcoming Events', url: '#', target: '_self' },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function waitForSharePoint(page: Page): Promise<void> {
  // Wait for SharePoint to finish loading
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ─── Test ────────────────────────────────────────────────────────────────────

test.describe('AA HUB Page Creation', () => {
  test.skip(
    !process.env.AAHUB_CREATE,
    'Set AAHUB_CREATE=1 to run page creation (requires authenticated browser)'
  );

  test('create AA HUB PiCanvas page', async ({ browser }) => {
    test.setTimeout(120000);

    // Use persistent context with existing Edge profile for SharePoint auth
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // 1. Navigate to site
    await page.goto(`${SITE_URL}/SitePages`, { waitUntil: 'domcontentloaded' });
    await waitForSharePoint(page);

    // 2. Create new page via SharePoint UI
    // Click "+ New" button
    await page.click('button[data-automationid="newCommand"], [data-automation-id="newButton"]');
    await page.waitForTimeout(1000);

    // Click "Site page"
    await page.click('button:has-text("Site page"), [data-automationid="sitePage"]');
    await waitForSharePoint(page);

    // 3. Set page title
    const titleInput = page.locator('[data-automation-id="titleField"] textarea, [placeholder="Name your page"]');
    await titleInput.fill(PAGE_TITLE);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    // 4. Add PiCanvas web part
    // Click on the empty section to show the "+" button
    await page.click('[data-automation-id="emptyColumnSection"], .CanvasZone');
    await page.waitForTimeout(500);

    // Click the "+" add web part button
    await page.click('button[data-automation-id="addWebPartButton"], button.addPartButton');
    await page.waitForTimeout(1000);

    // Search for PiCanvas
    const searchBox = page.locator('input[data-automation-id="toolboxSearchBox"], input[placeholder="Search"]');
    await searchBox.fill('PiCanvas');
    await page.waitForTimeout(1000);

    // Click PiCanvas in results
    await page.click('[data-automation-id="PiCanvas"], button:has-text("PiCanvas")');
    await waitForSharePoint(page);

    // 5. Open PiCanvas configuration panel
    // The web part should show the "Open Configuration Panel" button
    await page.click('button:has-text("Open Configuration Panel")');
    await page.waitForSelector('.picanvas-config-overlay', { state: 'visible', timeout: 10000 });

    // 6. Configure tabs - we need to set tab count to 9 first
    // Find the Tab Builder section and set tab count
    const tabCountSlider = page.locator('.picanvas-config-slider input[type="range"]').first();
    if (await tabCountSlider.isVisible()) {
      await tabCountSlider.fill('9');
      await page.waitForTimeout(500);
    }

    // Note: The actual property configuration would need to be done via the
    // SharePoint property pane or the PiCanvas configuration panel.
    // This is a framework for the automation - specific selectors may need
    // adjustment based on the deployed PiCanvas version.

    console.log('Page created successfully. Configure PiCanvas manually or via automation.');
    console.log(`Tab 1: Home (HTML content type) with hero section`);
    console.log(`Tabs 2-9: Dropdown tabs for ${DROPDOWN_TABS.map(t => t.label).join(', ')}`);

    // Take a screenshot for verification
    await page.screenshot({ path: 'tests/screenshots/aahub-page-create.png', fullPage: true });

    await context.close();
  });
});

// ─── Export tab configuration for programmatic use ───────────────────────────

export { HERO_HTML, DROPDOWN_TABS, PAGE_TITLE, SITE_URL };
