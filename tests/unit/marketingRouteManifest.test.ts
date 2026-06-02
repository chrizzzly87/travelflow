import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MARKETING_LOCALE,
  SUPPORTED_MARKETING_LOCALES,
  getAstroMarketingLocalizedStaticPaths,
  isAstroOwnedMarketingPath,
  localizeMarketingManifestPath,
  resolveAstroMarketingStaticRoute,
  stripMarketingLocalePrefix,
} from '../../config/marketingRouteManifest.mjs';

describe('marketing route manifest', () => {
  it('keeps English slugs canonical and prefixes non-English locales', () => {
    expect(DEFAULT_MARKETING_LOCALE).toBe('en');
    expect(SUPPORTED_MARKETING_LOCALES).toContain('fa');
    expect(SUPPORTED_MARKETING_LOCALES).toContain('ur');
    expect(localizeMarketingManifestPath('/', 'en')).toBe('/');
    expect(localizeMarketingManifestPath('/', 'de')).toBe('/de');
    expect(localizeMarketingManifestPath('/features', 'en')).toBe('/features');
    expect(localizeMarketingManifestPath('/features', 'de')).toBe('/de/features');
  });

  it('strips locale prefixes without accepting localized slug aliases', () => {
    expect(stripMarketingLocalePrefix('/de/blog/how-to-plan')).toEqual({
      locale: 'de',
      basePath: '/blog/how-to-plan',
    });
    expect(stripMarketingLocalePrefix('/impressum')).toEqual({
      locale: 'en',
      basePath: '/impressum',
    });
  });

  it('resolves static Astro routes and rejects app-shell routes', () => {
    expect(resolveAstroMarketingStaticRoute('/de/pricing')).toMatchObject({
      key: 'pricing',
      locale: 'de',
      basePath: '/pricing',
    });
    expect(resolveAstroMarketingStaticRoute('/create-trip')).toBeNull();
    expect(resolveAstroMarketingStaticRoute('/login')).toBeNull();
  });

  it('marks static and dynamic marketing pages as Astro-owned', () => {
    expect(isAstroOwnedMarketingPath('/')).toBe(true);
    expect(isAstroOwnedMarketingPath('/fa/contact')).toBe(true);
    expect(isAstroOwnedMarketingPath('/blog/how-to-plan-multi-city-trip')).toBe(true);
    expect(isAstroOwnedMarketingPath('/de/inspirations/country/New%20Zealand')).toBe(true);
    expect(isAstroOwnedMarketingPath('/example/thailand-islands')).toBe(false);
    expect(isAstroOwnedMarketingPath('/trip/demo')).toBe(false);
  });

  it('generates localized static paths from one manifest', () => {
    const paths = getAstroMarketingLocalizedStaticPaths();
    expect(paths).toContain('/');
    expect(paths).toContain('/features');
    expect(paths).toContain('/de/features');
    expect(paths).toContain('/fa/privacy');
    expect(paths).not.toContain('/de/impressum');
  });
});
