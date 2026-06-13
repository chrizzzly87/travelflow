import { describe, expect, it } from 'vitest';

import { getCriticalRouteModuleKeys } from '../../services/criticalRoutePreload';

describe('criticalRoutePreload', () => {
  it('does not preload React chunks for direct Astro marketing entry', () => {
    expect(getCriticalRouteModuleKeys('/')).toEqual([]);
    expect(getCriticalRouteModuleKeys('/de')).toEqual([]);
    expect(getCriticalRouteModuleKeys('/pricing')).toEqual([]);
    expect(getCriticalRouteModuleKeys('/de/features')).toEqual([]);
    expect(getCriticalRouteModuleKeys('/inspirations/themes')).toEqual([]);
  });

  it('preloads direct tool entry routes', () => {
    expect(getCriticalRouteModuleKeys('/trip/abc')).toEqual(['TripLoaderRoute']);
    expect(getCriticalRouteModuleKeys('/s/token')).toEqual(['SharedTripLoaderRoute']);
    expect(getCriticalRouteModuleKeys('/example/demo')).toEqual(['ExampleTripLoaderRoute']);
    expect(getCriticalRouteModuleKeys('/create-trip')).toEqual(['CreateTripClassicLabPage']);
    expect(getCriticalRouteModuleKeys('/de/create-trip/wizard')).toEqual(['CreateTripV3Page']);
  });

  it('preloads app-owned deferred public routes', () => {
    expect(getCriticalRouteModuleKeys('/login')).toEqual(['DeferredAppRoutes', 'LoginPage']);
    expect(getCriticalRouteModuleKeys('/de/login')).toEqual(['DeferredAppRoutes', 'LoginPage']);
    expect(getCriticalRouteModuleKeys('/share-unavailable')).toEqual(['DeferredAppRoutes', 'ShareUnavailablePage']);
    expect(getCriticalRouteModuleKeys('/auth/reset-password')).toEqual(['DeferredAppRoutes', 'ResetPasswordPage']);
  });
});
