import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { publicPrerenderPaths } from '../app/routing/publicPrerender';
import { getRouteLocale } from '../app/routing/routeLocale';
import { localeToDir } from '../config/locales';

const attribute = (tag: string, name: string) => new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];

/** Validate emitted documents, not merely the Vite configuration. A missing or
 * cross-request locale document must fail the same build that would publish it. */
export async function validatePublicPrerenders(root: string, paths: readonly string[] = publicPrerenderPaths) {
    const errors: string[] = [];
    for (const route of paths) {
        const filename = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
        let html: string;
        try { html = await readFile(path.join(root, filename), 'utf8'); }
        catch { errors.push(`${route}: missing flat prerender ${filename}`); continue; }
        if (route !== '/') {
            try {
                await access(path.join(root, route.slice(1), 'index.html'));
                errors.push(`${route}: competing directory index`);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(`${route}: cannot verify directory-index absence`);
            }
        }
        const opening = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
        const locale = getRouteLocale(route);
        if (attribute(opening, 'lang') !== locale) errors.push(`${route}: wrong document language`);
        if (attribute(opening, 'dir') !== localeToDir(locale)) errors.push(`${route}: wrong document direction`);
        const canonical = (html.match(/<link\b[^>]*>/gi) ?? []).find(tag => attribute(tag, 'rel') === 'canonical');
        try {
            if (new URL(attribute(canonical ?? '', 'href') ?? '').pathname !== route) errors.push(`${route}: wrong canonical path`);
        } catch { errors.push(`${route}: missing absolute canonical URL`); }
        if (!/<main\b[^>]*>[\s\S]*?<h1\b[^>]*>\s*[\s\S]+?<\/h1>/i.test(html)) errors.push(`${route}: missing server-rendered heading`);
    }
    try {
        if (!(await readFile(path.join(root, 'spa.html'), 'utf8')).trim()) errors.push('offline shell: empty');
    } catch { errors.push('offline shell: missing spa.html'); }
    return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const errors = await validatePublicPrerenders(path.resolve('dist/client'));
    if (errors.length) {
        for (const error of errors) console.error(error);
        process.exitCode = 1;
    } else console.log(`Validated ${publicPrerenderPaths.length} public prerenders and the separate offline shell.`);
}
