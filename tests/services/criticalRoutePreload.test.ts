import { describe, expect, it } from 'vitest';

import { getCriticalRouteModuleKeys } from '../../services/criticalRoutePreload';

describe('criticalRoutePreload', () => {
  it('preloads the homepage route chain for direct marketing entry', () => {
    expect(getCriticalRouteModuleKeys('/')).toEqual(['DeferredAppRoutes', 'MarketingHomePage']);
    expect(getCriticalRouteModuleKeys('/de')).toEqual(['DeferredAppRoutes', 'MarketingHomePage']);
  });

  it('preloads direct tool entry routes', () => {
    expect(getCriticalRouteModuleKeys('/trip/abc')).toEqual(['TripLoaderRoute']);
    expect(getCriticalRouteModuleKeys('/s/token')).toEqual(['SharedTripLoaderRoute']);
    expect(getCriticalRouteModuleKeys('/example/demo')).toEqual(['ExampleTripLoaderRoute']);
    expect(getCriticalRouteModuleKeys('/create-trip')).toEqual(['CreateTripClassicLabPage']);
    expect(getCriticalRouteModuleKeys('/de/create-trip/wizard')).toEqual(['CreateTripV3Page']);
  });

  it('falls back to deferred marketing routing for localized marketing routes', () => {
    expect(getCriticalRouteModuleKeys('/pricing')).toEqual(['DeferredAppRoutes', 'PricingPage']);
    expect(getCriticalRouteModuleKeys('/de/features')).toEqual(['DeferredAppRoutes', 'FeaturesPage']);
    expect(getCriticalRouteModuleKeys('/inspirations/themes')).toEqual(['DeferredAppRoutes']);
  });
});
