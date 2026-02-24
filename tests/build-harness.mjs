/**
 * Bundles the test harness entry point into a single JS file for Playwright.
 * Run: node tests/build-harness.mjs
 */
import { build } from 'esbuild';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, 'harness-entry.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/harness.js'),
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
});

console.log('✓ Test harness built → tests/dist/harness.js');
