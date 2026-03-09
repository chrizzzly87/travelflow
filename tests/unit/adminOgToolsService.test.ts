import { describe, expect, it } from 'vitest';
import {
  buildSiteOgBuildCommands,
  classifyOgImageKind,
  inspectOgUrl,
  normalizeOgInspectionUrl,
  parseCsvListInput,
  parseOgHeadMetadata,
  resolveOgImageUrl,
} from '../../services/adminOgToolsService';

const ORIGIN = 'https://travelflowapp.netlify.app';

describe('adminOgToolsService metadata parsing', () => {
  it('parses core SEO and OG tags from html', () => {
    const html = `<!doctype html>
      <html>
        <head>
          <title>TravelFlow Blog</title>
          <meta name="description" content="Blog description." />
          <link rel="canonical" href="https://travelflowapp.netlify.app/blog" />
          <meta property="og:title" content="OG Title" />
          <meta property="og:description" content="OG Description" />
          <meta property="og:image" content="/images/og/site/generated/blog-a1b2c3.png" />
          <meta name="twitter:card" content="summary_large_image" />
        </head>
      </html>`;

    const metadata = parseOgHeadMetadata(html);
    expect(metadata.title).toBe('TravelFlow Blog');
    expect(metadata.description).toBe('Blog description.');
    expect(metadata.canonical).toBe('https://travelflowapp.netlify.app/blog');
    expect(metadata.ogTitle).toBe('OG Title');
    expect(metadata.ogDescription).toBe('OG Description');
    expect(metadata.ogImage).toBe('/images/og/site/generated/blog-a1b2c3.png');
    expect(metadata.twitterCard).toBe('summary_large_image');
  });
});

describe('adminOgToolsService image source classification', () => {
  it('classifies static and dynamic og images', () => {
    expect(classifyOgImageKind('/images/og/site/generated/root-a1.png', ORIGIN)).toBe('static-generated');
    expect(classifyOgImageKind(`${ORIGIN}/api/og/site?title=Blog`, ORIGIN)).toBe('dynamic-site');
    expect(classifyOgImageKind(`${ORIGIN}/api/og/trip?s=abc123`, ORIGIN)).toBe('dynamic-trip');
    expect(classifyOgImageKind('', ORIGIN)).toBe('missing');
    expect(classifyOgImageKind(`${ORIGIN}/images/blog/cover.jpg`, ORIGIN)).toBe('unknown');
  });

  it('resolves og image url to absolute same-origin url when possible', () => {
    expect(resolveOgImageUrl('/images/og/site/generated/root-a1.png', ORIGIN)).toBe(
      `${ORIGIN}/images/og/site/generated/root-a1.png`,
    );
    expect(resolveOgImageUrl('not a url', ORIGIN)).toBe(`${ORIGIN}/not%20a%20url`);
    expect(resolveOgImageUrl('', ORIGIN)).toBeNull();
  });
});

describe('adminOgToolsService URL inspection', () => {
  it('normalizes same-origin paths and blocks cross-origin urls', () => {
    const normalized = normalizeOgInspectionUrl('/blog', ORIGIN);
    expect(normalized.toString()).toBe(`${ORIGIN}/blog`);

    expect(() => normalizeOgInspectionUrl('https://example.com/blog', ORIGIN)).toThrow(
      'Only same-origin URLs are supported',
    );
  });

  it('inspects html and resolves source mode from response header', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        `<!doctype html><html><head>
          <meta property="og:title" content="TravelFlow Blog" />
          <meta property="og:description" content="Guides." />
          <meta property="og:image" content="/images/og/site/generated/blog-f00.png" />
        </head></html>`,
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'x-travelflow-og-source': 'static',
          },
        },
      );

    const result = await inspectOgUrl('/blog', { origin: ORIGIN, fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('static');
    expect(result.imageKind).toBe('static-generated');
    expect(result.metadata.ogTitle).toBe('TravelFlow Blog');
    expect(result.resolvedOgImageUrl).toBe(`${ORIGIN}/images/og/site/generated/blog-f00.png`);
  });
});

describe('adminOgToolsService command builder', () => {
  it('returns full-build command by default', () => {
    const commands = buildSiteOgBuildCommands({});
    expect(commands.hasFilters).toBe(false);
    expect(commands.buildCommand).toBe('pnpm og:site:build');
    expect(commands.validateCommand).toBe('pnpm og:site:validate');
    expect(commands.fullScopeCommand).toBe('pnpm og:site:build:full && pnpm og:site:validate:full');
  });

  it('builds filtered command flags in stable order', () => {
    const commands = buildSiteOgBuildCommands({
      locales: ['en', 'de', 'de'],
      includePrefixes: ['/blog', '/de/blog'],
      excludePaths: ['/blog/draft'],
    });

    expect(commands.hasFilters).toBe(true);
    expect(commands.buildCommand).toBe(
      'pnpm og:site:build -- --locales=en,de --include-prefixes=/blog,/de/blog --exclude-paths=/blog/draft',
    );
  });

  it('parses csv input with trimming and dedupe', () => {
    expect(parseCsvListInput(' en, de, en ,,fr ')).toEqual(['en', 'de', 'fr']);
  });
});
