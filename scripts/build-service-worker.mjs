#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FIXED_PRECACHE_URLS,
  buildPrecacheUrls,
  computeBuildHash,
  renderServiceWorker,
} from './lib/serviceWorkerManifest.mjs';

/**
 * Generate `dist/sw.js` from `scripts/templates/sw.js`.
 *
 * Runs LAST in the build, after `scripts/prerender-routes.mjs`, because the
 * precache list depends on `dist/spa.html` — which prerendering writes after
 * `vite build` has already finished. A Workbox manifest generated during the
 * vite phase would not see it.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const shellHtmlPath = path.join(distDir, 'spa.html');
const templatePath = path.join(projectRoot, 'scripts', 'templates', 'sw.js');
const outputPath = path.join(distDir, 'sw.js');

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

if (!fs.existsSync(shellHtmlPath)) {
  fail(
    'dist/spa.html not found. The service worker must be generated after '
    + '`node scripts/prerender-routes.mjs`, which writes the SPA shell template.'
  );
}

if (!fs.existsSync(templatePath)) {
  fail('scripts/templates/sw.js not found.');
}

const shellHtml = fs.readFileSync(shellHtmlPath, 'utf8');

let precacheUrls;
try {
  precacheUrls = buildPrecacheUrls(shellHtml);
} catch (error) {
  fail(error.message);
}

// Every precached URL must exist on disk. `cache.addAll` is atomic, so one
// missing file would make the worker fail to install on every visitor's device
// — a failure that is invisible until someone goes offline. Catch it here.
const entries = [];
const missing = [];
for (const url of precacheUrls) {
  const filePath = path.join(distDir, url.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    missing.push(url);
    continue;
  }
  entries.push({ url, contents: fs.readFileSync(filePath) });
}

if (missing.length > 0) {
  fail(
    `These precache URLs do not exist in dist/:\n  ${missing.join('\n  ')}\n`
    + 'Fix the build output or update FIXED_PRECACHE_URLS in '
    + 'scripts/lib/serviceWorkerManifest.mjs.'
  );
}

const buildHash = computeBuildHash(entries);
const template = fs.readFileSync(templatePath, 'utf8');

let rendered;
try {
  rendered = renderServiceWorker(template, { buildHash, precacheUrls });
} catch (error) {
  fail(error.message);
}

fs.writeFileSync(outputPath, rendered, 'utf8');

const totalBytes = entries.reduce((sum, entry) => sum + entry.contents.length, 0);
console.log(
  `Generated dist/sw.js (build ${buildHash}, `
  + `${precacheUrls.length} precached files, ${(totalBytes / 1024).toFixed(0)} KB).`
);

const derivedCount = precacheUrls.length - FIXED_PRECACHE_URLS.length;
console.log(`  ${FIXED_PRECACHE_URLS.length} fixed + ${derivedCount} derived from dist/spa.html`);
