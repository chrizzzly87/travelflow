import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import { generate } from 'critical';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

const ROUTES = [
  { path: '/', dest: 'index.html' },
  { path: '/features', dest: 'features/index.html' },
  { path: '/pricing', dest: 'pricing/index.html' },
  { path: '/faq', dest: 'faq/index.html' },
  { path: '/updates', dest: 'updates/index.html' },
  { path: '/blog', dest: 'blog/index.html' },
  { path: '/login', dest: 'login/index.html' },
  { path: '/inspirations', dest: 'inspirations/index.html' },
  
  // Localized routes
  { path: '/es', dest: 'es/index.html' },
  { path: '/es/features', dest: 'es/features/index.html' },
  { path: '/es/pricing', dest: 'es/pricing/index.html' },
  { path: '/es/faq', dest: 'es/faq/index.html' },
  { path: '/es/inspirations', dest: 'es/inspirations/index.html' },
  
  { path: '/de', dest: 'de/index.html' },
  { path: '/de/features', dest: 'de/features/index.html' },
  { path: '/de/pricing', dest: 'de/pricing/index.html' },
  { path: '/de/faq', dest: 'de/faq/index.html' },
  { path: '/de/inspirations', dest: 'de/inspirations/index.html' },
  
  { path: '/fr', dest: 'fr/index.html' },
  { path: '/fr/features', dest: 'fr/features/index.html' },
  { path: '/fr/pricing', dest: 'fr/pricing/index.html' },
  { path: '/fr/faq', dest: 'fr/faq/index.html' },
  { path: '/fr/inspirations', dest: 'fr/inspirations/index.html' },
  
  { path: '/pt', dest: 'pt/index.html' },
  { path: '/ru', dest: 'ru/index.html' },
  { path: '/it', dest: 'it/index.html' },
  { path: '/pl', dest: 'pl/index.html' },
  { path: '/ko', dest: 'ko/index.html' },
  { path: '/fa', dest: 'fa/index.html' },
  { path: '/ur', dest: 'ur/index.html' }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  // First, inline critical CSS in the base template
  try {
    await inlineCriticalCss();
  } catch (err) {
    console.error('Critical CSS generation error:', err);
  }

  console.log('Starting preview server for pre-rendering...');
  
  const serverProcess = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT)], {
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
  const browser = await chromium.launch({ headless: true });
  const baseHtmlTemplate = fs.readFileSync(path.join(projectRoot, 'dist', 'index.html'), 'utf8');

  for (const route of ROUTES) {
    console.log(`Pre-rendering route: ${route.path} -> dist/${route.dest}`);
    
    try {
      const page = await browser.newPage();
      // Set a tall viewport size to ensure below-the-fold elements are intersected, loaded and rendered fully
      await page.setViewportSize({ width: 1280, height: 9999 });
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded' });

      // Wait for the React handoff to complete and mark the route ready
      await page.waitForSelector('[data-tf-handoff-ready="true"]', { timeout: 10000 });
      
      // Wait another short frame to ensure any micro-animations or layout settles
      await sleep(100);

      // Extract root HTML and HTML document attributes
      const rootHtml = await page.locator('#root').innerHTML();
      const lang = await page.evaluate(() => document.documentElement.lang);
      const dir = await page.evaluate(() => document.documentElement.dir);

      await page.close();

      // Inject root HTML, lang, and dir into the base index.html template
      let outputHtml = baseHtmlTemplate
        .replace('<div id="root"></div>', `<div id="root">${rootHtml}</div>`)
        .replace('<html lang="en">', `<html lang="${lang || 'en'}" dir="${dir || 'ltr'}">`);

      const destPath = path.join(projectRoot, 'dist', route.dest);
      const destDir = path.dirname(destPath);
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.writeFileSync(destPath, outputHtml, 'utf8');
      console.log(`Successfully pre-rendered dist/${route.dest}`);
    } catch (err) {
      console.error(`Error pre-rendering route ${route.path}:`, err.message);
    }
  }

  console.log('Pre-rendering complete! Closing browser and server...');
  await browser.close();
  cleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed pre-rendering process:', err);
  process.exit(1);
});
