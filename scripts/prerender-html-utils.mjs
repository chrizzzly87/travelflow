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
    .map((href) => `    <link rel="modulepreload" href="${href}" crossorigin />`);

  if (links.length === 0) return html;

  const block = `${links.join('\n')}\n  `;
  return `${html.slice(0, headCloseIndex)}${block}${html.slice(headCloseIndex)}`;
}

const BOOT_SHELL_ELEMENT_PATTERN = /[ \t]*<div id="app-bootstrap-shell">[\s\S]*?(?=<div id="root")/;
const BOOT_SHELL_STYLE_PATTERN = /[ \t]*<!--[^>]*boot-shell styles[\s\S]*?-->\s*/i;
const BOOT_SHELL_STYLE_TAG_PATTERN = /[ \t]*<style[^>]*\bdata-tf-boot-shell-css\b[^>]*>[\s\S]*?<\/style>\s*/;
const BOOT_SHELL_SCRIPT_COMMENT_PATTERN = /[ \t]*<!--[^>]*boot-shell hide script[\s\S]*?-->\s*/i;
const BOOT_SHELL_SCRIPT_TAG_PATTERN = /[ \t]*<script[^>]*\bdata-tf-boot-shell-script\b[^>]*>[\s\S]*?<\/script>\s*/;

/**
 * Remove the bootstrap shell markup, its dedicated style block, and the
 * shell hide-script from a prerendered document. Prerendered pages ship real
 * content in #root, so the shell would be hidden instantly anyway — stripping
 * it saves the inline CSS/markup bytes on every prerendered page.
 *
 * @param {string} html
 * @returns {{ html: string, removedShell: boolean, removedStyle: boolean, removedScript: boolean }}
 */
export function stripBootstrapShell(html) {
  let output = html;

  const withoutShell = output.replace(BOOT_SHELL_ELEMENT_PATTERN, '');
  const removedShell = withoutShell !== output;
  output = withoutShell;

  let removedStyle = false;
  const withoutStyle = output
    .replace(BOOT_SHELL_STYLE_PATTERN, '')
    .replace(BOOT_SHELL_STYLE_TAG_PATTERN, (match) => {
      removedStyle = true;
      return '';
    });
  output = withoutStyle;

  let removedScript = false;
  const withoutScript = output
    .replace(BOOT_SHELL_SCRIPT_COMMENT_PATTERN, '')
    .replace(BOOT_SHELL_SCRIPT_TAG_PATTERN, (match) => {
      removedScript = true;
      return '';
    });
  output = withoutScript;

  return { html: output, removedShell, removedStyle, removedScript };
}
