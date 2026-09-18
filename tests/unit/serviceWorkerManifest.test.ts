import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    FIXED_PRECACHE_URLS,
    buildPrecacheUrls,
    computeBuildHash,
    extractShellAssets,
    renderServiceWorker,
} from '../../scripts/lib/serviceWorkerManifest.mjs';

const SHELL_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="icon" href="/favicon.svg" />
    <link rel="stylesheet" crossorigin href="/assets/index-9f8e7d.css" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X" />
    <link rel="preload" href="/fonts/space-grotesk/space-grotesk-latin.woff2" as="font" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" crossorigin src="/assets/index-a1b2c3.js"></script>
  </body>
</html>`;

describe('extractShellAssets', () => {
    it('finds the entry script and local stylesheets', () => {
        expect(extractShellAssets(SHELL_HTML)).toEqual({
            scripts: ['/assets/index-a1b2c3.js'],
            stylesheets: ['/assets/index-9f8e7d.css'],
        });
    });

    it('ignores cross-origin stylesheets', () => {
        const { stylesheets } = extractShellAssets(SHELL_HTML);
        expect(stylesheets.some((href) => href.startsWith('http'))).toBe(false);
    });

    it('throws when the shell has no module entry script', () => {
        // Better to fail the build than to publish a worker whose precache
        // cannot boot the app — that failure is invisible until someone is
        // already offline.
        expect(() => extractShellAssets('<html><body></body></html>'))
            .toThrow(/No module entry script/);
    });

    it('throws on empty input', () => {
        expect(() => extractShellAssets('')).toThrow(/empty/i);
        expect(() => extractShellAssets('   ')).toThrow(/empty/i);
    });
});

describe('buildPrecacheUrls', () => {
    it('puts the fixed shell files first, then the build output', () => {
        const urls = buildPrecacheUrls(SHELL_HTML);
        expect(urls.slice(0, FIXED_PRECACHE_URLS.length)).toEqual([...FIXED_PRECACHE_URLS]);
        expect(urls).toContain('/assets/index-a1b2c3.js');
        expect(urls).toContain('/assets/index-9f8e7d.css');
    });

    it('de-duplicates', () => {
        const urls = buildPrecacheUrls(SHELL_HTML, {
            fixedUrls: ['/spa.html', '/spa.html', '/assets/index-a1b2c3.js'],
        });
        expect(new Set(urls).size).toBe(urls.length);
    });

    it('stays small enough to be a reasonable install-time download', () => {
        // Guard against someone widening the manifest back to all of dist/assets.
        expect(buildPrecacheUrls(SHELL_HTML).length).toBeLessThan(25);
    });
});

describe('computeBuildHash', () => {
    const entries = [
        { url: '/spa.html', contents: '<html></html>' },
        { url: '/assets/index-a1b2c3.js', contents: 'console.log(1)' },
    ];

    it('is stable for identical input', () => {
        expect(computeBuildHash(entries)).toBe(computeBuildHash(entries));
    });

    it('does not depend on input ordering', () => {
        expect(computeBuildHash([...entries].reverse())).toBe(computeBuildHash(entries));
    });

    it('changes when any file content changes', () => {
        const changed = [entries[0], { url: entries[1].url, contents: 'console.log(2)' }];
        expect(computeBuildHash(changed)).not.toBe(computeBuildHash(entries));
    });

    it('changes when a file is added', () => {
        const added = [...entries, { url: '/assets/extra.js', contents: 'x' }];
        expect(computeBuildHash(added)).not.toBe(computeBuildHash(entries));
    });

    it('distinguishes content moving between files', () => {
        const swapped = [
            { url: '/spa.html', contents: 'console.log(1)' },
            { url: '/assets/index-a1b2c3.js', contents: '<html></html>' },
        ];
        expect(computeBuildHash(swapped)).not.toBe(computeBuildHash(entries));
    });
});

describe('renderServiceWorker', () => {
    const template = "const H = '__BUILD_HASH__';\nconst M = __PRECACHE_MANIFEST__;\n";

    it('substitutes both placeholders', () => {
        const output = renderServiceWorker(template, {
            buildHash: 'abc123',
            precacheUrls: ['/spa.html'],
        });
        expect(output).toContain("const H = 'abc123'");
        expect(output).toContain('"/spa.html"');
        expect(output).not.toContain('__BUILD_HASH__');
        expect(output).not.toContain('__PRECACHE_MANIFEST__');
    });

    it('emits a valid JavaScript array literal', () => {
        const output = renderServiceWorker(template, {
            buildHash: 'abc123',
            precacheUrls: ['/spa.html', '/assets/index-a1b2c3.js'],
        });
        const value = new Function(`${output}\nreturn M;`)();
        expect(value).toEqual(['/spa.html', '/assets/index-a1b2c3.js']);
    });

    it('substitutes every occurrence, not just the first', () => {
        // Regression: the real template names both placeholders in its own doc
        // comment. A single-occurrence `replace` stamped the comment and left
        // the actual assignment as a bare identifier, producing a worker that
        // threw ReferenceError on install.
        const withComment = `/* replaces __BUILD_HASH__ and __PRECACHE_MANIFEST__ */\n${template}`;
        const output = renderServiceWorker(withComment, {
            buildHash: 'abc123',
            precacheUrls: ['/spa.html'],
        });
        expect(output).not.toContain('__BUILD_HASH__');
        expect(output).not.toContain('__PRECACHE_MANIFEST__');
        expect(new Function(`${output}\nreturn M;`)()).toEqual(['/spa.html']);
    });

    it('renders the real template into executable JavaScript', () => {
        const realTemplate = fs.readFileSync(
            path.resolve(process.cwd(), 'scripts', 'templates', 'sw.js'),
            'utf8'
        );
        const output = renderServiceWorker(realTemplate, {
            buildHash: 'deadbeef1234',
            precacheUrls: ['/spa.html', '/assets/index-a1b2c3.js'],
        });

        expect(output).not.toContain('__BUILD_HASH__');
        expect(output).not.toContain('__PRECACHE_MANIFEST__');

        // The worker references `self`, so it cannot simply be run here; parsing
        // it is what matters — an unsubstituted placeholder still parses, which
        // is why the assertions above exist too.
        expect(() => new Function(output)).not.toThrow();
    });

    it('refuses a template missing a placeholder', () => {
        expect(() => renderServiceWorker("const M = __PRECACHE_MANIFEST__;", {
            buildHash: 'x',
            precacheUrls: [],
        })).toThrow(/__BUILD_HASH__/);

        expect(() => renderServiceWorker("const H = '__BUILD_HASH__';", {
            buildHash: 'x',
            precacheUrls: [],
        })).toThrow(/__PRECACHE_MANIFEST__/);
    });
});
