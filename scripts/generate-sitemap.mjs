import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveSiteUrl } from '../config/site-url.mjs';
import {
    ASTRO_MARKETING_STATIC_ROUTES,
    DEFAULT_MARKETING_LOCALE,
    SUPPORTED_MARKETING_LOCALES,
    localizeMarketingManifestPath,
} from '../config/marketingRouteManifest.mjs';
import { countryGroups } from '../data/inspirationsData.ts';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'content', 'blog');
const OUT_FILE = path.join(ROOT, 'public', 'sitemap.xml');

const SITE_URL = resolveSiteUrl();

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

const readIndexableMarketingPaths = async () => {
    const staticPaths = ASTRO_MARKETING_STATIC_ROUTES
        .filter((route) => route.indexable && !route.path.includes(':'))
        .map((route) => route.path);
    const countryPaths = countryGroups.map((country) =>
        `/inspirations/country/${encodeURIComponent(country.country)}`
    );
    const uniquePaths = Array.from(new Set([...staticPaths, ...countryPaths]));

    if (uniquePaths.length === 0) {
        throw new Error('[sitemap:generate] No indexable marketing paths found in marketing route manifest');
    }

    return uniquePaths;
};

const localizePath = (pathName, locale, defaultLocale) => {
    return localizeMarketingManifestPath(pathName, locale);
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
    const supportedLocales = SUPPORTED_MARKETING_LOCALES;
    const defaultLocale = DEFAULT_MARKETING_LOCALE;
    const marketingPaths = await readIndexableMarketingPaths();

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
        `[sitemap:generate] wrote ${OUT_FILE} (${nodes.length} URLs from ${marketingPaths.length} marketing paths + ${blogPosts.length} blog posts)`
    );
};

buildSitemap().catch((error) => {
    console.error(error);
    process.exit(1);
});
