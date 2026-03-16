#!/usr/bin/env node
/**
 * AA HUB Demo Page Setup via M365 CLI
 *
 * Adds a PiCanvas webpart to Demo.aspx and configures:
 *   - Tab 1: "Home" — HTML hero section with LOTR theme
 *   - Tabs 2–9: Dropdown navigation tabs with ~50 sub-items
 */

const { execSync } = require('child_process');

const SITE = 'https://sap.sharepoint.com/teams/AAHUB';
const PAGE = 'Demo.aspx';
const PICANVAS_ID = '6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5';

// ─── Hero HTML ──────────────────────────────────────────────────────────────

const HERO_HTML = `
<style>
.aahub-header{background:linear-gradient(135deg,#1a0a2e 0%,#16213e 50%,#0f3460 100%);color:#fff;padding:20px 32px;cursor:pointer;user-select:none;border-radius:8px 8px 0 0}
.aahub-header h1{margin:0;font-size:22px;font-weight:600}
.aahub-header .subtitle{font-size:13px;opacity:.8;margin-top:4px}
.aahub-hero{position:relative;min-height:480px;background:url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600') center/cover no-repeat;border-radius:0 0 8px 8px;overflow:hidden}
.aahub-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);display:grid;grid-template-columns:repeat(6,1fr);gap:16px;padding:32px;align-content:start}
.aahub-col{color:#fff;font-size:14px;line-height:1.6}
.aahub-col h2{font-size:16px;margin:0 0 12px 0;border-bottom:2px solid rgba(255,255,255,.3);padding-bottom:6px}
.aahub-col ul{margin:0;padding:0 0 0 16px}
.aahub-col li{margin-bottom:4px}
.aahub-col a{color:#7dd3fc;text-decoration:none}
.aahub-col a:hover{text-decoration:underline}
.aahub-callout{font-size:28px;font-weight:700;text-align:center;padding-top:20px;text-shadow:0 2px 8px rgba(0,0,0,.5)}
.aahub-gandalf{text-align:center}
.aahub-gandalf img{max-width:120px;border-radius:50%;border:3px solid rgba(255,255,255,.4)}
</style>
<div class="aahub-header" onclick="var h=this.nextElementSibling;h.style.display=h.style.display==='none'?'block':'none'">
<h1>Global Architecture Advisory &mdash; Central Tavern &amp; Inn</h1>
<div class="subtitle">Welcome, traveler. Your journey through Middle-earth architecture starts here.</div>
</div>
<div class="aahub-hero">
<div class="aahub-overlay">
<div class="aahub-col" style="grid-column:span 2"><h2>Welcome</h2><p>The Architecture Advisory team supports SAP's global architecture landscape. Explore our resources, deliverables, and community hubs.</p><p>Use the navigation tabs above to browse by category.</p></div>
<div class="aahub-col aahub-gandalf"><img src="https://upload.wikimedia.org/wikipedia/en/e/e9/Gandalf600ppx.jpg" alt="Gandalf" /><p style="margin-top:8px;font-style:italic">&ldquo;All we have to decide is what to do with the time that is given us.&rdquo;</p></div>
<div class="aahub-col aahub-callout">YOU'VE FOUND US!!!</div>
<div class="aahub-col"><h2>Top News</h2><ul><li><a href="#">Q1 Architecture Review Complete</a></li><li><a href="#">New Cloud Foundry Patterns Published</a></li><li><a href="#">Architecture Community Day &mdash; March 2026</a></li><li><a href="#">Updated Reference Architecture Library</a></li></ul></div>
<div class="aahub-col" style="grid-column:span 2"><h2>Good to Know</h2><ul><li><a href="#">Architecture Decision Records (ADR) Template</a></li><li><a href="#">Cloud Foundry Migration Playbook</a></li><li><a href="#">SAP BTP Best Practices Guide</a></li><li><a href="#">Security Architecture Checklist</a></li><li><a href="#">Integration Patterns Catalog</a></li></ul></div>
</div>
</div>`.replace(/\n/g, '');

// ─── Dropdown Tabs ──────────────────────────────────────────────────────────

