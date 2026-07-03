// Pure HTML helpers for scripts/prerender-routes.mjs.
// Kept dependency-free so they can be unit tested (tests/unit/prerenderHtmlUtils.test.ts).

/**
 * Normalize the asset URLs a route actually loaded pre-interaction into
 * root-relative, deduplicated modulepreload candidates (entry-first order).
 *
 * @param {string[]} urls Absolute or root-relative URLs in request order.
 * @param {{ maxHints?: number }} [options]
 * @returns {string[]} Root-relative hrefs like `/assets/chunk-abc123.js`.
 */
export function collectModulePreloadHrefs(urls, options = {}) {
  const { maxHints = 80 } = options;
  const hrefs = [];
  const seen = new Set();

  for (const url of urls) {
    let pathname;
    try {
      pathname = new URL(url, 'http://localhost').pathname;
    } catch {
      continue;
    }
    if (!pathname.startsWith('/assets/')) continue;
    if (!pathname.endsWith('.js')) continue;
    if (seen.has(pathname)) continue;
    seen.add(pathname);
    hrefs.push(pathname);
    if (hrefs.length >= maxHints) break;
  }

  return hrefs;
}

/**
 * Inject `<link rel="modulepreload">` hints into the document <head>.
 * Hrefs already referenced by the HTML (e.g. the entry `<script src>` or an
 * existing preload) are skipped to avoid duplicate hints.
 *
 * @param {string} html
 * @param {string[]} hrefs Ordered root-relative hrefs (entry-first).
 * @returns {string}
 */
export function injectModulePreloadHints(html, hrefs) {
  const headCloseIndex = html.indexOf('</head>');
  if (headCloseIndex === -1) return html;

  const links = hrefs
    .filter((href) => !html.includes(`"${href}"`))
    // fetchpriority="low" keeps the warmup from competing with the
    // render-blocking stylesheet and fonts on constrained connections —
    // a head-priority fanout regressed FCP by ~0.9s in local Lighthouse runs.
    .map((href) => `    <link rel="modulepreload" href="${href}" crossorigin fetchpriority="low" />`);

  if (links.length === 0) return html;

  const block = `${links.join('\n')}\n  `;
  return `${html.slice(0, headCloseIndex)}${block}${html.slice(headCloseIndex)}`;
}

const BOOT_SHELL_ELEMENT_PATTERN = /[ \t]*<div id="app-bootstrap-shell">[\s\S]*?(?=<div id="root")/;
const BOOT_SHELL_SCRIPT_COMMENT_PATTERN = /[ \t]*<!--[^>]*boot-shell hide script[\s\S]*?-->\s*/i;
const BOOT_SHELL_SCRIPT_TAG_PATTERN = /[ \t]*<script[^>]*\bdata-tf-boot-shell-script\b[^>]*>[\s\S]*?<\/script>\s*/;

/**
 * Remove the bootstrap shell markup and the shell hide-script from a
 * prerendered document. Prerendered pages ship real content in #root, so the
 * shell markup would be hidden instantly anyway.
 *
 * The dedicated boot-shell <style> block is deliberately KEPT: the runtime
 * `AppBootstrapShell` React component (rendered by `MarketingRouteLoadingShell`
 * as the Suspense fallback during client-side navigation) reuses the same
 * `tf-boot-*` classes, and those rules live only in this inline block — not in
 * the CSS bundle. Stripping it left the navigation fallback unstyled, producing
 * a full-screen white flash on every page switch. The block is ~2.5KB gzip.
 *
 * @param {string} html
 * @returns {{ html: string, removedShell: boolean, removedStyle: boolean, removedScript: boolean }}
 */
export function stripBootstrapShell(html) {
  let output = html;

  const withoutShell = output.replace(BOOT_SHELL_ELEMENT_PATTERN, '');
  const removedShell = withoutShell !== output;
  output = withoutShell;

  let removedScript = false;
  const withoutScript = output
    .replace(BOOT_SHELL_SCRIPT_COMMENT_PATTERN, '')
    .replace(BOOT_SHELL_SCRIPT_TAG_PATTERN, (match) => {
      removedScript = true;
      return '';
    });
  output = withoutScript;

  return { html: output, removedShell, removedStyle: false, removedScript };
}
