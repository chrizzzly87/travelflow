export const DEFAULT_MARKETING_LOCALE = 'en';

export const SUPPORTED_MARKETING_LOCALES = [
  'en',
  'es',
  'de',
  'fr',
  'pt',
  'ru',
  'it',
  'pl',
  'ko',
  'fa',
  'ur',
];

export const RTL_MARKETING_LOCALES = ['fa', 'ur'];

export const ASTRO_MARKETING_STATIC_ROUTES = [
  { key: 'home', path: '/', kind: 'home', indexable: true },
  { key: 'features', path: '/features', kind: 'features', indexable: true },
  { key: 'inspirations', path: '/inspirations', kind: 'inspirations', indexable: true },
  { key: 'inspirationsThemes', path: '/inspirations/themes', kind: 'inspirationsSubpage', indexable: true },
  { key: 'inspirationsBestTime', path: '/inspirations/best-time-to-travel', kind: 'inspirationsSubpage', indexable: true },
  { key: 'inspirationsCountries', path: '/inspirations/countries', kind: 'inspirationsSubpage', indexable: true },
  { key: 'inspirationsFestivals', path: '/inspirations/events-and-festivals', kind: 'inspirationsSubpage', indexable: true },
  { key: 'inspirationsWeekendGetaways', path: '/inspirations/weekend-getaways', kind: 'inspirationsSubpage', indexable: true },
  { key: 'updates', path: '/updates', kind: 'updates', indexable: true },
  { key: 'blog', path: '/blog', kind: 'blog', indexable: true },
  { key: 'pricing', path: '/pricing', kind: 'pricing', indexable: true },
  { key: 'faq', path: '/faq', kind: 'faq', indexable: true },
  { key: 'contact', path: '/contact', kind: 'contact', indexable: true },
  { key: 'imprint', path: '/imprint', kind: 'legal', indexable: true },
  { key: 'privacy', path: '/privacy', kind: 'legal', indexable: true },
  { key: 'terms', path: '/terms', kind: 'legal', indexable: true },
  { key: 'cookies', path: '/cookies', kind: 'legal', indexable: true },
];

const normalizePath = (pathname) => {
  if (!pathname || pathname === '/') return '/';
  const [pathOnly] = pathname.split(/[?#]/);
  const normalized = pathOnly.replace(/\/+$/, '');
  return normalized || '/';
};

export const isSupportedMarketingLocale = (value) =>
  SUPPORTED_MARKETING_LOCALES.includes(value);

export const localizeMarketingManifestPath = (basePath, locale = DEFAULT_MARKETING_LOCALE) => {
  const normalizedBasePath = normalizePath(basePath);
  if (locale === DEFAULT_MARKETING_LOCALE) return normalizedBasePath;
  return normalizedBasePath === '/' ? `/${locale}` : `/${locale}${normalizedBasePath}`;
};

export const stripMarketingLocalePrefix = (pathname) => {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/').filter(Boolean);
  const candidate = segments[0];
  if (!isSupportedMarketingLocale(candidate) || candidate === DEFAULT_MARKETING_LOCALE) {
    return { locale: DEFAULT_MARKETING_LOCALE, basePath: normalized };
  }

  const basePath = `/${segments.slice(1).join('/')}`;
  return {
    locale: candidate,
    basePath: basePath === '/' ? '/' : normalizePath(basePath),
  };
};

export const getAstroMarketingStaticBasePaths = () =>
  ASTRO_MARKETING_STATIC_ROUTES.map((route) => route.path);

export const getAstroMarketingLocalizedStaticPaths = () =>
  ASTRO_MARKETING_STATIC_ROUTES.flatMap((route) =>
    SUPPORTED_MARKETING_LOCALES.map((locale) =>
      localizeMarketingManifestPath(route.path, locale)
    )
  );

export const resolveAstroMarketingStaticRoute = (pathname) => {
  const { locale, basePath } = stripMarketingLocalePrefix(pathname);
  const route = ASTRO_MARKETING_STATIC_ROUTES.find((entry) => entry.path === basePath);
  return route ? { ...route, locale, localizedPath: normalizePath(pathname), basePath } : null;
};

export const isAstroOwnedMarketingPath = (pathname) => {
  const { basePath } = stripMarketingLocalePrefix(pathname);
  if (ASTRO_MARKETING_STATIC_ROUTES.some((route) => route.path === basePath)) return true;
  if (/^\/blog\/[^/]+$/.test(basePath)) return true;
  if (/^\/inspirations\/country\/[^/]+$/.test(basePath)) return true;
  return false;
};

export const localeToMarketingDir = (locale) =>
  RTL_MARKETING_LOCALES.includes(locale) ? 'rtl' : 'ltr';
