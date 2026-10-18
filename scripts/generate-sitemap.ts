import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveSiteUrl } from '../config/site-url.mjs';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../config/locales';
import { routes } from '../src/virtualRoutes';
import { collectIndexableRoutePaths } from './lib/sitemapRoutes';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'content', 'blog');
const DESTINATION_GUIDES_FILE = path.join(ROOT, 'data', 'destinationGuides.json');
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

    const meta: Record<string, string> = {};
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

const buildUrlNode = ({ loc, alternates, lastmod }: { loc: string; alternates: string[]; lastmod?: string }) => {
    const parts = ['  <url>', `    <loc>${escapeXml(loc)}</loc>`];
    if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
    for (const alt of alternates) {
        parts.push(`    ${alt}`);
    }
    parts.push('  </url>');
    return parts.join('\n');
};

const readPublishedBlogPosts = async ({ supportedLocales, defaultLocale }: { supportedLocales: readonly string[]; defaultLocale: string }) => {
    let entries: import('node:fs').Dirent[] = [];
    try {
        entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
    } catch {
        return [];
    }

    const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => path.join(BLOG_DIR, entry.name));

    const posts: Array<{ slug: string; language: string; translationGroup: string; publishedAt: string | null }> = [];
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

/**
 * Destination guide pages are generated from `data/destinationGuides.json`, so they never
 * appear in the native static route tree. Country pages resolve at
 * `/inspirations/country/<slug>` and city/island pages at
 * `/inspirations/country/<countrySlug>/<childSlug>`.
 *
 * Every country guide is emitted. Child guides are only emitted when they carry curated
 * content (highlights); the remaining children are derived from the airport reference and
 * would submit near-duplicate stub pages that inherit all of their data from the parent
 * country. They stay reachable through the country page's internal links.
 */
export const readDestinationGuidePaths = async (filePath = DESTINATION_GUIDES_FILE) => {
    let document;
    try {
        document = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
        return [];
    }

    const guides = Array.isArray(document?.guides) ? document.guides : [];
    const countrySlugs = new Set(
        guides.filter((guide) => guide?.kind === 'country' && guide.slug).map((guide) => guide.slug)
    );

    const paths: string[] = [];
    for (const slug of countrySlugs) {
        paths.push(`/inspirations/country/${encodeURIComponent(String(slug))}`);
    }

    for (const guide of guides) {
        if (!guide || guide.kind === 'country') continue;
        if (!guide.slug || !guide.parentSlug) continue;
        if (!countrySlugs.has(guide.parentSlug)) continue;
        const hasCuratedContent = (Array.isArray(guide.highlights) && guide.highlights.length > 0)
            || Boolean(guide.summary);
        if (!hasCuratedContent) continue;
        paths.push(
            `/inspirations/country/${encodeURIComponent(guide.parentSlug)}/${encodeURIComponent(guide.slug)}`
        );
    }

    return Array.from(new Set(paths));
};

const buildSitemap = async () => {
    const supportedLocales = SUPPORTED_LOCALES;
    const defaultLocale = DEFAULT_LOCALE;
    const marketingPaths = collectIndexableRoutePaths(routes);

    const nodes: string[] = [];

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

    const destinationPaths = await readDestinationGuidePaths();

    for (const pathName of destinationPaths) {
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
        `[sitemap:generate] wrote ${OUT_FILE} (${nodes.length} URLs from ${marketingPaths.length} static routes + ${destinationPaths.length} destination guides + ${blogPosts.length} blog posts)`
    );
};

export { buildSitemap };

const isDirectRun = process.argv[1]
    && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
    buildSitemap().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
