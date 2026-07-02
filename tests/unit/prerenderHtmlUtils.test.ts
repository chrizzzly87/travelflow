import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs build script helper without type declarations
import {
  collectModulePreloadHrefs,
  injectModulePreloadHints,
  stripBootstrapShell,
} from '../../scripts/prerender-html-utils.mjs';

describe('collectModulePreloadHrefs', () => {
  it('keeps only /assets/*.js requests as root-relative hrefs in request order', () => {
    const hrefs = collectModulePreloadHrefs([
      'http://localhost:4173/',
      'http://localhost:4173/assets/index-Ab12Cd34.js',
      'http://localhost:4173/assets/vendor-Ef56Gh78.js',
      'http://localhost:4173/assets/index-Zz99Yy88.css',
      'http://localhost:4173/fonts/space-grotesk/space-grotesk-latin.woff2',
      'http://localhost:4173/assets/locale-en-common-Qq11Ww22.js',
      'http://localhost:4173/brand-plane.svg',
    ]);

    expect(hrefs).toEqual([
      '/assets/index-Ab12Cd34.js',
      '/assets/vendor-Ef56Gh78.js',
      '/assets/locale-en-common-Qq11Ww22.js',
    ]);
  });

  it('deduplicates repeated requests and honors the hint cap', () => {
    const urls = [
      'http://localhost:4173/assets/a-1.js',
      'http://localhost:4173/assets/a-1.js',
      'http://localhost:4173/assets/b-2.js',
      'http://localhost:4173/assets/c-3.js',
    ];

    expect(collectModulePreloadHrefs(urls)).toEqual(['/assets/a-1.js', '/assets/b-2.js', '/assets/c-3.js']);
    expect(collectModulePreloadHrefs(urls, { maxHints: 2 })).toEqual(['/assets/a-1.js', '/assets/b-2.js']);
  });

  it('ignores malformed URLs instead of throwing', () => {
    expect(collectModulePreloadHrefs(['http://', '/assets/ok-1.js'])).toEqual(['/assets/ok-1.js']);
  });
});

describe('injectModulePreloadHints', () => {
  const html = '<html><head><title>t</title></head><body><script type="module" src="/assets/entry-1.js"></script></body></html>';

  it('injects modulepreload links before </head>, skipping hrefs already referenced', () => {
    const result = injectModulePreloadHints(html, ['/assets/entry-1.js', '/assets/chunk-2.js']);

    expect(result).not.toContain('<link rel="modulepreload" href="/assets/entry-1.js"');
    const linkIndex = result.indexOf('<link rel="modulepreload" href="/assets/chunk-2.js" crossorigin />');
    const headCloseIndex = result.indexOf('</head>');
    expect(linkIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeLessThan(headCloseIndex);
  });

  it('preserves the given (entry-first) order', () => {
    const result = injectModulePreloadHints(html, ['/assets/first-1.js', '/assets/second-2.js']);
    expect(result.indexOf('/assets/first-1.js')).toBeLessThan(result.indexOf('/assets/second-2.js'));
  });

  it('returns html unchanged when there is nothing to inject or no head', () => {
    expect(injectModulePreloadHints(html, ['/assets/entry-1.js'])).toBe(html);
    expect(injectModulePreloadHints('<body></body>', ['/assets/chunk-2.js'])).toBe('<body></body>');
  });
});

describe('stripBootstrapShell', () => {
  // Validate against the real source template so the markers stay in sync
  // with index.html (the built dist/index.html preserves these attributes).
  const sourceHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('removes the shell element, its style block, and the hide-script from the template', () => {
    const result = stripBootstrapShell(sourceHtml);

    expect(result.removedShell).toBe(true);
    expect(result.removedStyle).toBe(true);
    expect(result.removedScript).toBe(true);
    expect(result.html).not.toContain('id="app-bootstrap-shell"');
    expect(result.html).not.toContain('tf-boot-shell');
    expect(result.html).not.toContain('data-tf-boot-shell-css');
    expect(result.html).not.toContain('data-tf-boot-shell-script');
    expect(result.html).not.toContain("data-tf-react-shell-visible', 'true'");
  });

  it('keeps the root container, entry script, and non-shell styles intact', () => {
    const result = stripBootstrapShell(sourceHtml);

    expect(result.html).toContain('<div id="root"></div>');
    expect(result.html).toContain('index.tsx');
    expect(result.html).toContain('.timeline-scroll::-webkit-scrollbar');
    expect(result.html).toContain('.markdown-body ul');
    expect(result.html).toContain('.pac-container');
    expect(result.html).toContain('name="contact"');
  });

  it('reports missing markers without altering unrelated html', () => {
    const plain = '<html><head></head><body><div id="root"></div></body></html>';
    const result = stripBootstrapShell(plain);

    expect(result.html).toBe(plain);
    expect(result.removedShell).toBe(false);
    expect(result.removedStyle).toBe(false);
    expect(result.removedScript).toBe(false);
  });
});
