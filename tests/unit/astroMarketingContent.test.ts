import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  getAllMarketingPagePaths,
  resolveMarketingPage,
} from '../../marketing/lib/marketingContent';

describe('Astro marketing content', () => {
  it('generates static, blog, country, and localized page paths', () => {
    const paths = getAllMarketingPagePaths();
    expect(paths).toContain('/');
    expect(paths).toContain('/de/features');
    expect(paths).toContain('/blog/how-to-plan-multi-city-trip');
    expect(paths).toContain('/de/blog/husum-weekend-krokusbluetenfest');
    expect(paths).toContain('/inspirations/country/New%20Zealand');
    expect(paths).toContain('/fa/inspirations/country/New%20Zealand');
  });

  it('resolves static pages with localized metadata and direction', () => {
    expect(resolveMarketingPage('/pricing')).toMatchObject({
      kind: 'pricing',
      locale: 'en',
      dir: 'ltr',
      basePath: '/pricing',
      seo: {
        canonicalPath: '/pricing',
      },
    });
    expect(resolveMarketingPage('/fa/pricing')).toMatchObject({
      kind: 'pricing',
      locale: 'fa',
      dir: 'rtl',
      basePath: '/pricing',
      seo: {
        canonicalPath: '/fa/pricing',
      },
    });
  });

  it('hydrates standardized trip example cards for static rendering', () => {
    const page = resolveMarketingPage('/');
    const examples = page?.payload.examples as Array<Record<string, unknown>>;
    expect(examples).toHaveLength(6);
    expect(examples[0]).toMatchObject({
      templateId: expect.any(String),
      localizedCard: expect.objectContaining({
        title: expect.any(String),
      }),
      daysLabel: expect.any(String),
      citiesLabel: expect.any(String),
      roundTripLabel: expect.any(String),
    });
  });

  it('keeps optimized WebP companions available for static trip cards', () => {
    const page = resolveMarketingPage('/');
    const examples = page?.payload.examples as Array<Record<string, unknown>>;
    const mapImages = examples
      .map((card) => card.mapImagePath)
      .filter((value): value is string => typeof value === 'string' && value.endsWith('.png'));

    expect(mapImages.length).toBeGreaterThan(0);
    for (const mapImagePath of mapImages) {
      expect(existsSync(`public${mapImagePath.replace(/\.png$/, '.webp')}`)).toBe(true);
    }
  });

  it('resolves blog posts with fallback content and canonical metadata', () => {
    const page = resolveMarketingPage('/de/blog/husum-weekend-krokusbluetenfest');
    expect(page).toMatchObject({
      kind: 'blogPost',
      locale: 'de',
      basePath: '/blog/husum-weekend-krokusbluetenfest',
    });
    expect(page?.payload.contentHtml).toContain('<h');
    expect(page?.seo.canonicalPath).toBe('/de/blog/husum-weekend-krokusbluetenfest');
  });

  it('resolves encoded inspiration country pages', () => {
    const page = resolveMarketingPage('/ur/inspirations/country/New%20Zealand');
    expect(page).toMatchObject({
      kind: 'inspirationsCountry',
      locale: 'ur',
      dir: 'rtl',
      basePath: '/inspirations/country/New%20Zealand',
    });
    expect(page?.seo.canonicalPath).toBe('/ur/inspirations/country/New%20Zealand');
  });
});
