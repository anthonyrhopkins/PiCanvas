#!/usr/bin/env node
/**
 * patch-react-version.js
 *
 * Patches the built .sppkg to reference React 17.0.1 instead of 17.0.2.
 *
 * SPFx 1.22 SDK builds against React 17.0.2, but some SharePoint tenants
 * (especially developer tenants) only provide React 17.0.1 in their runtime.
 * The SPFx module loader does exact version matching, causing a load failure.
 *
 * This script unzips the sppkg, patches all 17.0.2 → 17.0.1 references,
 * and re-zips it. Run AFTER `heft package-solution`.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SPPKG_PATH = path.join(__dirname, '..', 'sharepoint', 'solution', 'pi-canvas.sppkg');
const TEMP_DIR = path.join(__dirname, '..', 'sharepoint', 'solution', '_patch_temp');

if (!fs.existsSync(SPPKG_PATH)) {
  console.error('[patch-react] sppkg not found at:', SPPKG_PATH);
  process.exit(1);
}

console.log('[patch-react] Patching sppkg: React 17.0.2 → 17.0.1');

// Clean temp dir
if (fs.existsSync(TEMP_DIR)) {
  fs.rmSync(TEMP_DIR, { recursive: true });
}
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Unzip
execSync(`unzip -o "${SPPKG_PATH}" -d "${TEMP_DIR}"`, { stdio: 'pipe' });

// Patch all files
let patchCount = 0;
patchDirRecursive(TEMP_DIR);

if (patchCount === 0) {
  console.log('[patch-react] No React 17.0.2 references found in sppkg');
} else {
  console.log(`[patch-react] Patched ${patchCount} file(s) inside sppkg`);

  // Re-zip (delete old sppkg first)
  fs.unlinkSync(SPPKG_PATH);

  // Create new zip from temp dir
  execSync(`cd "${TEMP_DIR}" && zip -r "${SPPKG_PATH}" .`, { stdio: 'pipe' });
  console.log('[patch-react] Rebuilt sppkg successfully');
}

// Clean up
fs.rmSync(TEMP_DIR, { recursive: true });

function patchDirRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      patchDirRecursive(fullPath);
    } else {
      patchFile(fullPath);
    }
  }
}

function patchFile(filePath) {
  // Only patch text-like files
  const ext = path.extname(filePath).toLowerCase();
  if (!['.xml', '.json', '.js', '.txt', '.rels'].includes(ext)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('17.0.2')) {
    content = content.replace(/17\.0\.2/g, '17.0.1');
    fs.writeFileSync(filePath, content, 'utf8');
    patchCount++;
    const rel = path.relative(TEMP_DIR, filePath);
    console.log(`  Patched: ${rel}`);
  }
}
