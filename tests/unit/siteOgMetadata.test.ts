import { describe, expect, it } from 'vitest';
import {
  buildSiteOgMetadata,
  enumerateSiteOgPathnames,
} from '../../netlify/edge-lib/site-og-metadata.ts';
import {
  buildSiteOgStaticRenderPayload,
  collectSiteOgPathnames,
  collectSiteOgStaticTargets,
  computeSiteOgStaticPayloadHash,
  resolveSiteOgStaticPathFilterOptions,
} from '../../scripts/site-og-static-shared.ts';

const ORIGIN = 'https://travelflowapp.netlify.app';

const getMetadata = (pathname: string) => buildSiteOgMetadata(new URL(pathname, ORIGIN));

describe('site OG metadata resolver', () => {
  it('resolves homepage metadata', () => {
    const metadata = getMetadata('/');

    expect(metadata.routeKey).toBe('root');
    expect(metadata.canonicalPath).toBe('/');
    expect(metadata.canonicalUrl).toBe(`${ORIGIN}/`);
    expect(metadata.ogImageParams.path).toBe('/');
  });

  it('resolves localized static route metadata', () => {
    const metadata = getMetadata('/de/features');

    expect(metadata.canonicalPath).toBe('/de/features');
    expect(metadata.htmlLang).toBe('de');
    expect(metadata.alternateLinks.some((link) => link.hreflang === 'de')).toBe(true);
    expect(metadata.ogImageParams.path).toBe('/de/features');
  });

  it('resolves blog, country detail, and example route metadata', () => {
    const blogMeta = getMetadata('/blog/how-to-plan-multi-city-trip');
    expect(blogMeta.ogImageParams.blog_image).toContain('/images/blog/how-to-plan-multi-city-trip-og-vertical.jpg');
    expect(blogMeta.ogImageParams.path).toBe('/blog/how-to-plan-multi-city-trip');

    const countryMeta = getMetadata('/inspirations/country/New%20Zealand');
    expect(countryMeta.pageTitle.toLowerCase()).toContain('new zealand');
    expect(countryMeta.canonicalPath).toBe('/inspirations/country/New%20Zealand');

    const exampleMeta = getMetadata('/example/thailand-islands');
    expect(exampleMeta.canonicalPath).toBe('/example/thailand-islands');
    expect(exampleMeta.pageTitle).toContain('Temples');
    expect(exampleMeta.ogDescription).toContain('example trip template');
    expect(exampleMeta.ogImageUrl).toContain('/api/og/trip?');
    expect(exampleMeta.ogImageUrl).toContain('title=26D+Temples+%26+Beaches');
    expect(exampleMeta.ogImageUrl).toContain('map=https%3A%2F%2Ftravelflowapp.netlify.app%2Fimages%2Ftrip-maps%2Fthailand-islands.png');
  });
});

describe('site OG static generation helpers', () => {
  it('enumerates route pathnames for static OG generation', () => {
    const pathnames = enumerateSiteOgPathnames({
      blogSlugs: ['how-to-plan-multi-city-trip'],
      countryNames: ['Japan'],
      exampleTemplateIds: ['thailand-islands'],
    });

    expect(pathnames).toContain('/');
    expect(pathnames).toContain('/de/features');
    expect(pathnames).toContain('/blog/how-to-plan-multi-city-trip');
    expect(pathnames).toContain('/inspirations/country/Japan');
    expect(pathnames).toContain('/example/thailand-islands');
  });

  it('builds deterministic payload hashes and unique target route keys', () => {
    const metadata = getMetadata('/example/thailand-islands');
    const payload = buildSiteOgStaticRenderPayload(metadata);
    const hashA = computeSiteOgStaticPayloadHash(payload);
    const hashB = computeSiteOgStaticPayloadHash(payload);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{16}$/);

    const allTargets = collectSiteOgStaticTargets();
    expect(allTargets.length).toBeGreaterThan(0);

    const routeKeySet = new Set(allTargets.map((target) => target.routeKey));
    expect(routeKeySet.size).toBe(allTargets.length);

    const exampleTarget = allTargets.find((target) => target.pathname === '/example/thailand-islands');
    expect(exampleTarget).toBeTruthy();
  });

  it('filters static targets by locales and path include/exclude options', () => {
    const allPathnames = collectSiteOgPathnames();
    expect(allPathnames).toContain('/de/features');
    expect(allPathnames).toContain('/fr/features');

    const germanOnly = collectSiteOgPathnames({ locales: ['de'] });
    expect(germanOnly.length).toBeGreaterThan(0);
    expect(germanOnly.every((pathname) => pathname.startsWith('/de') || pathname === '/de')).toBe(true);

    const filteredBlog = collectSiteOgPathnames({
      includePrefixes: ['/blog', '/de/blog'],
      excludePaths: ['/blog/how-to-plan-multi-city-trip'],
    });
    expect(filteredBlog.some((pathname) => pathname.startsWith('/blog'))).toBe(true);
    expect(filteredBlog).not.toContain('/blog/how-to-plan-multi-city-trip');
    expect(filteredBlog.every((pathname) => pathname.startsWith('/blog') || pathname.startsWith('/de/blog'))).toBe(true);
  });

  it('normalizes and sanitizes filter options', () => {
    const resolved = resolveSiteOgStaticPathFilterOptions({
      locales: ['DE', 'de', 'xx'],
      includePaths: ['blog', '/blog', '/blog'],
      includePrefixes: ['/blog/', 'inspirations'],
      excludePaths: ['/example/test'],
      excludePrefixes: ['example/', '/example/'],
    });

    expect(resolved.locales).toEqual(['de']);
    expect(resolved.includePaths).toEqual(['/blog']);
    expect(resolved.includePrefixes).toEqual(['/blog', '/inspirations']);
    expect(resolved.excludePaths).toEqual(['/example/test']);
    expect(resolved.excludePrefixes).toEqual(['/example']);
    expect(resolved.hasFilters).toBe(true);
  });
});
