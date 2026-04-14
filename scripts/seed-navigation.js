#!/usr/bin/env node
/**
 * seed-navigation.js
 * Extracts navigation links from aahub-home-sap.html and loads them
 * into the PiCanvasNavigation SharePoint list via m365 CLI.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SITE = process.argv[2] || 'https://pispace.sharepoint.com/sites/AAHUB';
const LIST = 'PiCanvasNavigation';

// Full navigation tree extracted from aahub-home-sap.html
const NAV_TREE = [
  {
    title: 'Strategic Initiatives', url: '#', sort: 1, children: [
      { title: 'Business AI', url: 'https://sap.sharepoint.com/sites/208497/', sort: 1, isNew: true, children: [
        { title: 'AI Agents', url: 'https://sap.sharepoint.com/sites/208497/SitePages/AI-Business-Agents-at-SAP.aspx', sort: 1 },
        { title: 'Joule', url: 'https://sap.sharepoint.com/sites/208497/SitePages/Joule.aspx', sort: 2 },
        { title: 'Custom AI', url: 'https://sap.sharepoint.com/sites/208497/SitePages/Build-AI.aspx', sort: 3 },
      ]},
      { title: 'Account Planning 2026', url: 'https://sap.sharepoint.com/teams/AAHUB/SitePages/pb_apm2026.aspx?env=Embedded', sort: 2 },
      { title: 'SAP Business Suite', url: 'https://sap.sharepoint.com/sites/210236', sort: 3, children: [
        { title: 'Switch Motions', url: 'https://sap.sharepoint.com/teams/CSSGtMCommunity/SitePages/Switch-Motions.aspx', sort: 1 },
        { title: 'Business Suite Enablement', url: 'https://learning.sap.com/learning-journeys/positioning-sap-business-suite', sort: 2 },
      ]},
      { title: 'GROW with SAP', url: 'https://content-discovery.int.sap/external/sales-plays/62d62093-27bb-4d02-97a2-ab40b4dd416f', sort: 4 },
      { title: 'RISE with SAP', url: 'https://sap.sharepoint.com/sites/208790/SitePages/RISE-with-SAP-for-AAs.aspx', sort: 5 },
      { title: 'Business Data Cloud', url: 'https://sap.sharepoint.com/sites/201584/SitePages/SAP-Business-Data-Cloud.aspx', sort: 6, children: [
        { title: 'BDC L0/L1/L2', url: 'https://sap.sharepoint.com/sites/209107/SitePages/SAP-Business-Data-Cloud.aspx', sort: 1 },
        { title: 'BDC Competitive Info', url: 'https://workzone.one.int.sap/', sort: 2 },
        { title: 'Datasphere L0/L1/L2', url: 'https://sap.sharepoint.com/sites/209107/SitePages/SAP-Datasphere.aspx', sort: 3 },
      ]},
      { title: 'Integrated Toolchain', url: 'https://sap.sharepoint.com/sites/209577/SitePages/Toolchain.aspx', sort: 7, children: [
        { title: 'L1 Deck/Pitch', url: 'https://dam.sap.com/', sort: 1 },
        { title: 'Guide for Enterprise Architects', url: 'https://dam.sap.com/', sort: 2 },
      ]},
    ]
  },
  {
    title: 'Resources / Tools', url: '#', sort: 2, children: [
      { title: 'Melody Activity Reporting', url: 'https://sapit-home-prod-004.launchpad.cfapps.eu10.hana.ondemand.com/site#pc-app', sort: 1 },
      { title: 'Melody Request', url: 'https://sapit-home-prod-004.launchpad.cfapps.eu10.hana.ondemand.com/site/Home', sort: 2 },
      { title: 'LeanIX', url: '#', sort: 3, children: [
        { title: 'Delivery Workspace', url: 'https://demo-eu-3.leanix.net/', sort: 1 },
        { title: 'Request Workspace (MS Form)', url: 'https://url.sap/15hx9q', sort: 2 },
        { title: 'Industry Reference Kits', url: 'https://sap.sharepoint.com/sites/208723/', sort: 3 },
      ]},
      { title: 'Customer One 360', url: 'https://intelligent-workplace.analytics.for.sap/', sort: 4 },
      { title: 'Start.me', url: '#', sort: 5, children: [
        { title: 'Start.Me for AAs', url: 'https://start.me/p/0Pv4Bd/enterprise-architecture', sort: 1 },
        { title: 'Start.Me Accelerators', url: 'https://start.me/p/lL4n8K/ea-accelerators', sort: 2 },
        { title: 'Start.Me for RISE', url: 'https://start.me/p/wMrOMz/rise', sort: 3 },
      ]},
      { title: 'Totango', url: 'https://app.totango.com/', sort: 6 },
      { title: '(NA) Wiki', url: 'https://wiki.one.int.sap/wiki/display/NAEA/', sort: 7 },
      { title: 'Cloud Reporting', url: 'https://reporting.ondemand.com/sap/crp/cdo?type=crp', sort: 8 },
      { title: 'Innovation Review Dashboard', url: 'https://mi-tools.wdf.sap.corp/innovation-review-dashboard/', sort: 9 },
    ]
  },
  {
    title: 'Deliverables', url: '#', sort: 3, children: [
      { title: 'Select Phase Core Deliverables', url: 'https://sap.sharepoint.com/teams/AAHUB/', sort: 1, children: [
        { title: 'Business Capability Map', url: 'https://sap.sharepoint.com/sites/211113/SitePages/BCM.aspx', sort: 1 },
        { title: 'Product Map', url: 'https://sap.sharepoint.com/sites/211113/SitePages/ProductMap.aspx', sort: 2 },
        { title: 'AAOD', url: 'https://sap.sharepoint.com/sites/211113/SitePages/AAOD.aspx', sort: 3 },
        { title: 'Transformation Roadmap', url: 'https://sap.sharepoint.com/sites/211113/SitePages/Roadmap.aspx', sort: 4 },
        { title: 'C2C Adoption Plan', url: 'https://sap.sharepoint.com/sites/211113/SitePages/C2C_AdoptionPlan.aspx', sort: 5 },
        { title: 'E2E SAP Offerings Positioning', url: 'https://sap.sharepoint.com/sites/211113/SitePages/E2E_Positioning.aspx', sort: 6 },
      ]},
      { title: 'AI Discovery Workshop (MXP)', url: 'https://launcher.value-experience-hub.for.sap/', sort: 2, isNew: true },
      { title: 'Digital Discovery Assessment (DDA)', url: 'https://flpnwc-a664064c8.dispatcher.hana.ondemand.com/sites/s4hc#Shell-home', sort: 3 },
      { title: 'Business Data Cloud (BDC) Workshop', url: 'https://sap.sharepoint.com/sites/200426/', sort: 4 },
    ]
  },
  {
    title: 'AA Generated Content', url: '#', sort: 4, children: [
      { title: 'Regional AA / EA Internal Content', url: '#', sort: 1, children: [
        { title: 'Americas Customer Folder', url: 'https://sap.sharepoint.com/teams/AAEA-RISEJointEngagementModelHub/', sort: 1 },
        { title: 'APAC Customer Folder', url: 'https://sap.sharepoint.com/teams/AAEA-RISEJointEngagementModelHub/', sort: 2 },
        { title: 'EMEA Customer Folder', url: 'https://sap.sharepoint.com/teams/AAEA-RISEJointEngagementModelHub/', sort: 3 },
        { title: 'MEE Customer Folder', url: 'https://sap.sharepoint.com/teams/MEEArchitectsinCustomerAdvisory/', sort: 4 },
      ]},
      { title: 'Regional Enablement Recordings', url: '#', sort: 2, children: [
        { title: 'Global Architecture Calls', url: 'https://sap.sharepoint.com/sites/211435/SitePages/Knowledge-Sharing-Calls.aspx', sort: 1 },
        { title: 'Americas (North) Calls', url: 'https://video.sap.com/channel/channelid/265308842', sort: 2 },
        { title: 'Americas (LATAM) Calls', url: 'https://sap.sharepoint.com/teams/EnterpriseArchitect821/', sort: 3 },
      ]},
      { title: 'Best Practice Sharing Content', url: 'https://sap.sharepoint.com/sites/208790/', sort: 3 },
    ]
  },
  {
    title: 'Reference Content', url: '#', sort: 5, children: [
      { title: 'Customer Value Journey (CVJ)', url: 'https://sap.sharepoint.com/sites/205323', sort: 1, children: [
        { title: 'AA @ SAP', url: 'https://sap.sharepoint.com/teams/ICAArchitectHub-OSTRTATESTCHANNEL/SitePages/AA@SAP.aspx', sort: 1 },
        { title: 'AA Role Definitions', url: 'https://sap.sharepoint.com/sites/205323/', sort: 2 },
        { title: 'RACI', url: 'https://sap.sharepoint.com/sites/205323/SitePages/CVJ2.0/Master-RACI-Landing.aspx', sort: 3 },
        { title: 'Select', url: 'https://sap.sharepoint.com/sites/205323/SitePages/CVJ2.0/SELECT.aspx', sort: 4 },
        { title: 'Extend', url: 'https://sap.sharepoint.com/sites/205323/SitePages/CVJ2.0/EXTEND.aspx', sort: 5 },
        { title: 'AA / EA RISE Joint Engagement Hub', url: 'https://sap.sharepoint.com/sites/211113/SitePages/Home.aspx', sort: 6 },
      ]},
      { title: 'Industry Content', url: 'https://workzone.one.int.sap/', sort: 2, children: [
        { title: 'Industry Reference Kits', url: 'https://sap.sharepoint.com/sites/208723/', sort: 1 },
        { title: 'Life Sciences', url: 'https://workzone.one.int.sap/', sort: 2 },
        { title: 'Professional Services', url: 'https://workzone.one.int.sap/', sort: 3 },
        { title: 'Automotive', url: 'https://workzone.one.int.sap/', sort: 4 },
        { title: 'Healthcare', url: 'https://workzone.one.int.sap/', sort: 5 },
        { title: 'High Tech', url: 'https://workzone.one.int.sap/', sort: 6 },
        { title: 'Banking', url: 'https://workzone.one.int.sap/', sort: 7 },
        { title: 'Insurance', url: 'https://workzone.one.int.sap/', sort: 8 },
        { title: 'Retail', url: 'https://workzone.one.int.sap/', sort: 9 },
      ]},
      { title: 'Reference Architecture Content', url: '#', sort: 3, children: [
        { title: 'SAP Architecture Center', url: 'https://architecture.learning.sap.com/', sort: 1 },
        { title: 'Discovery Center', url: 'https://discovery-center.cloud.sap/index.html', sort: 2 },
        { title: 'LeanIX Product Info', url: 'https://sap.sharepoint.com/sites/200848/SitePages/LeanIX.aspx', sort: 3 },
        { title: 'Signavio', url: 'https://sap.sharepoint.com/sites/210177', sort: 4 },
        { title: 'SuccessFactors', url: 'https://workzone.one.int.sap/', sort: 5 },
      ]},
      { title: 'Hyperscaler Support', url: '#', sort: 4, children: [
        { title: 'Hyperscaler Capability Dashboard', url: 'https://hcd.hec.tools.sap/home', sort: 1 },
        { title: 'Harmonized Security Layer', url: 'https://sap.sharepoint.com/sites/121309/', sort: 2 },
        { title: 'IBM Cloud', url: 'https://sap.sharepoint.com/sites/206593/', sort: 3 },
      ]},
      { title: 'AA Playbook', url: 'https://sap.sharepoint.com/teams/AAHUB/SitePages/aaplaybook.aspx?env=Embedded', sort: 5 },
      { title: 'Methodologies', url: '#', sort: 6, children: [
        { title: 'SAP EAM', url: 'https://sap.sharepoint.com/teams/EAF/SitePages/Methodology.aspx', sort: 1 },
        { title: 'RISE with SAP', url: 'https://sap.sharepoint.com/sites/208790/', sort: 2 },
        { title: 'SAP Activate', url: 'https://me.sap.com/roadmapviewer', sort: 3 },
        { title: 'SAP EA Framework (EAF)', url: 'https://sap.sharepoint.com/teams/EAF/SitePages/Home.aspx', sort: 4 },
      ]},
    ]
  },
  {
    title: 'Architecture Communities', url: '#', sort: 6, children: [
      { title: 'Global Architecture Advisory', url: 'https://jam4.sapjam.com/', sort: 1 },
      { title: 'SAP EAM Community', url: 'https://sap.sharepoint.com/sites/210796/', sort: 2 },
      { title: 'SAP LeanIX Community', url: 'https://sap.sharepoint.com/teams/ExternalOnboardingSharepoint/', sort: 3 },
      { title: 'Multi Architect Community', url: 'https://sap.sharepoint.com/sites/210796/', sort: 4 },
      { title: 'EA Delivery Practice Community', url: 'https://teams.microsoft.com/', sort: 5 },
      { title: 'RBA-RSA Community', url: 'https://profiles.wdf.sap.corp/', sort: 6 },
    ]
  },
  {
    title: 'Learning Paths', url: '#', sort: 7, children: [
      { title: 'Cohort Training', url: '#', sort: 1, children: [
        { title: 'Module 1', url: '#', sort: 1, children: [
          { title: 'EA Academy: Why Enterprise Architecture', url: 'https://video.sap.com/media/t/1_m88rlwwl', sort: 1 },
          { title: 'Soft Skills', url: 'https://sap.plateau.com/', sort: 2 },
          { title: 'Melody Time Reporting', url: 'https://teams.microsoft.com/', sort: 3 },
        ]},
        { title: 'Module 2', url: '#', sort: 2, children: [
          { title: 'Industry Advisory', url: 'https://video.sap.com/media/t/1_mfld0m0h', sort: 1 },
          { title: 'Value Advisory', url: 'https://video.sap.com/media/t/1_922y8nx3', sort: 2 },
          { title: 'RISE EA', url: 'https://video.sap.com/media/1_mxc76ioo', sort: 3 },
          { title: 'Solution Advisory', url: 'https://video.sap.com/media/t/1_djtk305b', sort: 4 },
        ]},
        { title: 'Module 3', url: '#', sort: 3 },
        { title: 'Module 4', url: '#', sort: 4 },
        { title: 'Module 5', url: '#', sort: 5 },
      ]},
      { title: 'SuccessMap Learning', url: 'https://performancemanager5.successfactors.eu/', sort: 2 },
      { title: 'Skills Assessments', url: 'https://customer-success-skills-assessment.cfapps.eu10.hana.ondemand.com/', sort: 3 },
      { title: 'NLAC Learning Journey', url: 'https://sap.sharepoint.com/sites/200460/', sort: 4 },
    ]
  },
  {
    title: 'Communications', url: '#', sort: 8, children: [
      { title: 'Site Feedback + Add/Edit Links', url: 'https://forms.office.com/e/SMRwMhhsBH', sort: 1 },
      { title: 'AA Q&A Resource - STACK@SAP', url: 'https://sap.stackenterprise.co/', sort: 2 },
      { title: 'Global AA Newsletters', url: 'https://sap.sharepoint.com/teams/ICAArchitectHub/', sort: 3 },
    ]
  },
];

// Flatten tree and create items with parent references
let itemCount = 0;
const idMap = new Map(); // title -> SP list item ID

async function createItem(node, parentId) {
  const args = [
    `--Title "${node.title.replace(/"/g, '\\"')}"`,
    `--NavUrl "${(node.url === '#' ? SITE : node.url)}"`,
    `--SortOrder ${node.sort || 0}`,
    `--IsEnabled true`,
    `--OpenInNewWindow true`,
  ];
  if (parentId) args.push(`--ParentId0 ${parentId}`);
  if (node.isNew) args.push('--IsNew true');
  if (node.icon) args.push(`--Icon "${node.icon}"`);

  const cmd = `m365 spo listitem add --listTitle "${LIST}" --webUrl "${SITE}" ${args.join(' ')} --output json`;

  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    let id = null;
    try {
      const json = JSON.parse(output);
      id = json.Id || json.id || null;
    } catch {
      // Fallback: grep for top-level Id
      const idMatch = output.match(/^Id\s*:\s*(\d+)/m);
      id = idMatch ? parseInt(idMatch[1]) : null;
    }
    itemCount++;

    const depth = parentId ? '  ' : '';
    const childDepth = parentId ? '    ' : '  ';
    if (!parentId) console.log(`${depth}[${id}] ${node.title}`);
    else console.log(`${depth}[${id}] ${node.title} (parent=${parentId})`);

    // Recursively create children
    if (node.children && node.children.length > 0 && id) {
      for (const child of node.children) {
        createItem(child, id);
      }
    }

    return id;
  } catch (err) {
    console.error(`  FAILED: ${node.title} - ${err.message.substring(0, 80)}`);
    return null;
  }
}

console.log(`Loading navigation into ${SITE}/${LIST}...\n`);

for (const topLevel of NAV_TREE) {
  createItem(topLevel, null);
  console.log('');
}

console.log(`\nDone! Created ${itemCount} navigation items.`);
