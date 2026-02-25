import { describe, expect, it } from 'vitest';
import {
  buildLocalizedCreateTripPath,
  buildLocalizedMarketingPath,
  buildPath,
  extractLocaleFromPath,
  getBlogSlugFromPath,
  getNamespacesForMarketingPath,
  getNamespacesForToolPath,
  isLocalizedMarketingPath,
  isOnboardingExemptPath,
  isToolRoute,
  localizeMarketingPath,
  stripLocalePrefix,
} from '../../config/routes';

describe('config/routes', () => {
  it('builds static and param routes', () => {
    expect(buildPath('home')).toBe('/');
    expect(buildPath('imprint')).toBe('/imprint');
    expect(buildPath('blogPost', { slug: 'spring-guide' })).toBe('/blog/spring-guide');
    expect(buildPath('tripDetail', { tripId: 'abc 123' })).toBe('/trip/abc%20123');
  });

  it('buildPath handles all declared route keys', () => {
    const routeResults = [
      buildPath('home'),
      buildPath('features'),
      buildPath('inspirations'),
      buildPath('inspirationsThemes'),
      buildPath('inspirationsBestTime'),
      buildPath('inspirationsCountries'),
      buildPath('inspirationsFestivals'),
      buildPath('inspirationsWeekendGetaways'),
      buildPath('inspirationsCountryDetail', { countryName: 'Costa Rica' }),
      buildPath('updates'),
      buildPath('blog'),
      buildPath('blogPost', { slug: 'sample-post' }),
      buildPath('pricing'),
      buildPath('faq'),
      buildPath('shareUnavailable'),
      buildPath('login'),
      buildPath('contact'),
      buildPath('imprint'),
      buildPath('privacy'),
      buildPath('terms'),
      buildPath('cookies'),
      buildPath('createTrip'),
      buildPath('createTripClassicLab'),
      buildPath('createTripClassicLegacyLab'),
      buildPath('createTripSplitWorkspaceLab'),
      buildPath('createTripJourneyArchitectLab'),
      buildPath('createTripDesignV1Lab'),
      buildPath('createTripDesignV2Lab'),
      buildPath('createTripDesignV3Lab'),
      buildPath('tripDetail', { tripId: 'trip-id' }),
      buildPath('tripLegacy'),
      buildPath('exampleTrip', { templateId: 'template-id' }),
      buildPath('shareTrip', { token: 'token-id' }),
      buildPath('adminDashboard'),
      buildPath('adminUsers'),
      buildPath('adminTrips'),
      buildPath('adminTiers'),
      buildPath('adminAudit'),
      buildPath('adminAiBenchmark'),
      buildPath('profile'),
      buildPath('profileSettings'),
      buildPath('profileOnboarding'),
    ];

    expect(routeResults.every((path) => path.startsWith('/'))).toBe(true);
  });

  it('localizes marketing and create-trip paths correctly', () => {
    expect(buildLocalizedMarketingPath('home', 'de')).toBe('/de');
    expect(buildLocalizedMarketingPath('blog', 'fr')).toBe('/fr/blog');
    expect(buildLocalizedMarketingPath('createTrip', 'fr')).toBe('/create-trip');
    expect(buildLocalizedCreateTripPath('fr')).toBe('/fr/create-trip');
  });

  it('extracts and strips locale prefixes', () => {
    expect(extractLocaleFromPath('/de/blog')).toBe('de');
    expect(extractLocaleFromPath('/blog')).toBeNull();
    expect(stripLocalePrefix('/fr/blog/post')).toBe('/blog/post');
    expect(stripLocalePrefix('/')).toBe('/');
  });

  it('detects tool routes and marketing routes', () => {
    expect(isToolRoute('/create-trip')).toBe(true);
    expect(isToolRoute('/de/create-trip')).toBe(true);
    expect(isToolRoute('/features')).toBe(false);

    expect(isLocalizedMarketingPath('/de/features')).toBe(true);
    expect(isLocalizedMarketingPath('/imprint')).toBe(true);
    expect(isLocalizedMarketingPath('/impressum')).toBe(false);
    expect(isLocalizedMarketingPath('/trip/abc')).toBe(false);
  });

  it('localizes marketing paths with safe fallback', () => {
    expect(localizeMarketingPath('/features', 'it')).toBe('/it/features');
    expect(localizeMarketingPath('/de/blog/spring-guide', 'fr')).toBe('/fr/blog/spring-guide');
    expect(localizeMarketingPath('/trip/abc', 'fr')).toBe('/fr');
  });

  it('resolves blog slugs and namespaces', () => {
    expect(getBlogSlugFromPath('/de/blog/spring-guide')).toBe('spring-guide');
    expect(getBlogSlugFromPath('/features')).toBeNull();

    expect(getNamespacesForMarketingPath('/')).toEqual(['common', 'home']);
    expect(getNamespacesForMarketingPath('/features')).toEqual(['common', 'features']);
    expect(getNamespacesForMarketingPath('/pricing')).toEqual(['common', 'pricing']);
    expect(getNamespacesForMarketingPath('/de/blog/spring-guide')).toEqual(['common', 'blog']);
    expect(getNamespacesForMarketingPath('/terms')).toEqual(['common', 'legal']);
    expect(getNamespacesForMarketingPath('/faq')).toEqual(['common', 'wip']);
    expect(getNamespacesForMarketingPath('/login')).toEqual(['common', 'auth']);
    expect(getNamespacesForMarketingPath('/inspirations')).toEqual(['common', 'pages']);
    expect(getNamespacesForToolPath('/create-trip')).toEqual(['common', 'createTrip']);
    expect(getNamespacesForToolPath('/profile?tab=recent')).toEqual(['common', 'profile']);
    expect(getNamespacesForToolPath('/trip/abc')).toEqual(['common']);
  });

  it('marks onboarding-exempt paths', () => {
    expect(isOnboardingExemptPath('/create-trip')).toBe(true);
    expect(isOnboardingExemptPath('/de/example/demo')).toBe(true);
    expect(isOnboardingExemptPath('/de/blog')).toBe(false);
  });
});
