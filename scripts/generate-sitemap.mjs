import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'content', 'blog');
const OUT_FILE = path.join(ROOT, 'public', 'sitemap.xml');
const APP_FILE = path.join(ROOT, 'App.tsx');
const LOCALES_FILE = path.join(ROOT, 'config', 'locales.ts');

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://travelflow.app').replace(/\/$/, '');
const NON_INDEXABLE_STATIC_PATHS = new Set(['/auth/reset-password', '/share-unavailable']);
const MARKETING_ROUTE_CONFIG_REGEX = /const\s+MARKETING_ROUTE_CONFIGS[\s\S]*?=\s*\[([\s\S]*?)\];/;
const SUPPORTED_LOCALES_REGEX = /export\s+const\s+SUPPORTED_LOCALES\s*:[^=]*=\s*\[([\s\S]*?)\];/;
const DEFAULT_LOCALE_REGEX = /export\s+const\s+DEFAULT_LOCALE\s*:[^=]*=\s*['"]([^'"]+)['"];/;
const PATH_LITERAL_REGEX = /path:\s*['"]([^'"]+)['"]/g;
const LOCALE_LITERAL_REGEX = /['"]([A-Za-z0-9-]+)['"]/g;

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const stripQuotes = (value) => {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

const parseFrontmatter = (raw) => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const match = normalized.match(FRONTMATTER_REGEX);
    if (!match) return { meta: {}, body: normalized };

    const meta = {};
    for (const line of match[1].split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf(':');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim().toLowerCase();
        const value = stripQuotes(trimmed.slice(separator + 1));
        meta[key] = value;
    }

    return { meta, body: match[2] };
};

const readLocalesConfig = async () => {
    const raw = await fs.readFile(LOCALES_FILE, 'utf8');
    const supportedLocalesMatch = raw.match(SUPPORTED_LOCALES_REGEX);
    const defaultLocaleMatch = raw.match(DEFAULT_LOCALE_REGEX);

    if (!supportedLocalesMatch || !defaultLocaleMatch) {
        throw new Error(`[sitemap:generate] Could not parse locales from ${LOCALES_FILE}`);
    }

    const supportedLocales = [];
    for (const match of supportedLocalesMatch[1].matchAll(LOCALE_LITERAL_REGEX)) {
        supportedLocales.push(match[1]);
    }

    if (supportedLocales.length === 0) {
        throw new Error(`[sitemap:generate] No locales found in ${LOCALES_FILE}`);
    }

    const defaultLocale = defaultLocaleMatch[1];
    if (!supportedLocales.includes(defaultLocale)) {
        throw new Error(
            `[sitemap:generate] DEFAULT_LOCALE (${defaultLocale}) is not in SUPPORTED_LOCALES from ${LOCALES_FILE}`
        );
    }

    return { supportedLocales, defaultLocale };
};

const readIndexableMarketingPaths = async () => {
    const raw = await fs.readFile(APP_FILE, 'utf8');
    const configMatch = raw.match(MARKETING_ROUTE_CONFIG_REGEX);
    if (!configMatch) {
        throw new Error(`[sitemap:generate] Could not parse MARKETING_ROUTE_CONFIGS from ${APP_FILE}`);
    }

    const uniquePaths = [];
    for (const match of configMatch[1].matchAll(PATH_LITERAL_REGEX)) {
        const routePath = match[1];
        if (routePath.includes(':')) continue;
        if (NON_INDEXABLE_STATIC_PATHS.has(routePath)) continue;
        if (uniquePaths.includes(routePath)) continue;
        uniquePaths.push(routePath);
    }

    if (uniquePaths.length === 0) {
        throw new Error(`[sitemap:generate] No indexable marketing paths extracted from ${APP_FILE}`);
    }

    return uniquePaths;
};

const localizePath = (pathName, locale, defaultLocale) => {
    if (locale === defaultLocale) return pathName;
    if (pathName === '/') return `/${locale}`;
    return `/${locale}${pathName}`;
};

const toAbsoluteUrl = (pathName) => `${SITE_URL}${pathName}`;

const escapeXml = (value) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

const buildAlternateLinks = ({ basePath, locales, defaultLocale }) => {
    const uniqueLocales = Array.from(new Set(locales));
    const lines = [];
    for (const locale of uniqueLocales) {
        const href = toAbsoluteUrl(localizePath(basePath, locale, defaultLocale));
        lines.push(`<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(href)}" />`);
    }

    const xDefaultLocale = uniqueLocales.includes(defaultLocale) ? defaultLocale : (uniqueLocales[0] || defaultLocale);
    const xDefault = toAbsoluteUrl(localizePath(basePath, xDefaultLocale, defaultLocale));
    lines.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefault)}" />`);
    return lines;
};

const buildUrlNode = ({ loc, alternates, lastmod }) => {
    const parts = ['  <url>', `    <loc>${escapeXml(loc)}</loc>`];
    if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
    for (const alt of alternates) {
        parts.push(`    ${alt}`);
    }
    parts.push('  </url>');
    return parts.join('\n');
};

const readPublishedBlogPosts = async ({ supportedLocales, defaultLocale }) => {
    let entries = [];
    try {
        entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
    } catch {
        return [];
    }

    const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => path.join(BLOG_DIR, entry.name));

    const posts = [];
    for (const filePath of files) {
        const raw = await fs.readFile(filePath, 'utf8');
        const { meta } = parseFrontmatter(raw);
        if ((meta.status || '').toLowerCase() !== 'published') continue;
        const slug = meta.slug;
        const language = supportedLocales.includes(meta.language) ? meta.language : defaultLocale;
        if (!slug) continue;
        posts.push({
            slug,
            language,
            translationGroup: meta.translation_group || slug,
            publishedAt: meta.published_at || null,
        });
    }

    return posts;
};

const buildSitemap = async () => {
    const [{ supportedLocales, defaultLocale }, marketingPaths] = await Promise.all([
        readLocalesConfig(),
        readIndexableMarketingPaths(),
    ]);

    const nodes = [];

    for (const pathName of marketingPaths) {
        for (const locale of supportedLocales) {
            const localizedPath = localizePath(pathName, locale, defaultLocale);
            const loc = toAbsoluteUrl(localizedPath);
            const alternates = buildAlternateLinks({
                basePath: pathName,
                locales: supportedLocales,
                defaultLocale,
            });
            nodes.push(buildUrlNode({ loc, alternates }));
        }
    }

    const blogPosts = await readPublishedBlogPosts({ supportedLocales, defaultLocale });
    const groups = new Map();

    for (const post of blogPosts) {
        const existing = groups.get(post.translationGroup) || [];
        existing.push(post);
        groups.set(post.translationGroup, existing);
    }

    for (const posts of groups.values()) {
        const locales = Array.from(new Set(posts.map((post) => post.language)));
        for (const post of posts) {
            const basePath = `/blog/${encodeURIComponent(post.slug)}`;
            const loc = toAbsoluteUrl(localizePath(basePath, post.language, defaultLocale));
            const alternates = buildAlternateLinks({
                basePath,
                locales,
                defaultLocale,
            });
            nodes.push(buildUrlNode({ loc, alternates, lastmod: post.publishedAt || undefined }));
        }
    }

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...nodes,
        '</urlset>',
        '',
    ].join('\n');

    await fs.writeFile(OUT_FILE, xml, 'utf8');
    console.log(
        `[sitemap:generate] wrote ${OUT_FILE} (${nodes.length} URLs from ${marketingPaths.length} static routes + ${blogPosts.length} blog posts)`
    );
};

buildSitemap().catch((error) => {
    console.error(error);
    process.exit(1);
});