const DROPDOWN_TABS = [
  {
    label: 'Strategic Initiatives',
    items: [
      { label: 'Clean Core Strategy', url: '/teams/AAHUB/SitePages/Clean-Core.aspx', target: '_self' },
      { label: 'Cloud Transformation', url: '/teams/AAHUB/SitePages/Cloud-Transformation.aspx', target: '_self' },
      { label: 'AI & ML Architecture', url: '/teams/AAHUB/SitePages/AI-ML.aspx', target: '_self' },
      { label: 'Sustainability', url: '/teams/AAHUB/SitePages/Sustainability.aspx', target: '_self' },
      { label: 'Integration Strategy', url: '/teams/AAHUB/SitePages/Integration.aspx', target: '_self' },
      { label: 'Data Architecture', url: '/teams/AAHUB/SitePages/Data-Architecture.aspx', target: '_self' },
      { label: 'Platform Engineering', url: '/teams/AAHUB/SitePages/Platform-Engineering.aspx', target: '_self' },
    ],
  },
  {
    label: 'Resources / Tools',
    items: [
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
    ],
  },
  {
    label: 'Deliverables',
    items: [
      { label: 'Architecture Reviews', url: '/teams/AAHUB/SitePages/Reviews.aspx', target: '_self' },
      { label: 'Technical Blueprints', url: '/teams/AAHUB/SitePages/Blueprints.aspx', target: '_self' },
      { label: 'Security Assessments', url: '/teams/AAHUB/SitePages/Security.aspx', target: '_self' },
      { label: 'Performance Benchmarks', url: '/teams/AAHUB/SitePages/Benchmarks.aspx', target: '_self' },
      { label: 'Migration Plans', url: '/teams/AAHUB/SitePages/Migration.aspx', target: '_self' },
    ],
  },
  {
    label: 'AA Generated Content',
    items: [
      { label: 'Architecture Blog Posts', url: '/teams/AAHUB/SitePages/Blog.aspx', target: '_self' },
      { label: 'Whitepapers & Publications', url: '/teams/AAHUB/SitePages/Whitepapers.aspx', target: '_self' },
      { label: 'Conference Presentations', url: '/teams/AAHUB/SitePages/Presentations.aspx', target: '_self' },
    ],
  },
  {
    label: 'Reference Content',
    items: [
      { label: 'SAP Technology Map', url: '/teams/AAHUB/SitePages/Tech-Map.aspx', target: '_self' },
      { label: 'Solution Architecture Patterns', url: '/teams/AAHUB/SitePages/Patterns.aspx', target: '_self' },
      { label: 'Security Reference Architecture', url: '/teams/AAHUB/SitePages/Security-Ref.aspx', target: '_self' },
      { label: 'Integration Patterns', url: '/teams/AAHUB/SitePages/Integration-Patterns.aspx', target: '_self' },
      { label: 'Data Architecture Patterns', url: '/teams/AAHUB/SitePages/Data-Patterns.aspx', target: '_self' },
      { label: 'Cloud Native Patterns', url: '/teams/AAHUB/SitePages/Cloud-Native.aspx', target: '_self' },
    ],
  },
  {
    label: 'Architecture Communities',
    items: [
      { label: 'Global Architecture Network', url: '/teams/AAHUB/SitePages/GAN.aspx', target: '_self' },
      { label: 'BTP Architecture Guild', url: '/teams/AAHUB/SitePages/BTP-Guild.aspx', target: '_self' },
      { label: 'Security Architecture Forum', url: '/teams/AAHUB/SitePages/Security-Forum.aspx', target: '_self' },
      { label: 'Integration Community', url: '/teams/AAHUB/SitePages/Integration-Community.aspx', target: '_self' },
      { label: 'Cloud Native CoP', url: '/teams/AAHUB/SitePages/Cloud-CoP.aspx', target: '_self' },
    ],
  },
  {
    label: 'Learning Paths',
    items: [
      { label: 'BTP Architect Certification', url: 'https://learning.sap.com/', target: '_blank' },
      { label: 'Cloud Foundry Fundamentals', url: '/teams/AAHUB/SitePages/CF-Learning.aspx', target: '_self' },
      { label: 'Integration Suite Training', url: '/teams/AAHUB/SitePages/IS-Training.aspx', target: '_self' },
      { label: 'Architecture Kata Workshops', url: '/teams/AAHUB/SitePages/Kata.aspx', target: '_self' },
    ],
  },
  {
    label: 'Communications',
    items: [
      { label: 'Architecture Newsletter', url: '/teams/AAHUB/SitePages/Newsletter.aspx', target: '_self' },
      { label: 'Town Hall Recordings', url: '/teams/AAHUB/SitePages/Town-Hall.aspx', target: '_self' },
      { label: 'Upcoming Events', url: '/teams/AAHUB/SitePages/Events.aspx', target: '_self' },
    ],
  },
];

// ─── Build webPartData properties ───────────────────────────────────────────

