#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('child_process');

const SITE = process.env.SITE || 'https://sap.sharepoint.com/sites/213644';
const OLD_ID = (process.env.OLD_ID || '6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5').toLowerCase();
const NEW_ID = (process.env.NEW_ID || 'a2f32703-6648-4a90-80ed-b84598982d7d').toLowerCase();
const PAGES = (process.env.PAGES || 'Copilot-Studio-Guide.aspx,CS-Strategy-Dashboard-2026.aspx,Github-demo.aspx').split(',');

function token() {
  return execSync('m365 util accesstoken get --resource https://sap.sharepoint.com --output text', {
    encoding: 'utf8'
  }).trim();
}

async function req(method, url, accessToken, body) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json;odata=nometadata'
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json;odata=nometadata';
    headers['IF-MATCH'] = '*';
    headers['X-HTTP-Method'] = 'MERGE';
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  if (!res.ok && res.status !== 204) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return text;
}

function caseInsensitiveReplaceAll(text, search, replace) {
  const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return text.replace(re, replace);
}

(async function main() {
  const accessToken = token();
  console.log(`Site: ${SITE}`);
  console.log(`Replacing componentId ${OLD_ID} -> ${NEW_ID}\n`);

  for (const raw of PAGES) {
    const page = raw.trim();
    console.log(`=== ${page} ===`);
    try {
      const filter = encodeURIComponent(`FileLeafRef eq '${page}'`);
      const listPath = `lists/getbytitle('Site Pages')`;
      const getUrl = `${SITE}/_api/web/${listPath}/items?$filter=${filter}&$select=Id,FileLeafRef,CanvasContent1`;
      const getRes = await req('GET', getUrl, accessToken);
      const parsed = JSON.parse(getRes);
      const items = parsed.value || [];
      if (!items.length) {
        console.log('  ! page not found');
        continue;
      }
      const item = items[0];
      const canvas = item.CanvasContent1 || '';
      const occurrences = (canvas.match(new RegExp(OLD_ID, 'gi')) || []).length;
      console.log(`  item id=${item.Id}, ${occurrences} matches`);
      if (occurrences === 0) {
        console.log('  - nothing to do');
        continue;
      }
      const updated = caseInsensitiveReplaceAll(canvas, OLD_ID, NEW_ID);

      const patchUrl = `${SITE}/_api/web/${listPath}/items(${item.Id})`;
      const body = JSON.stringify({ CanvasContent1: updated });
      const patchRes = await req('PATCH', patchUrl, accessToken, body);
      console.log('  patched OK', patchRes ? `(response: ${patchRes.slice(0,120)})` : '');
    } catch (e) {
      console.log('  ! error:', e.message);
    }
  }
  console.log('\nDone. Hard-refresh the pages.');
})();
