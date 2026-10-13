import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const label = process.argv.find((arg) => arg.startsWith('--label='))?.slice(8) || 'current';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple label');
const runs = Number(process.argv.find((arg) => arg.startsWith('--runs='))?.slice(7) || 5);
if (!Number.isInteger(runs) || runs < 1) throw new Error('runs must be a positive integer');
const baseURL = 'http://127.0.0.1:4185';
const distRoot = process.env.RUNTIME_DIST_DIR || 'dist';
const routes = ['/', '/features', '/pricing', '/create-trip', '/create-trip/wizard', '/example/thailand-islands'];
const server = spawn(process.execPath, ['scripts/serve-built-site.mjs'], {
  env: { ...process.env, PORT: '4185' }, stdio: ['ignore', 'pipe', 'pipe'],
});
// Wait for our own process to listen; an old server on the same port must fail
// the comparison rather than silently supply assets from a different build.
const serverReady = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Built-site server did not start')), 10_000);
  server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
  server.once('error', (error) => { clearTimeout(timer); reject(error); });
  server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Built-site server exited (${code})`)); });
});
let browser;
const results = [];
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

try {
  await serverReady;
  browser = await chromium.launch();
  for (const route of routes) {
    const samples = [];
    // One discarded warmup makes server compression/image caches equivalent.
    for (let run = -1; run < runs; run++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await context.route('**/*', (request) => new URL(request.request().url()).origin === baseURL
        ? request.continue() : request.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const session = await context.newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await session.send('Network.enable');
      await session.send('Network.emulateNetworkConditions', {
        offline: false, latency: 40, downloadThroughput: 500_000, uploadThroughput: 250_000,
      });
      await page.addInitScript(() => {
        window.__runtimeMetrics = { lcp: null, cls: 0, blocking: 0 };
        for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask']) {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (type === 'largest-contentful-paint') window.__runtimeMetrics.lcp = entry.startTime;
              if (type === 'layout-shift' && !entry.hadRecentInput) window.__runtimeMetrics.cls += entry.value;
              if (type === 'longtask') window.__runtimeMetrics.blocking += Math.max(0, entry.duration - 50);
            }
          }).observe({ type, buffered: true });
        }
      });
      await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      if (route.startsWith('/example/')) await page.getByTestId('trip-header-menu').waitFor();
      else if (route === '/create-trip') await page.getByPlaceholder('Search country or island').waitFor();
      else if (route === '/create-trip/wizard') await page.getByRole('heading', { name: 'What do you already know about this trip?' }).waitFor();
      else await page.waitForFunction(() => window.__TF_BOOT__?.sealed === true);
      const readyMs = await page.evaluate(() => performance.now());
      await page.waitForTimeout(1500);
      const metrics = await page.evaluate(() => ({
        ...window.__runtimeMetrics,
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        domContentLoaded: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
        scripts: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\/assets\/.*\.js$/.test(name)),
      }));
      const scripts = [...new Set(metrics.scripts)].map((url) => new URL(url).pathname);
      let jsRawBytes = 0;
      let jsGzipBytes = 0;
      for (const script of scripts) {
        const bytes = await fs.readFile(path.join(distRoot, script));
        jsRawBytes += bytes.length;
        jsGzipBytes += gzipSync(bytes).length;
      }
      delete metrics.scripts;
      const sample = { ...metrics, readyMs, jsRawBytes, jsGzipBytes, errors };
      if (errors.length) throw new Error(`${route}: ${errors.join('; ')}`);
      if (run >= 0) samples.push(sample);
      await context.close();
    }
    const summary = Object.fromEntries(['fcp', 'lcp', 'cls', 'blocking', 'readyMs', 'jsRawBytes', 'jsGzipBytes']
      .map((key) => [key, median(samples.map((sample) => sample[key]))]));
    results.push({ route, median: summary, samples });
    console.log(`${route}: ready ${Math.round(summary.readyMs)}ms, LCP ${Math.round(summary.lcp)}ms, JS gzip ${summary.jsGzipBytes}B`);
  }
  const sourceRoot = process.env.RUNTIME_SOURCE_DIR || process.cwd();
  const packageJson = JSON.parse(await fs.readFile(path.join(sourceRoot, 'package.json'), 'utf8'));
  const report = {
    label, revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(),
    sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: sourceRoot, encoding: 'utf8' }).trim()),
    preact: packageJson.dependencies.preact, browser: browser.version(), node: process.version,
    settings: { runs, viewport: '390x844', cpuSlowdown: 4, latencyMs: 40, downloadBytesPerSecond: 500_000, settleMs: 1500, externalNetwork: 'blocked', serviceWorkers: 'blocked' },
    results,
  };
  await fs.mkdir('perf/runtime', { recursive: true });
  await fs.writeFile(`perf/runtime/${label}.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser?.close();
  server.kill();
}