function buildProperties() {
  const props = {
    description: 'AA HUB Homepage',
    sectionClass: '',
    webpartClass: '',
    tabCount: 9,
    tabData: [],
    themeMode: 'auto',
    tabStyle: 'default',
    tabAlignment: 'stretch',
    accentColor: '',
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
    activeIndicatorWidth: '3px',
    tabShadow: 'none',
    enableTransitions: true,
    showActiveIndicator: false,
    activeIndicatorColor: '',
    showTabSeparator: false,
    tabSeparatorColor: '',
    tabContentGap: '0px',
    tabOrientation: 'horizontal',
    enableDeepLinking: true,
    enableLazyLoading: true,
    enableFullWidthFix: true,
    iconStyle: 'svg',

    // Tab 1: Home — HTML hero content
    tab1Label: 'Home',
    tab1ContentType: 'html',
    tab1CustomContent: HERO_HTML,
    tab1ContentFullWidth: true,
    tab1ContentSourceType: 'manual',
  };

  // Tabs 2–9: Dropdown navigation
  DROPDOWN_TABS.forEach((tab, idx) => {
    const tabNum = idx + 2;
    props[`tab${tabNum}Label`] = tab.label;
    props[`tab${tabNum}ContentType`] = 'html';  // base content type (unused for dropdown)
    props[`tab${tabNum}DropdownEnabled`] = true;
    props[`tab${tabNum}DropdownItems`] = JSON.stringify(tab.items);
    props[`tab${tabNum}DropdownStyle`] = 'dark';
  });

  return props;
}

// ─── Build the full webPartData JSON ────────────────────────────────────────

function buildWebPartData() {
  return {
    id: PICANVAS_ID,
    instanceId: generateGuid(),
    title: 'PiCanvas',
    description: 'Infinite possibilities - Configure tabs to organize web parts from anywhere on the page.',
    dataVersion: '1.0',
    properties: buildProperties(),
    serverProcessedContent: {
      htmlStrings: {},
      searchablePlainTexts: {},
      imageSources: {},
      links: {}
    }
  };
}

function generateGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Execute ────────────────────────────────────────────────────────────────

function run(cmd) {
  console.log(`> ${cmd.substring(0, 120)}...`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return out.trim();
  } catch (e) {
    console.error('FAILED:', e.stderr || e.message);
    throw e;
  }
}

async function main() {
  console.log('=== AA HUB Demo Page Setup ===\n');

  // Step 1: Remove the existing empty text control
  console.log('1. Clearing existing controls...');
  try {
    run(`m365 spo page control list --webUrl "${SITE}" --pageName "${PAGE}" --output json`);
    // Remove the text control (id from earlier listing)
    run(`m365 spo page control remove --webUrl "${SITE}" --pageName "${PAGE}" --id "49740bda-b4bb-48fd-995c-399f1bec5cde" --force`);
    console.log('   Removed existing text control.\n');
  } catch (e) {
    console.log('   No controls to remove or already clean.\n');
  }

  // Step 2: Add PiCanvas webpart with full configuration
  console.log('2. Adding PiCanvas webpart with AA HUB configuration...');
  const wpData = buildWebPartData();
  const wpDataJson = JSON.stringify(wpData);

  // Write to temp file to avoid shell escaping issues
  const fs = require('fs');
  const tmpFile = '/tmp/picanvas-aahub-wpdata.json';
  fs.writeFileSync(tmpFile, wpDataJson, 'utf8');
  console.log(`   Wrote webpart data to ${tmpFile} (${wpDataJson.length} bytes)`);

  // Add the webpart using m365 cli
  try {
    run(`m365 spo page clientsidewebpart add --webUrl "${SITE}" --pageName "${PAGE}" --webPartId "${PICANVAS_ID}" --webPartProperties @${tmpFile} --section 1 --column 1`);
    console.log('   PiCanvas webpart added!\n');
  } catch (e) {
    console.error('   Failed to add webpart. Trying alternative approach...\n');
    // Try with inline properties
    const escapedJson = wpDataJson.replace(/'/g, "'\\''");
    run(`m365 spo page clientsidewebpart add --webUrl "${SITE}" --pageName "${PAGE}" --webPartId "${PICANVAS_ID}" --webPartProperties '${escapedJson}' --section 1 --column 1`);
    console.log('   PiCanvas webpart added (alternative)!\n');
  }

  // Step 3: Verify
  console.log('3. Verifying...');
  const controls = run(`m365 spo page control list --webUrl "${SITE}" --pageName "${PAGE}" --output json`);
  const parsed = JSON.parse(controls);
  const picanvas = parsed.find(c => c.title === 'PiCanvas' || (c.controlData?.webPartId === PICANVAS_ID));
  if (picanvas) {
    console.log(`   PiCanvas found! Control ID: ${picanvas.id}`);
    console.log(`   Zone: ${picanvas.controlData?.position?.zoneIndex}, Section: ${picanvas.controlData?.position?.sectionIndex}\n`);
  } else {
    console.log('   Warning: PiCanvas not found in controls list. It may need manual verification.\n');
  }

  console.log('=== Done! ===');
  console.log(`Open: ${SITE}/SitePages/${PAGE}?debugManifestsFile=https%3A%2F%2Flocalhost%3A4321%2Ftemp%2Fbuild%2Fmanifests.js&debug=true&noredir=true`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
