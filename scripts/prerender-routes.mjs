import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { generate } from 'critical';
import {
  collectModulePreloadHrefs,
  injectModulePreloadHints,
  stripBootstrapShell,
} from './prerender-html-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

const ROUTES = [
  { path: '/', dest: 'index.html' },
  { path: '/features', dests: ['features.html', 'features/index.html'] },
  { path: '/pricing', dests: ['pricing.html', 'pricing/index.html'] },
  { path: '/faq', dests: ['faq.html', 'faq/index.html'] },
  { path: '/updates', dests: ['updates.html', 'updates/index.html'] },
  { path: '/blog', dests: ['blog.html', 'blog/index.html'] },
  { path: '/inspirations', dests: ['inspirations.html', 'inspirations/index.html'] },
  
  // Localized routes
  { path: '/es', dests: ['es.html', 'es/index.html'] },
  { path: '/es/features', dests: ['es/features.html', 'es/features/index.html'] },
  { path: '/es/pricing', dests: ['es/pricing.html', 'es/pricing/index.html'] },
  { path: '/es/faq', dests: ['es/faq.html', 'es/faq/index.html'] },
  { path: '/es/inspirations', dests: ['es/inspirations.html', 'es/inspirations/index.html'] },
  
  { path: '/de', dests: ['de.html', 'de/index.html'] },
  { path: '/de/features', dests: ['de/features.html', 'de/features/index.html'] },
  { path: '/de/pricing', dests: ['de/pricing.html', 'de/pricing/index.html'] },
  { path: '/de/faq', dests: ['de/faq.html', 'de/faq/index.html'] },
  { path: '/de/inspirations', dests: ['de/inspirations.html', 'de/inspirations/index.html'] },
  
  { path: '/fr', dests: ['fr.html', 'fr/index.html'] },
  { path: '/fr/features', dests: ['fr/features.html', 'fr/features/index.html'] },
  { path: '/fr/pricing', dests: ['fr/pricing.html', 'fr/pricing/index.html'] },
  { path: '/fr/faq', dests: ['fr/faq.html', 'fr/faq/index.html'] },
  { path: '/fr/inspirations', dests: ['fr/inspirations.html', 'fr/inspirations/index.html'] },
  
  { path: '/pt', dests: ['pt.html', 'pt/index.html'] },
  { path: '/ru', dests: ['ru.html', 'ru/index.html'] },
  { path: '/it', dests: ['it.html', 'it/index.html'] },
  { path: '/pl', dests: ['pl.html', 'pl/index.html'] },
  { path: '/ko', dests: ['ko.html', 'ko/index.html'] },
  { path: '/fa', dests: ['fa.html', 'fa/index.html'] },
  { path: '/ur', dests: ['ur.html', 'ur/index.html'] }
];

// Destination guide country pages are data-driven, so they never appear in the
// static route table above. Each prerendered route costs roughly 2-3s of build
// time, so we prerender the highest-priority country guides plus the newest
// additions instead of all 52 — the rest still render client-side and receive
// canonical/OG metadata from the site OG edge function.
const PRERENDERED_COUNTRY_GUIDE_LIMIT = 10;
const ALWAYS_PRERENDERED_COUNTRY_SLUGS = ['china', 'taiwan'];

function readCountryGuideRoutes() {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, 'data', 'destinationGuides.json'), 'utf8');
    const guides = JSON.parse(raw)?.guides;
    if (!Array.isArray(guides)) return [];

    const countries = guides
      .filter((guide) => guide?.kind === 'country' && guide.slug)
      .sort((left, right) => (left.priorityRank || Number.MAX_SAFE_INTEGER) - (right.priorityRank || Number.MAX_SAFE_INTEGER));

    const slugs = new Set(countries.slice(0, PRERENDERED_COUNTRY_GUIDE_LIMIT).map((guide) => guide.slug));
    for (const slug of ALWAYS_PRERENDERED_COUNTRY_SLUGS) {
      if (countries.some((guide) => guide.slug === slug)) slugs.add(slug);
    }

    return Array.from(slugs).map((slug) => ({
      path: `/inspirations/country/${slug}`,
      dests: [
        `inspirations/country/${slug}.html`,
        `inspirations/country/${slug}/index.html`,
      ],
    }));
  } catch (err) {
    console.warn('WARNING: Could not derive destination guide prerender routes.', err.message);
    return [];
  }
}

