import { stripLocalePrefix } from '../config/routes';

type CriticalRouteModuleKey =
  | 'DeferredAppRoutes'
  | 'MarketingHomePage'
  | 'FeaturesPage'
  | 'UpdatesPage'
  | 'BlogPage'
  | 'PricingPage'
  | 'FaqPage'
  | 'LoginPage'
  | 'ContactPage'
  | 'ImprintPage'
  | 'PrivacyPage'
  | 'TermsPage'
  | 'CookiesPage'
  | 'CreateTripClassicLabPage'
  | 'CreateTripV3Page'
  | 'TripLoaderRoute'
  | 'SharedTripLoaderRoute'
  | 'ExampleTripLoaderRoute';

const MARKETING_PAGE_BY_PATH: Array<{ pattern: RegExp; key: CriticalRouteModuleKey }> = [
  { pattern: /^\/$/, key: 'MarketingHomePage' },
  { pattern: /^\/features$/, key: 'FeaturesPage' },
  { pattern: /^\/updates$/, key: 'UpdatesPage' },
  { pattern: /^\/blog$/, key: 'BlogPage' },
  { pattern: /^\/pricing$/, key: 'PricingPage' },
  { pattern: /^\/faq$/, key: 'FaqPage' },
  { pattern: /^\/login$/, key: 'LoginPage' },
  { pattern: /^\/contact$/, key: 'ContactPage' },
  { pattern: /^\/imprint$/, key: 'ImprintPage' },
  { pattern: /^\/privacy$/, key: 'PrivacyPage' },
  { pattern: /^\/terms$/, key: 'TermsPage' },
  { pattern: /^\/cookies$/, key: 'CookiesPage' },
];

const ROUTE_IMPORTERS: Record<CriticalRouteModuleKey, () => Promise<unknown>> = {
  DeferredAppRoutes: () => import('../app/routes/DeferredAppRoutes'),
  MarketingHomePage: () => import('../pages/MarketingHomePage'),
  FeaturesPage: () => import('../pages/FeaturesPage'),
  UpdatesPage: () => import('../pages/UpdatesPage'),
  BlogPage: () => import('../pages/BlogPage'),
  PricingPage: () => import('../pages/PricingPage'),
  FaqPage: () => import('../pages/FaqPage'),
  LoginPage: () => import('../pages/LoginPage'),
  ContactPage: () => import('../pages/ContactPage'),
  ImprintPage: () => import('../pages/ImprintPage'),
  PrivacyPage: () => import('../pages/PrivacyPage'),
  TermsPage: () => import('../pages/TermsPage'),
  CookiesPage: () => import('../pages/CookiesPage'),
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

  const marketingMatch = MARKETING_PAGE_BY_PATH.find(({ pattern }) => pattern.test(normalizedPath));
  if (marketingMatch) {
    return ['DeferredAppRoutes', marketingMatch.key];
  }

  if (normalizedPath.startsWith('/features') || normalizedPath.startsWith('/inspirations') || normalizedPath.startsWith('/blog') || normalizedPath.startsWith('/pricing') || normalizedPath.startsWith('/faq') || normalizedPath.startsWith('/login') || normalizedPath.startsWith('/contact') || normalizedPath.startsWith('/imprint') || normalizedPath.startsWith('/privacy') || normalizedPath.startsWith('/terms') || normalizedPath.startsWith('/cookies') || normalizedPath.startsWith('/updates')) {
    return ['DeferredAppRoutes'];
  }

  return [];
};

export const preloadCriticalRouteModules = (pathname: string): void => {
  const keys = getCriticalRouteModuleKeys(pathname);
  for (const key of keys) {
    void ROUTE_IMPORTERS[key]();
  }
};
