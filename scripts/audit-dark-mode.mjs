/**
 * Dark-mode audit: crawls the built app in dark mode and reports surfaces that
 * are still light and text that fails WCAG AA against its own backdrop.
 *
 * Why this exists: dark mode was retrofitted across ~250 components, and every
 * manual pass missed a different CLASS of case — arbitrary variant prefixes
 * (supports-[...], [&_h1]), gradient stops (from-white), tinted callouts,
 * Tailwind Typography's own colours, and whole directories that a grep glob
 * never covered. Eyeballing pages does not find those; this does.
 *
 * Run against a built + prerendered app:
 *   npx vite build && node scripts/prerender-routes.mjs
 *   npx vite preview --port 4201 --strictPort &
 *   node scripts/audit-dark-mode.mjs
 *
 * Note the luminance function below linearises each channel before weighting.
 * An earlier version did not, which inflated dark colours enough to report a
 * 6.5:1 button as a 2.99 failure. A broken checker is worse than no checker.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.TF_AUDIT_BASE || 'http://localhost:4201';
const ROUTES = [
  '/', '/features', '/inspirations', '/inspirations/countries', '/inspirations/themes',
  '/inspirations/festivals', '/inspirations/weekend-getaways', '/inspirations/best-time-to-travel',
  '/blog', '/updates', '/pricing', '/faq', '/contact',
  '/imprint', '/privacy', '/terms', '/cookies',
  '/login', '/create-trip', '/profile', '/profile/settings', '/trips', '/404-does-not-exist',
];

const AUDIT = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const lum = (c) => {
    if (!c || c === 'transparent') return null;
    cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0,0,1,1);
    const d = cx.getImageData(0,0,1,1).data;
    if (d[3] < 90) return null;
    // WCAG relative luminance needs each channel converted from sRGB to LINEAR
    // light first. Weighting the raw bytes (as this did) inflates dark colours
    // badly — indigo-600 read as 0.30 instead of 0.11, turning a 6.5:1 button
    // into a reported 2.99 failure.
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055) ** 2.4; };
    return 0.2126*lin(d[0]) + 0.7152*lin(d[1]) + 0.0722*lin(d[2]);
  };
  const ratio = (a,b) => { const [x,y] = [a,b].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };
  const light = [], lowText = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.height < 24) continue;
    const L = lum(cs.backgroundColor);
    // A large light fill on a dark page.
    if (L !== null && L > 0.55) {
      light.push({ cls: (el.className||'').toString().slice(0,110), bg: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height) });
    }
    // ...and the same in a gradient. backgroundColor stays transparent when the
    // fill is a gradient, so a backgroundColor-only check misses these entirely
    // — which is how a full-page white radial wash on /create-trip survived a
    // clean audit run. Sample the colour stops out of backgroundImage instead.
    const bgImage = cs.backgroundImage;
    if (bgImage && bgImage !== 'none' && /gradient/.test(bgImage)) {
      const stops = bgImage.match(/(?:rgba?|oklch|oklab|color)\([^)]*\)|#[0-9a-fA-F]{3,8}/g) || [];
      const lightStops = stops.map(lum).filter((x) => x !== null && x > 0.55);
      if (lightStops.length) {
        light.push({ cls: (el.className||'').toString().slice(0,110), bg: `gradient(${lightStops.length} light stops)`, w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    // Leaf text nodes whose colour barely separates from their backdrop.
    if (el.children.length === 0) {
      const txt = (el.textContent||'').trim();
      if (!txt) continue;
      const tc = lum(cs.color);
      let node = el, bgL = null;
      while (node && bgL === null) { bgL = lum(getComputedStyle(node).backgroundColor); node = node.parentElement; }
      if (tc !== null && bgL !== null && ratio(tc,bgL) < 4.5) {
        lowText.push({ txt: txt.slice(0,34), ratio: +ratio(tc,bgL).toFixed(2), cls: (el.className||'').toString().slice(0,100) });
      }
    }
  }
  const dedupe = (arr, key) => { const m = new Map(); for (const x of arr) if (!m.has(x[key])) m.set(x[key], x); return [...m.values()]; };
  return { light: dedupe(light,'cls').slice(0,6), lowText: dedupe(lowText,'cls').slice(0,6),
           counts: { light: light.length, lowText: lowText.length } };
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.addInitScript(() => { try { localStorage.setItem('tf_theme_preference_v1','dark'); } catch {} });
const report = [];
for (const route of ROUTES) {
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(1200);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const res = await page.evaluate(AUDIT);
    report.push({ route, isDark, ...res });
  } catch (e) {
    report.push({ route, error: String(e).split('\n')[0].slice(0,90) });
  }
}
await browser.close();

let totalL = 0, totalT = 0;
for (const r of report) {
  if (r.error) { console.log(`\n${r.route.padEnd(34)} ERROR ${r.error}`); continue; }
  totalL += r.counts.light; totalT += r.counts.lowText;
  const flag = (r.counts.light || r.counts.lowText) ? '  <-- ISSUES' : '  ok';
  console.log(`\n${r.route.padEnd(34)} dark=${r.isDark}  light=${r.counts.light} lowText=${r.counts.lowText}${flag}`);
  for (const x of r.light)   console.log(`    LIGHT ${x.w}x${x.h} ${x.bg}  ${x.cls}`);
  for (const x of r.lowText) console.log(`    TEXT  ${x.ratio}  "${x.txt}"  ${x.cls}`);
}
console.log(`\n==== TOTAL: ${totalL} light surfaces, ${totalT} low-contrast texts across ${report.length} routes ====`);
if (totalL || totalT) process.exitCode = 1;