ROUTES.push(...readCountryGuideRoutes());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensurePlaywrightChromiumInstalled() {
  const executablePath = chromium.executablePath();
  if (fs.existsSync(executablePath)) {
    return;
  }

  console.log('Playwright Chromium executable is missing. Installing Chromium browser binary...');
  const result = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to install Playwright Chromium browser binary (exit ${result.status ?? 'unknown'}).`);
  }
}

async function inlineCriticalCss() {
  console.log('Generating critical CSS...');
  const distDir = path.join(projectRoot, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`index.html not found at ${indexHtmlPath}`);
  }

  const originalHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Prepare temporary file with relative paths for critical resolver
  let tempHtml = originalHtml.replace(/href="\/assets\//g, 'href="assets/');
  tempHtml = tempHtml.replace(/src="\/assets\//g, 'src="assets/');
  
  const tempHtmlPath = path.join(distDir, 'index-temp-critical.html');
  fs.writeFileSync(tempHtmlPath, tempHtml, 'utf8');

  try {
    // Set standard path for Chrome on macOS if not already set, to make local runs seamless
    if (process.platform === 'darwin' && !process.env.PUPPETEER_EXECUTABLE_PATH) {
      const standardChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      if (fs.existsSync(standardChromePath)) {
        process.env.PUPPETEER_EXECUTABLE_PATH = standardChromePath;
      }
    }

    await generate({
      inline: true,
      extract: false, // Keep original stylesheet, just preload/defer it
      base: distDir,
      src: 'index-temp-critical.html',
      target: {
        html: 'index.html', // Overwrite the main index.html with the inlined version
      },
      width: 1300,
      height: 900,
    });

    console.log('Successfully generated critical CSS in dist/index.html');

    // Read generated file and convert asset paths back to absolute
    let finalHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    finalHtml = finalHtml.replace(/href="assets\//g, 'href="/assets/');
    finalHtml = finalHtml.replace(/src="assets\//g, 'src="/assets/');
    fs.writeFileSync(indexHtmlPath, finalHtml, 'utf8');
    
  } catch (err) {
    console.warn('WARNING: Failed to generate critical CSS. Falling back to original build template.', err.message);
    // Restore original HTML
    fs.writeFileSync(indexHtmlPath, originalHtml, 'utf8');
  } finally {
    // Clean up temporary file if it exists
    if (fs.existsSync(tempHtmlPath)) {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (e) {}
    }
  }
}

async function main() {
  // Build output directory, used by the image-CDN proxy and the modulepreload
  // hint existence check below. (Previously only defined inside
  // inlineCriticalCss(), so these references silently threw at runtime.)
  const distDir = path.join(projectRoot, 'dist');

  if (process.env.TF_INLINE_CRITICAL_CSS === '1') {
    try {
      await inlineCriticalCss();
    } catch (err) {
      console.error('Critical CSS generation error:', err);
    }
  } else {
    console.log('Skipping critical CSS inlining; set TF_INLINE_CRITICAL_CSS=1 to evaluate it locally.');
  }

  console.log('Starting preview server for pre-rendering...');

  // Abort if something is already listening on our port. Without this a stray
  // `vite preview` (e.g. left over from manual testing) keeps the port and our
  // own `vite preview` silently starts on a different one — we would then
  // prerender against the STALE server's dist, shipping HTML + modulepreload
  // hints that reference chunk hashes which no longer exist in the deployed
  // assets (every chunk then falls through to the SPA fallback as text/html,
  // MIME-errors, and hydration dies). Fail loudly instead.
  const portAlreadyInUse = await new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
    req.end();
  });
  if (portAlreadyInUse) {
    console.error(`Port ${PORT} is already in use. Refusing to prerender against a foreign server (would ship stale asset hashes). Stop the other process and retry.`);
    process.exit(1);
  }

  // --strictPort so our preview owns the port or fails outright — never
  // silently starts elsewhere while we poll the wrong server.
  const serverProcess = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: projectRoot,
    stdio: 'ignore',
    detached: true
  });
  
  // Ensure we kill the child process group on exit
  const cleanup = () => {
    try {
      process.kill(-serverProcess.pid);
    } catch (e) {
      try {
        serverProcess.kill();
      } catch (err) {}
    }
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
    process.exit(1);
  });

  // Wait for the preview server to respond
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${BASE_URL}/`, (res) => {
          if (res.statusCode === 200) {
            ready = true;
            resolve();
          } else {
            reject(new Error(`Status code: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(500);
        req.end();
      });
      if (ready) break;
    } catch (e) {
      await sleep(200);
    }
  }

  if (!ready) {
    console.error('Failed to start preview server or server not responding.');
    cleanup();
    process.exit(1);
  }

  console.log('Preview server is ready. Launching headless browser...');
  ensurePlaywrightChromiumInstalled();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  // dist/index.html gets overwritten with the prerendered homepage below, so a
  // re-run against a stale dist would silently prerender from prerendered
  // output. Recover the clean template from dist/spa.html when possible.
  let baseHtmlTemplate = fs.readFileSync(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  if (baseHtmlTemplate.includes('data-tf-prerendered-root')) {
    const spaHtmlPath = path.join(projectRoot, 'dist', 'spa.html');
    const spaHtml = fs.existsSync(spaHtmlPath) ? fs.readFileSync(spaHtmlPath, 'utf8') : '';
    if (!spaHtml || spaHtml.includes('data-tf-prerendered-root')) {
      throw new Error('dist/index.html is already prerendered and no clean dist/spa.html template exists. Run `vite build` first.');
    }
    console.warn('dist/index.html is already prerendered; using dist/spa.html as the template.');
    baseHtmlTemplate = spaHtml;
  }

  // Preserve the untouched SPA template BEFORE the loop overwrites dist/index.html
  // with the prerendered homepage. The host catch-all rewrite (netlify.toml /
  // vercel.json) points non-prerendered URLs at /spa.html so deep links boot the
  // clean shell instead of flashing homepage markup and tearing down hydration.
  fs.writeFileSync(path.join(projectRoot, 'dist', 'spa.html'), baseHtmlTemplate, 'utf8');
  console.log('Saved SPA fallback template to dist/spa.html');

  // Warm sharp's native pipeline once so the first intercepted image request
  // isn't served late (a cold-start stall raced the capture and left the first
  // route's cards in their error-fallback state).
  try { await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).avif().toBuffer(); } catch { /* ignore */ }

  let failedRoutes = 0;

  for (const route of ROUTES) {
    const dests = route.dests || [route.dest];
    console.log(`Pre-rendering route: ${route.path} -> ${dests.map((dest) => `dist/${dest}`).join(', ')}`);
    
    try {
      const page = await browser.newPage();

      // Emulate the production image-CDN endpoint (/.netlify/images?url=...)
      // during prerender. The preview server does not implement it, so without
      // this the card <img>s fail to load, ProgressiveImage fires onError, and
      // the cards get captured in their no-image fallback state — shipping
      // image-less, blurhash-less cards to production until hydration
      // re-renders. We must honour the requested format (fm=avif|webp|...): the
      // <picture> avif <source> requires real AVIF bytes, otherwise the browser
      // fails to decode and still fires onError. sharp reproduces exactly what
      // Netlify's CDN returns (resize + re-encode), so the requested URL stays
      // identical and the prerendered markup matches the client hydration render.
      await page.route('**/.netlify/images**', async (routeReq) => {
        try {
          const params = new URL(routeReq.request().url()).searchParams;
          const source = params.get('url') || '';
          const relPath = source.replace(/^\/+/, '').split('?')[0];
          const filePath = path.join(distDir, relPath);
          if (!relPath || !filePath.startsWith(distDir) || !fs.existsSync(filePath)) {
            return routeReq.continue();
          }
          const width = Number.parseInt(params.get('w') || '', 10) || undefined;
          const height = Number.parseInt(params.get('h') || '', 10) || undefined;
          const quality = Number.parseInt(params.get('q') || '', 10) || undefined;
          const fm = (params.get('fm') || '').toLowerCase();
          let pipeline = sharp(fs.readFileSync(filePath));
          if (width || height) pipeline = pipeline.resize({ width, height, fit: 'cover', withoutEnlargement: true });
          let contentType;
          if (fm === 'avif') { pipeline = pipeline.avif({ quality: quality || 50 }); contentType = 'image/avif'; }
          else if (fm === 'jpeg' || fm === 'jpg') { pipeline = pipeline.jpeg({ quality: quality || 72 }); contentType = 'image/jpeg'; }
          else if (fm === 'png') { pipeline = pipeline.png(); contentType = 'image/png'; }
          else { pipeline = pipeline.webp({ quality: quality || 66 }); contentType = 'image/webp'; }
          return routeReq.fulfill({ status: 200, contentType, body: await pipeline.toBuffer() });
        } catch {
          return routeReq.continue();
        }
      });

      // Keep prerendering to the first viewport so deferred sections do not hydrate
      // from full markup into client-side placeholders and trigger mobile CLS.
      await page.setViewportSize({ width: 1280, height: 640 });

      // Record the JS module URLs (incl. locale JSON chunks, which Vite builds
      // as JS modules) this route actually fetches before it becomes
      // interactive. They become per-route <link rel="modulepreload"> hints so
      // the browser fetches the whole graph in parallel instead of walking the
      // 3-5 hop import waterfall (global modulePreload stays off on purpose —
      // see vite.config.ts).
      const requestedAssetUrls = [];
      let collectAssetRequests = true;
      page.on('request', (request) => {
        if (!collectAssetRequests) return;
        requestedAssetUrls.push(request.url());
      });

      // Mark the capture as a prerendered render so image cards render their
      // <picture> + blurhash regardless of a transient image hiccup during
      // capture, matching the client's first hydration render (which detects
      // the data-tf-prerendered-root attribute). Below-fold sections stay
      // IntersectionObserver-gated on both sides, so they are not forced here.
      await page.addInitScript(() => { window.__TF_PRERENDER_EAGER__ = true; });

      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded' });

      // Wait for the React handoff to complete and mark the route ready
      await page.waitForSelector('[data-tf-handoff-ready="true"]', { timeout: 10000 });
      // Everything requested after the handoff is post-interaction warmup; the
      // preload hints should only cover what boot actually needed.
      collectAssetRequests = false;

      const errorBoundaryText = await page.locator('[data-tf-error-boundary="true"]').textContent({ timeout: 250 }).catch(() => null);
      if (errorBoundaryText) {
        throw new Error(`React error boundary rendered during prerender: ${errorBoundaryText.slice(0, 240)}`);
      }

      // Wait for the images that are actually in the DOM to finish loading so
      // cards are captured in their loaded state, not the transient
      // placeholder/error state ProgressiveImage shows mid-flight. We do NOT
      // force-scroll every below-fold image at once — that floods the on-the-fly
      // image transform and makes cards that swap to a fallback on error (blog,
      // inspirations) capture as fallbacks. Below-fold lazy images stay in the
      // markup as <picture> elements and load from the real CDN on the live site.
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.evaluate(async () => {
        const imgs = Array.from(document.images);
        await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 4000);
        }))));
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch { /* ignore */ } }
      }).catch(() => {});

      // Final short frame so any post-load layout/micro-animations settle.
      await sleep(100);

      // Extract root HTML and HTML document attributes
      const rootHtml = await page.locator('#root').innerHTML();
      const lang = await page.evaluate(() => document.documentElement.lang);
      const dir = await page.evaluate(() => document.documentElement.dir);

      await page.close();

      // Inject root HTML, lang, and dir into the base index.html template
      let outputHtml = baseHtmlTemplate
        .replace('<div id="root"></div>', `<div id="root" data-tf-prerendered-root="true">${rootHtml}</div>`)
        .replace('<html lang="en">', `<html lang="${lang || 'en'}" dir="${dir || 'ltr'}">`);

      // Strip the boot shell: prerendered pages ship real content in #root, so
      // the shell would be hidden on first paint anyway (index.tsx's
      // setupBootstrapShellHandoff early-returns when the element is absent).
      const stripResult = stripBootstrapShell(outputHtml);
      outputHtml = stripResult.html;
      // Note: the boot-shell <style> is intentionally KEPT (the runtime
      // navigation shell reuses those classes — see stripBootstrapShell), so we
      // only assert the shell markup + hide-script were removed.
      if (!stripResult.removedShell || !stripResult.removedScript) {
        console.warn(
          `WARNING: boot shell strip incomplete for ${route.path} ` +
          `(shell: ${stripResult.removedShell}, script: ${stripResult.removedScript})`
        );
      }

      // Inject per-route modulepreload hints (entry-first request order).
      // Defense in depth: only hint chunks that actually exist in this build's
      // dist/assets. A hint to a missing hash resolves to the SPA-fallback HTML
      // (text/html), which the browser rejects as a module — so a stale hint
      // would silently break hydration. Dropping unknown hrefs guarantees we
      // never ship one, even if hint collection ever races the build again.
      const allPreloadHrefs = collectModulePreloadHrefs(requestedAssetUrls);
      const preloadHrefs = allPreloadHrefs.filter((href) => fs.existsSync(path.join(distDir, href.replace(/^\/+/, ''))));
      const droppedHints = allPreloadHrefs.length - preloadHrefs.length;
      if (droppedHints > 0) {
        console.warn(`WARNING: dropped ${droppedHints} modulepreload hint(s) for ${route.path} that do not exist in dist/assets (stale build?).`);
      }
      outputHtml = injectModulePreloadHints(outputHtml, preloadHrefs);
      console.log(`Injected ${preloadHrefs.length} modulepreload hints for ${route.path}`);

      for (const dest of dests) {
        const destPath = path.join(projectRoot, 'dist', dest);
        const destDir = path.dirname(destPath);
        
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        fs.writeFileSync(destPath, outputHtml, 'utf8');
        console.log(`Successfully pre-rendered dist/${dest}`);
      }
    } catch (err) {
      failedRoutes += 1;
      console.error(`Error pre-rendering route ${route.path}:`, err.message);
    }
  }

  console.log('Pre-rendering complete! Closing browser and server...');
  await browser.close();
  cleanup();

  // Final safety gate: no prerendered page may reference a JS asset that does
  // not exist in this build. A dangling /assets/*.js reference is served the
  // SPA-fallback HTML (text/html), rejected as a module, and silently breaks
  // hydration on production — the exact failure this guard exists to catch.
  let danglingRefs = 0;
  const assetRefPattern = /(?:href|src)="(\/assets\/[^"']+\.js)"/g;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = fs.readFileSync(full, 'utf8');
      for (const match of html.matchAll(assetRefPattern)) {
        const ref = match[1];
        if (!fs.existsSync(path.join(distDir, ref.replace(/^\/+/, '')))) {
          danglingRefs += 1;
          console.error(`DANGLING ASSET REF in ${path.relative(distDir, full)}: ${ref}`);
        }
      }
    }
  };
  walk(distDir);
  if (danglingRefs > 0) {
    console.error(`\nAborting: ${danglingRefs} prerendered asset reference(s) point to files missing from this build.`);
    process.exit(1);
  }

  process.exit(failedRoutes > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Failed pre-rendering process:', err);
  process.exit(1);
});
