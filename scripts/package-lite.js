#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const configDir = path.join(repoRoot, 'config');

const targets = [
  { live: 'config.json',           lite: 'config-lite.json' },
  { live: 'package-solution.json', lite: 'package-solution-lite.json' }
];

const manifestPatches = [
  {
    file: path.join(repoRoot, 'src', 'webparts', 'piCanvas', 'PiCanvasWebPart.manifest.json'),
    fullId: '6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5',
    liteId: 'a2f32703-6648-4a90-80ed-b84598982d7d'
  },
  {
    file: path.join(repoRoot, 'src', 'extensions', 'piCanvasLoader', 'PiCanvasLoaderApplicationCustomizer.manifest.json'),
    fullId: 'a7f8c3b1-2d4e-5f6a-8b9c-0d1e2f3a4b5c',
    liteId: '77028786-c389-4cc8-b97f-d1084edbfbb8'
  }
];

const backups = [];
const manifestBackups = [];

function restore() {
  for (const b of backups) {
    fs.writeFileSync(b.livePath, b.original);
  }
  for (const m of manifestBackups) {
    fs.writeFileSync(m.file, m.original);
  }
}

process.on('SIGINT',  () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

try {
  for (const t of targets) {
    const livePath = path.join(configDir, t.live);
    const litePath = path.join(configDir, t.lite);
    if (!fs.existsSync(litePath)) {
      throw new Error(`Missing ${litePath}`);
    }
    const original = fs.readFileSync(livePath);
    backups.push({ livePath, original });
    fs.copyFileSync(litePath, livePath);
  }

  for (const p of manifestPatches) {
    const original = fs.readFileSync(p.file);
    manifestBackups.push({ file: p.file, original });
    const patched = original.toString('utf8').replace(p.fullId, p.liteId);
    if (!patched.includes(p.liteId)) {
      throw new Error(`Failed to patch manifest ${p.file} to lite GUID`);
    }
    fs.writeFileSync(p.file, patched);
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'package'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
  } else {
    const sppkg = path.join(repoRoot, 'sharepoint', 'solution', 'pi-canvas-lite.sppkg');
    console.log(`\nLite package built: ${path.relative(repoRoot, sppkg)}`);
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  restore();
}
