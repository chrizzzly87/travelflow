import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'content', 'blog');
const OUT_FILE = path.join(ROOT, 'public', 'sitemap.xml');

const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://travelflow.app').replace(/\/$/, '');
const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'it', 'ru', 'pt'];
const DEFAULT_LOCALE = 'en';

const MARKETING_PATHS = [
    '/',
    '/features',
    '/inspirations',
    '/inspirations/themes',
    '/inspirations/best-time-to-travel',
    '/inspirations/countries',
    '/inspirations/events-and-festivals',
    '/inspirations/weekend-getaways',
    '/updates',
    '/blog',
    '/pricing',
    '/faq',
    '/login',
    '/contact',
    '/imprint',
    '/privacy',
    '/terms',
    '/cookies',
    '/share-unavailable',
];

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

const localizePath = (pathName, locale) => {
    if (locale === DEFAULT_LOCALE) return pathName;
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

const buildAlternateLinks = (basePath, locales = SUPPORTED_LOCALES) => {
    const uniqueLocales = Array.from(new Set(locales));
    const lines = [];
    for (const locale of uniqueLocales) {
        const href = toAbsoluteUrl(localizePath(basePath, locale));
        lines.push(`<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(href)}" />`);
    }

    const xDefaultLocale = uniqueLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : (uniqueLocales[0] || DEFAULT_LOCALE);
    const xDefault = toAbsoluteUrl(localizePath(basePath, xDefaultLocale));
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

const readPublishedBlogPosts = async () => {
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
        const language = SUPPORTED_LOCALES.includes(meta.language) ? meta.language : DEFAULT_LOCALE;
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
    const nodes = [];

    for (const pathName of MARKETING_PATHS) {
        for (const locale of SUPPORTED_LOCALES) {
            const localizedPath = localizePath(pathName, locale);
            const loc = toAbsoluteUrl(localizedPath);
            const alternates = buildAlternateLinks(pathName);
            nodes.push(buildUrlNode({ loc, alternates }));
        }
    }

    const blogPosts = await readPublishedBlogPosts();
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
            const loc = toAbsoluteUrl(localizePath(basePath, post.language));
            const alternates = buildAlternateLinks(basePath, locales);
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
    console.log(`[sitemap:generate] wrote ${OUT_FILE} (${nodes.length} URLs)`);
};

buildSitemap().catch((error) => {
    console.error(error);
    process.exit(1);
});
