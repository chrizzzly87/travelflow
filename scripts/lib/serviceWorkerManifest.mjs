import crypto from 'node:crypto';

/**
 * Pure helpers for building the service worker's install-time precache list.
 *
 * Deliberately filesystem-free so `scripts/build-service-worker.mjs` owns all
 * the I/O and these can be unit-tested directly.
 */

/**
 * Same-origin URLs that are always precached, independent of the build output.
 * Everything here must exist in `dist/` or the worker's `cache.addAll` — and
 * therefore the install — will fail.
 */
export const FIXED_PRECACHE_URLS = [
  '/spa.html',
  '/manifest.webmanifest',
  '/brand-plane.svg',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  // The two default Latin font files `index.html` already preloads. Other
  // locales' fonts are picked up by the runtime static-media cache instead —
  // precaching all of `public/fonts` (850 KB) would tax a phone on install.
  '/fonts/bricolage-grotesque/bricolage-grotesque-latin.woff2',
  '/fonts/space-grotesk/space-grotesk-latin.woff2',
];

const MODULE_SCRIPT_PATTERN = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const STYLESHEET_PATTERN = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

const collectMatches = (html, pattern) => {
  const found = [];
  let match = pattern.exec(html);
  while (match) {
    found.push(match[1]);
    match = pattern.exec(html);
  }
  pattern.lastIndex = 0;
  return found;
};

/** Keep only same-origin, root-relative build output. */
const isLocalBuildUrl = (url) => url.startsWith('/assets/');

/**
 * Extract the entry script and stylesheets the shell HTML boots from.
 *
 * Throws when no entry script is found: that means the HTML is not what we
 * think it is, and shipping a worker whose precache cannot boot the app would
 * be worse than failing the build.
 */
export const extractShellAssets = (html) => {
  if (typeof html !== 'string' || html.trim() === '') {
    throw new Error('Shell HTML is empty; cannot derive the precache manifest.');
  }

  const scripts = collectMatches(html, MODULE_SCRIPT_PATTERN).filter(isLocalBuildUrl);
  const stylesheets = collectMatches(html, STYLESHEET_PATTERN).filter(isLocalBuildUrl);

  if (scripts.length === 0) {
    throw new Error(
      'No module entry script found in the shell HTML. '
      + 'Has the build output or prerender step changed shape?'
    );
  }

  return { scripts, stylesheets };
};

/**
 * Build the final, de-duplicated precache URL list in a stable order.
 */
export const buildPrecacheUrls = (html, { fixedUrls = FIXED_PRECACHE_URLS } = {}) => {
  const { scripts, stylesheets } = extractShellAssets(html);
  return Array.from(new Set([...fixedUrls, ...stylesheets, ...scripts]));
};

/**
 * Hash the precache set by content, not by name.
 *
 * Using contents means a rebuild that produces byte-identical output keeps the
 * same cache name and returning visitors re-download nothing; any real change
 * rotates the name and the old caches are dropped on activate.
 *
 * @param {Array<{ url: string, contents: Buffer | string }>} entries
 */
export const computeBuildHash = (entries) => {
  const hash = crypto.createHash('sha256');
  for (const entry of [...entries].sort((left, right) => left.url.localeCompare(right.url))) {
    hash.update(entry.url);
    hash.update('\0');
    hash.update(entry.contents);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
};

/**
 * Substitute the template placeholders. Throws when either is missing so a
 * template edit cannot silently ship an unstamped worker.
 */
export const renderServiceWorker = (template, { buildHash, precacheUrls }) => {
  if (!template.includes('__BUILD_HASH__')) {
    throw new Error('Service worker template is missing the __BUILD_HASH__ placeholder.');
  }
  if (!template.includes('__PRECACHE_MANIFEST__')) {
    throw new Error('Service worker template is missing the __PRECACHE_MANIFEST__ placeholder.');
  }

  // `replaceAll`, not `replace`: the template's own doc comment names both
  // placeholders, so replacing only the first occurrence stamps the comment and
  // leaves the real assignment as a bare identifier — a worker that throws
  // ReferenceError on every device it installs to.
  const rendered = template
    .replaceAll('__BUILD_HASH__', buildHash)
    .replaceAll('__PRECACHE_MANIFEST__', JSON.stringify(precacheUrls, null, 2));

  if (rendered.includes('__BUILD_HASH__') || rendered.includes('__PRECACHE_MANIFEST__')) {
    throw new Error('Service worker still contains an unsubstituted placeholder after rendering.');
  }

  return rendered;
};
