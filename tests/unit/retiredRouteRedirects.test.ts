import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const toml = readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const cdnRedirects = new Map([...toml.matchAll(/\[\[redirects\]\]\s+from = "([^"]+)"\s+to = "([^"]+)"\s+status = (\d+)/g)].map(match => [match[1], { to: match[2], status: Number(match[3]) }]));
const routeRedirects = readdirSync(path.join(root, 'src/routes/redirects')).map(file => {
    const source = readFileSync(path.join(root, 'src/routes/redirects', file), 'utf8');
    return {
        from: /createFileRoute\("\/_redirects([^"]+)"\)/.exec(source)![1],
        to: /href: "([^"]+)"/.exec(source)![1],
        permanent: source.includes('statusCode: 301'),
    };
});

describe('retired route redirects', () => {
    it('answers every permanent move at the CDN with the same target', () => {
        const permanent = routeRedirects.filter(route => route.permanent);
        expect(permanent.length).toBeGreaterThan(0);
        for (const route of permanent) expect(cdnRedirects.get(route.from)).toEqual({ to: route.to, status: 301 });
    });

    it('keeps structural shortcuts in the router, not as permanent CDN moves', () => {
        for (const route of routeRedirects.filter(item => !item.permanent)) expect(cdnRedirects.has(route.from)).toBe(false);
    });
});
