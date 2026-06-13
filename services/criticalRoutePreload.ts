import { stripLocalePrefix } from '../config/routes';

type CriticalRouteModuleKey =
  | 'DeferredAppRoutes'
  | 'LoginPage'
  | 'ResetPasswordPage'
  | 'ShareUnavailablePage'
  | 'CreateTripClassicLabPage'
  | 'CreateTripV3Page'
  | 'TripLoaderRoute'
  | 'SharedTripLoaderRoute'
  | 'ExampleTripLoaderRoute';

const APP_PAGE_BY_PATH: Array<{ pattern: RegExp; key: CriticalRouteModuleKey }> = [
  { pattern: /^\/share-unavailable$/, key: 'ShareUnavailablePage' },
  { pattern: /^\/login$/, key: 'LoginPage' },
  { pattern: /^\/auth\/reset-password$/, key: 'ResetPasswordPage' },
];

const ROUTE_IMPORTERS: Record<CriticalRouteModuleKey, () => Promise<unknown>> = {
  DeferredAppRoutes: () => import('../app/routes/DeferredAppRoutes'),
  LoginPage: () => import('../pages/LoginPage'),
  ResetPasswordPage: () => import('../pages/ResetPasswordPage'),
  ShareUnavailablePage: () => import('../pages/ShareUnavailablePage'),
  CreateTripClassicLabPage: () => import('../pages/CreateTripClassicLabPage'),
  CreateTripV3Page: () => import('../pages/CreateTripV3Page'),
  TripLoaderRoute: () => import('../routes/TripLoaderRoute'),
  SharedTripLoaderRoute: () => import('../routes/SharedTripLoaderRoute'),
  ExampleTripLoaderRoute: () => import('../routes/ExampleTripLoaderRoute'),
};

export const getCriticalRouteModuleKeys = (pathname: string): CriticalRouteModuleKey[] => {
  const normalizedPath = stripLocalePrefix(pathname || '/');

  if (/^\/trip\/[^/]+$/.test(normalizedPath)) {
    return ['TripLoaderRoute'];
  }

  if (/^\/s\/[^/]+$/.test(normalizedPath)) {
    return ['SharedTripLoaderRoute'];
  }

  if (/^\/example\/[^/]+$/.test(normalizedPath)) {
    return ['ExampleTripLoaderRoute'];
  }

  if (normalizedPath === '/create-trip/wizard' || normalizedPath === '/create-trip/v3') {
    return ['CreateTripV3Page'];
  }

  if (
    normalizedPath === '/create-trip' ||
    normalizedPath === '/create-trip/labs/classic-card' ||
    normalizedPath === '/create-trip/labs/design-v3' ||
    normalizedPath === '/create-trip/v1' ||
    normalizedPath === '/create-trip/v2'
  ) {
    return ['CreateTripClassicLabPage'];
  }

  const appPageMatch = APP_PAGE_BY_PATH.find(({ pattern }) => pattern.test(normalizedPath));
  if (appPageMatch) {
    return ['DeferredAppRoutes', appPageMatch.key];
  }

  return [];
};

export const preloadCriticalRouteModules = (pathname: string): void => {
  const keys = getCriticalRouteModuleKeys(pathname);
  for (const key of keys) {
    void ROUTE_IMPORTERS[key]();
  }
};
