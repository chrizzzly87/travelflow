import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validatePublicPrerenders } from '../../scripts/validate-public-prerenders';
let root: string;
const html = (lang: string, dir: string, route: string) => `<html lang="${lang}" dir="${dir}"><head><link rel="canonical" href="https://example.test${route}"></head><body><main><h1>Public document</h1></main></body></html>`;
beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'tf-prerender-'));
    await mkdir(path.join(root, 'fa'));
    await writeFile(path.join(root, 'index.html'), html('en', 'ltr', '/'));
    await writeFile(path.join(root, 'fa/pricing.html'), html('fa', 'rtl', '/fa/pricing'));
    await writeFile(path.join(root, 'spa.html'), '<html><body>Offline</body></html>');
});
afterEach(() => rm(root, { recursive: true, force: true }));
describe('emitted public document validation', () => {
    it('accepts flat localized documents and the separate offline shell', async () => {
        expect(await validatePublicPrerenders(root, ['/', '/fa/pricing'])).toEqual([]);
    });
    it('rejects stale directory documents that make Netlify redirect canonical flat URLs', async () => {
        await mkdir(path.join(root, 'fa/pricing'));
        await writeFile(path.join(root, 'fa/pricing/index.html'), html('fa', 'rtl', '/fa/pricing'));
        expect(await validatePublicPrerenders(root, ['/fa/pricing'])).toContain('/fa/pricing: competing directory index');
    });
    it('rejects missing localized output rather than passing a static configuration check', async () => {
        expect(await validatePublicPrerenders(root, ['/de/pricing'])).toContain('/de/pricing: missing flat prerender de/pricing.html');
    });
    it('rejects language/direction leakage, wrong canonical URLs and empty documents', async () => {
        await writeFile(path.join(root, 'fa/pricing.html'), html('de', 'ltr', '/pricing/').replace('<h1>Public document</h1>', ''));
        expect(await validatePublicPrerenders(root, ['/fa/pricing'])).toEqual([
            '/fa/pricing: wrong document language', '/fa/pricing: wrong document direction',
            '/fa/pricing: wrong canonical path', '/fa/pricing: missing server-rendered heading',
        ]);
        await rm(path.join(root, 'spa.html'));
        expect(await validatePublicPrerenders(root, ['/'])).toContain('offline shell: missing spa.html');
    });
});
