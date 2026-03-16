/**
 * Deep diagnostic for dual PiCanvas — check why webpart JS isn't executing.
 * Target: https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SP_URL = 'https://sap.sharepoint.com/sites/202833/SitePages/Protect-SAP-SecAware-Championship.aspx';
const EDGE_PROFILE_DIR = '/Users/I741344/Library/Application Support/Microsoft Edge/Default';
const SCREENSHOTS_DIR = path.resolve(__dirname, 'test-results/dual-picanvas');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function handleSSOLogin(page: Page): Promise<void> {
  const url = page.url();
  if (url.includes('login.microsoftonline.com')) {
    const accountLink = page.locator('text=anthony.hopkins@sap.com').first();
    const anyAccount = page.locator('#tilesHolder div[tabindex="0"], .table div[role="link"], [data-test-id]').first();
    if (await accountLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await accountLink.click();
    } else if (await anyAccount.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await anyAccount.click();
    }
    await page.waitForURL('**/sap.sharepoint.com/**', { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
  }
}

const test = base.extend<{ edgePage: Page }>({
  // eslint-disable-next-line no-empty-pattern
  edgePage: async ({}, use) => {
    const context: BrowserContext = await chromium.launchPersistentContext(EDGE_PROFILE_DIR, {
      channel: 'msedge',
      headless: false,
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1024 },
      args: ['--disable-blink-features=AutomationControlled'],
    });
    const page = context.pages()[0] || await context.newPage();
    page.on('dialog', async (dialog) => await dialog.accept());
    await use(page);
    await context.close();
  },
});

test.describe('Deep PiCanvas Debug — /sites/202833', () => {
  test.setTimeout(180_000);

  test('check webpart loading, JS errors, and network', async ({ edgePage: page }) => {
    // ── Capture ALL console messages from the start ──
    const consoleMessages: Array<{ type: string; text: string; url: string }> = [];
    page.on('console', msg => {
      const text = msg.text();
      // Capture PiCanvas-related and error messages
      if (msg.type() === 'error' || text.includes('PiCanvas') || text.includes('piCanvas') ||
          text.includes('picanvas') || text.includes('webpart') || text.includes('WebPart') ||
          text.includes('SPFx') || text.includes('manifest') || text.includes('addTabs')) {
        consoleMessages.push({
          type: msg.type(),
          text: text.substring(0, 300),
          url: msg.location()?.url?.substring(0, 100) || '',
        });
      }
    });

    // ── Capture failed network requests ──
    const failedRequests: Array<{ url: string; status: number; statusText: string }> = [];
    const picanvasRequests: Array<{ url: string; status: number; method: string }> = [];
    page.on('response', response => {
      const url = response.url();
      if (response.status() >= 400) {
        failedRequests.push({
          url: url.substring(0, 200),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
      // Track PiCanvas bundle requests
      if (url.includes('picanvas') || url.includes('PiCanvas') || url.includes('pi-canvas')) {
        picanvasRequests.push({
          url: url.substring(0, 200),
          status: response.status(),
          method: response.request().method(),
        });
      }
    });

    // ── Navigate ──
    console.log(`\n${'═'.repeat(70)}`);
    console.log('DEEP PICANVAS DIAGNOSTIC — JS/Network/Manifest');
    console.log(`${'═'.repeat(70)}\n`);

    await page.goto(SP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await handleSSOLogin(page);
    await page.waitForLoadState('load', { timeout: 60_000 });
    console.log('Waiting 25s for full initialization...');
    await page.waitForTimeout(25_000);

    const title = await page.title();
    console.log(`Page: "${title}"\n`);

    // ── 1. Check if PiCanvas sppkg / app is installed on this site ──
    const appCatalogInfo = await page.evaluate(() => {
      // Check for SPFx component loading indicators
      const spfxLogs: string[] = [];

      // Check if any SPFx manifests mention PiCanvas
      const allScripts = document.querySelectorAll('script[src]');
      const picanvasScripts = Array.from(allScripts)
        .filter(s => s.getAttribute('src')?.toLowerCase().includes('picanvas'))
        .map(s => s.getAttribute('src')?.substring(0, 200) || '');

      // Check for webpart placeholder containers
      const vpcContainers = document.querySelectorAll('[id*="vpc_WebPart"]');
      const vpcInfo = Array.from(vpcContainers).map(el => {
        const h = el as HTMLElement;
        return {
          id: h.id,
          childCount: h.childElementCount,
          innerHTML: h.innerHTML.substring(0, 500),
          parentId: h.parentElement?.id || '',
          parentClass: h.parentElement?.className?.toString().substring(0, 100) || '',
          height: Math.round(h.getBoundingClientRect().height),
        };
      });

      // Check for SPFx error placeholders (webpart failed to load)
      const errorPlaceholders = document.querySelectorAll('[class*="placeholder"], [class*="errorMessage"], [data-automation-id*="error"]');
      const errors = Array.from(errorPlaceholders)
        .filter(el => {
          const parent = el.closest('[id*="vpc_WebPart"]') || el.closest('[data-sp-web-part]');
          return parent !== null;
        })
        .map(el => ({
          tag: el.tagName.toLowerCase(),
          class: el.className?.toString().substring(0, 100) || '',
          text: el.textContent?.trim().substring(0, 200) || '',
        }));

      // Check <div data-sp-webpart> for PiCanvas specifically
      const spWebparts = document.querySelectorAll('[data-sp-webpart]');
      const wpDetails = Array.from(spWebparts).map(el => {
        const h = el as HTMLElement;
        return {
          id: h.getAttribute('data-sp-webpart') || '',
          featureId: h.getAttribute('data-sp-feature-tag') || '',
          html: h.innerHTML.substring(0, 300),
          childCount: h.childElementCount,
        };
      });

      return { picanvasScripts, vpcContainers: vpcInfo, errorPlaceholders: errors, webparts: wpDetails };
    });

    console.log('── APP / BUNDLE CHECK ──');
    console.log(`PiCanvas script tags: ${appCatalogInfo.picanvasScripts.length}`);
    for (const s of appCatalogInfo.picanvasScripts) {
      console.log(`  ${s}`);
    }

    console.log(`\nVPC containers (${appCatalogInfo.vpcContainers.length}):`);
    for (const v of appCatalogInfo.vpcContainers) {
      console.log(`  ${v.id}`);
      console.log(`    children: ${v.childCount}, height: ${v.height}`);
      console.log(`    parent: id="${v.parentId}" class="${v.parentClass}"`);
      console.log(`    innerHTML (first 500): ${v.innerHTML}`);
    }

    if (appCatalogInfo.errorPlaceholders.length > 0) {
      console.log(`\nError placeholders found: ${appCatalogInfo.errorPlaceholders.length}`);
      for (const e of appCatalogInfo.errorPlaceholders) {
        console.log(`  <${e.tag}> class="${e.class}": ${e.text}`);
      }
    }

    console.log(`\nAll webparts (data-sp-webpart): ${appCatalogInfo.webparts.length}`);
    for (const wp of appCatalogInfo.webparts) {
      console.log(`  id="${wp.id}" feature="${wp.featureId}" children=${wp.childCount}`);
      if (wp.html) console.log(`    html: ${wp.html}`);
    }

    // ── 2. Full DOM scan for PiCanvas traces ──
    const domScan = await page.evaluate(() => {
      const body = document.body.innerHTML;

      // Count references
      const picanvasRefs = (body.match(/picanvas|PiCanvas|pi-canvas/gi) || []).length;
      const addTabsRefs = (body.match(/addTabs|AddTabs/g) || []).length;
      const navTabsRefs = (body.match(/nav-tabs/g) || []).length;
      const tabContentRefs = (body.match(/tab-content/g) || []).length;

      // Check if the page is using modern or classic experience
      const isModern = !!document.querySelector('[data-automation-id="CanvasControl"]');
      const isClassic = !!document.querySelector('#s4-workspace');

      // Check for canvas controls (modern page webparts)
      const canvasControls = document.querySelectorAll('[data-automation-id="CanvasControl"]');
      const controlInfo = Array.from(canvasControls).map((el, i) => {
        const h = el as HTMLElement;
        const inner = h.innerHTML;
        const hasPiCanvas = /picanvas|PiCanvas/i.test(inner);
        return {
          index: i,
          hasPiCanvas,
          height: Math.round(h.getBoundingClientRect().height),
          childCount: h.childElementCount,
          dataAttrs: Array.from(h.attributes)
            .filter(a => a.name.startsWith('data-'))
            .map(a => `${a.name}="${a.value.substring(0, 60)}"`)
            .join(' '),
        };
      });

      // Check for shadow DOMs that might hide PiCanvas
      const shadowHosts = document.querySelectorAll('*');
      let shadowDomCount = 0;
      shadowHosts.forEach(el => { if (el.shadowRoot) shadowDomCount++; });

      return {
        picanvasRefs,
        addTabsRefs,
        navTabsRefs,
        tabContentRefs,
        isModern,
        isClassic,
        canvasControls: controlInfo,
        shadowDomCount,
        bodyLength: body.length,
      };
    });

    console.log('\n── DOM SCAN ──');
    console.log(`Page type: ${domScan.isModern ? 'Modern' : domScan.isClassic ? 'Classic' : 'Unknown'}`);
    console.log(`Body HTML length: ${domScan.bodyLength.toLocaleString()} chars`);
    console.log(`"picanvas/PiCanvas" refs in body: ${domScan.picanvasRefs}`);
    console.log(`"addTabs" refs: ${domScan.addTabsRefs}`);
    console.log(`"nav-tabs" refs: ${domScan.navTabsRefs}`);
    console.log(`"tab-content" refs: ${domScan.tabContentRefs}`);
    console.log(`Shadow DOM hosts: ${domScan.shadowDomCount}`);

    console.log(`\nCanvas controls: ${domScan.canvasControls.length}`);
    for (const c of domScan.canvasControls) {
      const marker = c.hasPiCanvas ? ' ◀ PICANVAS' : '';
      console.log(`  Control ${c.index}: h=${c.height}, children=${c.childCount}${marker}`);
      if (c.dataAttrs) console.log(`    ${c.dataAttrs}`);
    }

    // ── 3. Console messages ──
    console.log(`\n── CONSOLE MESSAGES (${consoleMessages.length}) ──`);
    for (const msg of consoleMessages.slice(0, 40)) {
      console.log(`  [${msg.type}] ${msg.text}`);
      if (msg.url) console.log(`    from: ${msg.url}`);
    }

    // ── 4. Failed network requests ──
    console.log(`\n── FAILED REQUESTS (${failedRequests.length}) ──`);
    for (const r of failedRequests.slice(0, 20)) {
      console.log(`  ${r.status} ${r.statusText}: ${r.url}`);
    }

    console.log(`\n── PICANVAS NETWORK REQUESTS (${picanvasRequests.length}) ──`);
    for (const r of picanvasRequests) {
      console.log(`  ${r.method} ${r.status}: ${r.url}`);
    }

    // ── 5. Check the page's webpart manifests ──
    const manifestCheck = await page.evaluate(() => {
      // SPFx stores component manifests in a global
      const win = window as any;
      const manifests: any[] = [];

      // Check __spClientSideComponentManifests
      if (win.__spClientSideComponentManifests) {
        for (const [key, val] of Object.entries(win.__spClientSideComponentManifests)) {
          if (key.toLowerCase().includes('picanvas') || key.includes('6bcd9bfc')) {
            manifests.push({ key, manifest: JSON.stringify(val).substring(0, 500) });
          }
        }
      }

      // Check if SPComponentLoader has our component
      const loaderKeys = Object.keys(win).filter(k =>
        k.includes('SPComponentLoader') || k.includes('spComponentLoader')
      );

      // Check moduleLoaderState
      const moduleLoaderState = win.__moduleLoaderState;
      let picanvasModules: string[] = [];
      if (moduleLoaderState?.loadedModules) {
        picanvasModules = Object.keys(moduleLoaderState.loadedModules)
          .filter(k => k.toLowerCase().includes('picanvas'));
      }

      // Try to find PiCanvas component ID in page data
      const pageData = document.querySelector('#__NEXT_DATA__, script[type="application/json"]');
      let pageDataPiCanvas = false;
      if (pageData) {
        const text = pageData.textContent || '';
        pageDataPiCanvas = text.includes('6bcd9bfc') || text.toLowerCase().includes('picanvas');
      }

      return {
        manifests,
        loaderKeys,
        picanvasModules,
        hasPageDataRef: pageDataPiCanvas,
        globalKeys: Object.keys(win).filter(k => k.toLowerCase().includes('picanvas')).slice(0, 10),
      };
    });

    console.log('\n── MANIFEST / MODULE CHECK ──');
    console.log(`SPFx manifests with PiCanvas: ${manifestCheck.manifests.length}`);
    for (const m of manifestCheck.manifests) {
      console.log(`  ${m.key}: ${m.manifest}`);
    }
    console.log(`PiCanvas loaded modules: ${manifestCheck.picanvasModules.length}`);
    for (const m of manifestCheck.picanvasModules) console.log(`  ${m}`);
    console.log(`Page data references PiCanvas: ${manifestCheck.hasPageDataRef}`);
    console.log(`Global keys with "picanvas": [${manifestCheck.globalKeys.join(', ')}]`);

    // ── 6. Screenshot with DevTools-style overlay ──
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-deep-diag.png'), fullPage: true });

    // Scroll down to see more of the page
    await page.evaluate(() => {
      const scrollEl = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight / 2;
      } else {
        window.scrollTo(0, document.body.scrollHeight / 2);
      }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11-scrolled-down.png'), fullPage: true });

    // Scroll to bottom
    await page.evaluate(() => {
      const scrollEl = document.querySelector('[data-automation-id="contentScrollRegion"]') as HTMLElement;
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      } else {
        window.scrollTo(0, document.body.scrollHeight);
      }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12-bottom.png'), fullPage: true });

    console.log(`\n${'═'.repeat(70)}`);
    console.log('DEEP DIAGNOSTIC COMPLETE');
    console.log(`${'═'.repeat(70)}\n`);
  });
});
