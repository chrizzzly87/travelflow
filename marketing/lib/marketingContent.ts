import { micromark } from 'micromark';
import {
  ASTRO_MARKETING_STATIC_ROUTES,
  DEFAULT_MARKETING_LOCALE,
  SUPPORTED_MARKETING_LOCALES,
  localizeMarketingManifestPath,
  resolveAstroMarketingStaticRoute,
  stripMarketingLocalePrefix,
} from '../../config/marketingRouteManifest.mjs';
import { DEFAULT_LOCALE, localeToDir, localeToHtmlLang, localeToIntlLocale } from '../../config/locales';
import type { AppLanguage } from '../../types';
import { PLAN_CATALOG, PLAN_ORDER } from '../../config/planCatalog';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, ANONYMOUS_TRIP_LIMIT } from '../../config/productLimits';
import { FAQ_SECTIONS } from '../../data/faqContent';
import {
  categories,
  countryGroups,
  festivalEvents,
  getAllDestinations,
  monthEntries,
  quickIdeas,
  weekendGetaways,
} from '../../data/inspirationsData';
import {
  exampleTripCards,
  formatExampleTripCountLabel,
  getExampleTripUiCopy,
  getLocalizedExampleTripCard,
} from '../../data/exampleTripCards';
import { getPublishedBlogPostsAllLocales, getBlogPostBySlugWithFallback, type BlogPost } from '../../services/blogService';
import { getPublishedReleaseNotes, getWebsiteVisibleItems, groupReleaseItemsByType, type ReleaseNote } from '../../services/releaseNotesService';

type MarketingLocale = AppLanguage;
type StaticRoute = (typeof ASTRO_MARKETING_STATIC_ROUTES)[number];

export type MarketingPageKind =
  | StaticRoute['kind']
  | 'blogPost'
  | 'inspirationsCountry';

export interface MarketingSeo {
  title: string;
  description: string;
  canonicalPath: string;
}

export interface MarketingPageData {
  kind: MarketingPageKind;
  locale: MarketingLocale;
  htmlLang: string;
  dir: 'ltr' | 'rtl';
  basePath: string;
  path: string;
  seo: MarketingSeo;
  translations: {
    nav: Record<string, string>;
    common: Record<string, string>;
  };
  payload: Record<string, unknown>;
}

const LOCALE_MODULES = import.meta.glob('../../locales/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

const routePath = (path: string): string => {
  if (!path || path === '/') return '/';
  return path.replace(/\/+$/, '') || '/';
};

const getLocaleNamespace = (locale: MarketingLocale, namespace: string): Record<string, unknown> => {
  const direct = LOCALE_MODULES[`../../locales/${locale}/${namespace}.json`];
  if (direct) return direct;
  return LOCALE_MODULES[`../../locales/${DEFAULT_LOCALE}/${namespace}.json`] || {};
};

const getNested = (source: Record<string, unknown>, key: string): unknown => {
  return key.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
};

const interpolate = (value: string, vars?: Record<string, string | number | null | undefined>): string => {
  if (!vars) return value;
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const replacement = vars[key];
    return replacement === null || replacement === undefined ? match : String(replacement);
  });
};

export const t = (
  locale: MarketingLocale,
  namespace: string,
  key: string,
  fallback = '',
  vars?: Record<string, string | number | null | undefined>,
): string => {
  const value = getNested(getLocaleNamespace(locale, namespace), key);
  if (typeof value === 'string') return interpolate(value, vars);
  const fallbackValue = getNested(getLocaleNamespace(DEFAULT_LOCALE, namespace), key);
  return interpolate(typeof fallbackValue === 'string' ? fallbackValue : fallback, vars);
};

const tObject = <T>(locale: MarketingLocale, namespace: string, key: string, fallback: T): T => {
  const value = getNested(getLocaleNamespace(locale, namespace), key);
  if (value !== undefined) return value as T;
  const fallbackValue = getNested(getLocaleNamespace(DEFAULT_LOCALE, namespace), key);
  return fallbackValue !== undefined ? fallbackValue as T : fallback;
};

const titleWithBrand = (title: string): string =>
  title.includes('TravelFlow') ? title : `${title} | TravelFlow`;

export const localizedPath = (basePath: string, locale: MarketingLocale): string =>
  localizeMarketingManifestPath(basePath, locale);

export const appPath = (basePath: string, locale: MarketingLocale): string =>
  locale === DEFAULT_MARKETING_LOCALE ? basePath : `/${locale}${basePath === '/' ? '' : basePath}`;

const staticPageSeo = (route: StaticRoute, locale: MarketingLocale): MarketingSeo => {
  const basePath = route.path;
  if (route.key === 'home') {
    return {
      title: titleWithBrand('TravelFlow'),
      description: t(locale, 'home', 'hero.description', 'Plan and share travel routes with timeline and map previews.'),
      canonicalPath: localizedPath('/', locale),
    };
  }
  if (route.key === 'features') {
    return {
      title: titleWithBrand(`${t(locale, 'features', 'hero.titleBefore', 'Features')} ${t(locale, 'features', 'hero.titleHighlight', '')}`.trim()),
      description: t(locale, 'features', 'hero.description', 'Plan, refine, and share trips with TravelFlow.'),
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  if (route.key === 'pricing') {
    return {
      title: titleWithBrand(t(locale, 'pricing', 'hero.title', 'Pricing')),
      description: t(locale, 'pricing', 'hero.description', 'Simple, transparent pricing for TravelFlow.'),
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  if (route.key === 'faq') {
    return {
      title: titleWithBrand('FAQ'),
      description: 'Answers to common TravelFlow planning, support, billing, and privacy questions.',
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  if (route.key === 'updates') {
    return {
      title: titleWithBrand(t(locale, 'pages', 'updates.title', 'News & Updates')),
      description: 'Latest product updates and improvements from TravelFlow.',
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  if (route.key === 'blog') {
    return {
      title: titleWithBrand('Travel planning blog'),
      description: 'Guides for smarter city routes, seasonal travel, festivals, weekend trips, and budget planning.',
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  if (route.key === 'inspirations') {
    return {
      title: titleWithBrand(t(locale, 'pages', 'inspirations.hero.title', 'Trip inspirations')),
      description: t(locale, 'pages', 'inspirations.hero.description', 'Browse curated trip ideas by theme, month, country, or upcoming festivals.'),
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  if (route.kind === 'inspirationsSubpage') {
    const subpageKeyByPath: Record<string, string> = {
      '/inspirations/themes': 'themes',
      '/inspirations/best-time-to-travel': 'bestTime',
      '/inspirations/countries': 'countries',
      '/inspirations/events-and-festivals': 'festivals',
      '/inspirations/weekend-getaways': 'weekendGetaways',
    };
    const subpageKey = subpageKeyByPath[basePath] || 'themes';
    return {
      title: titleWithBrand(t(locale, 'pages', `inspirations.subpages.${subpageKey}.title`, 'Trip inspiration')),
      description: t(locale, 'pages', `inspirations.subpages.${subpageKey}.description`, 'Curated trip inspiration for your next route.'),
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  if (route.key === 'contact') {
    return {
      title: titleWithBrand(t(locale, 'common', 'contact.title', 'Contact')),
      description: 'Contact TravelFlow for support, billing, privacy, partnership, and product feedback.',
      canonicalPath: localizedPath(basePath, locale),
    };
  }
  const legalTitleByKey: Record<string, string> = {
    imprint: t(locale, 'legal', 'imprint.title', 'Imprint'),
    privacy: t(locale, 'legal', 'privacy.title', 'Privacy Policy'),
    terms: t(locale, 'legal', 'terms.title', 'Terms of Service'),
    cookies: t(locale, 'legal', 'cookies.title', 'Cookie Policy'),
  };
  return {
    title: titleWithBrand(legalTitleByKey[route.key] || route.key),
    description: 'TravelFlow legal and compliance information.',
    canonicalPath: localizedPath(basePath, locale),
  };
};

const buildBasePage = (
  kind: MarketingPageKind,
  locale: MarketingLocale,
  basePath: string,
  seo: MarketingSeo,
  payload: Record<string, unknown>,
): MarketingPageData => ({
  kind,
  locale,
  htmlLang: localeToHtmlLang(locale),
  dir: localeToDir(locale),
  basePath,
  path: localizedPath(basePath, locale),
  seo,
  translations: {
    nav: {
      features: t(locale, 'common', 'nav.features', 'Features'),
      inspirations: t(locale, 'common', 'nav.inspirations', 'Inspirations'),
      updates: t(locale, 'common', 'nav.updates', 'Updates'),
      blog: t(locale, 'common', 'nav.blog', 'Blog'),
      pricing: t(locale, 'common', 'nav.pricing', 'Pricing'),
      myTrips: t(locale, 'common', 'nav.myTrips', 'My trips'),
      startPlanning: t(locale, 'common', 'buttons.startPlanning', 'Start planning'),
    },
    common: {
      seeExampleTrips: t(locale, 'common', 'buttons.seeExampleTrips', 'See example trips'),
      startPlanning: t(locale, 'common', 'buttons.startPlanning', 'Start planning'),
      readMore: t(locale, 'common', 'buttons.readMore', 'Read more'),
      privacy: t(locale, 'common', 'privacy', 'Privacy'),
      terms: t(locale, 'common', 'terms', 'Terms'),
    },
  },
  payload,
});

const buildPlanFeatures = (locale: MarketingLocale, publicSlug: string, tier: typeof PLAN_CATALOG[keyof typeof PLAN_CATALOG]): string[] => {
  const unlimitedLabel = t(locale, 'pricing', 'shared.unlimited', 'Unlimited');
  const noExpiryLabel = t(locale, 'pricing', 'shared.noExpiry', 'No expiry');
  const enabledLabel = t(locale, 'pricing', 'shared.enabled', 'Included');
  const disabledLabel = t(locale, 'pricing', 'shared.disabled', 'Not included');
  const templates = tObject<string[]>(locale, 'pricing', `tiers.${publicSlug}.features`, []);
  const values = {
    maxActiveTripsLabel: tier.entitlements.maxActiveTrips === null ? unlimitedLabel : tier.entitlements.maxActiveTrips,
    maxTotalTripsLabel: tier.entitlements.maxTotalTrips === null ? unlimitedLabel : tier.entitlements.maxTotalTrips,
    tripExpirationLabel: tier.entitlements.tripExpirationDays === null
      ? noExpiryLabel
      : t(locale, 'pricing', 'shared.days', '{count} days', { count: tier.entitlements.tripExpirationDays }),
    sharingLabel: tier.entitlements.canShare ? enabledLabel : disabledLabel,
    editableSharesLabel: tier.entitlements.canCreateEditableShares ? enabledLabel : disabledLabel,
    proCreationLabel: tier.entitlements.canCreateProTrips ? enabledLabel : disabledLabel,
  };
  return templates.map((template) => interpolate(template, values));
};

const buildStaticPayload = (route: StaticRoute, locale: MarketingLocale): Record<string, unknown> => {
  if (route.kind === 'home') {
    const uiCopy = getExampleTripUiCopy(locale);
    return {
      hero: {
        badge: t(locale, 'home', 'hero.badge', 'AI-Powered Trip Planning'),
        titleBefore: t(locale, 'home', 'hero.titleBefore', 'Your next adventure, planned'),
        titleHighlight: t(locale, 'home', 'hero.titleHighlight', 'in seconds'),
        description: t(locale, 'home', 'hero.description', 'Tell us where you want to go and when.'),
      },
      examples: exampleTripCards.slice(0, 6).map((card) => ({
        ...card,
        localizedCard: getLocalizedExampleTripCard(card, locale),
        daysLabel: formatExampleTripCountLabel(locale, uiCopy.days, card.durationDays),
        citiesLabel: formatExampleTripCountLabel(locale, uiCopy.cities, card.cityCount),
        roundTripLabel: uiCopy.roundTrip,
      })),
      sections: [
        t(locale, 'home', 'featureShowcase.items.aiTripCreation.title', 'AI Trip Creation'),
        t(locale, 'home', 'featureShowcase.items.interactiveMapStyles.title', 'Interactive Map Styles'),
        t(locale, 'home', 'featureShowcase.items.easyItineraryAdjustments.title', 'Easy Itinerary Adjustments'),
      ].map((title, index) => ({
        title,
        description: [
          t(locale, 'home', 'featureShowcase.items.aiTripCreation.description', ''),
          t(locale, 'home', 'featureShowcase.items.interactiveMapStyles.description', ''),
          t(locale, 'home', 'featureShowcase.items.easyItineraryAdjustments.description', ''),
        ][index],
      })),
      cta: {
        title: t(locale, 'home', 'cta.title', 'Ready to plan your next trip?'),
        subtitle: t(locale, 'home', 'cta.subtitle', ''),
      },
    };
  }

  if (route.kind === 'features') {
    return {
      hero: {
        titleBefore: t(locale, 'features', 'hero.titleBefore', 'Build trips that already feel'),
        titleHighlight: t(locale, 'features', 'hero.titleHighlight', 'ready to go'),
        description: t(locale, 'features', 'hero.description', ''),
        primaryCta: t(locale, 'features', 'hero.primaryCta', 'Start planning'),
        secondaryCta: t(locale, 'features', 'hero.secondaryCta', 'See example trips'),
      },
      proof: tObject<string[]>(locale, 'features', 'hero.proof', []),
      bentoItems: tObject<Array<{ title: string; description: string; detail?: string }>>(locale, 'features', 'bento.items', []),
      workflowSteps: tObject<Array<{ step: string; title: string; description: string }>>(locale, 'features', 'workflow.steps', []),
    };
  }

  if (route.kind === 'pricing') {
    return {
      hero: {
        title: t(locale, 'pricing', 'hero.title', 'Simple, transparent pricing'),
        description: t(locale, 'pricing', 'hero.description', ''),
      },
      plans: PLAN_ORDER.map((tierKey) => {
        const tier = PLAN_CATALOG[tierKey];
        return {
          key: tier.key,
          publicSlug: tier.publicSlug,
          name: t(locale, 'pricing', `tiers.${tier.publicSlug}.name`, tier.publicName),
          badge: t(locale, 'pricing', `tiers.${tier.publicSlug}.badge`, ''),
          description: t(locale, 'pricing', `tiers.${tier.publicSlug}.description`, ''),
          price: tier.monthlyPriceUsd,
          cta: tier.monthlyPriceUsd === 0
            ? t(locale, 'pricing', `tiers.${tier.publicSlug}.cta`, 'Start')
            : t(locale, 'pricing', `tiers.${tier.publicSlug}.cta`, 'Continue to checkout'),
          features: buildPlanFeatures(locale, tier.publicSlug, tier),
          highlighted: tier.publicSlug === 'explorer',
        };
      }),
      anonymousLimits: {
        title: t(locale, 'pricing', 'anonymousLimits.title', 'Anonymous access limits'),
        description: t(locale, 'pricing', 'anonymousLimits.description', '', {
          limit: ANONYMOUS_TRIP_LIMIT,
          days: ANONYMOUS_TRIP_EXPIRATION_DAYS,
        }),
        footer: t(locale, 'pricing', 'anonymousLimits.footer', ''),
      },
    };
  }

  if (route.kind === 'faq') {
    return { sections: FAQ_SECTIONS };
  }

  if (route.kind === 'updates') {
    return {
      releases: getPublishedReleaseNotes().slice(0, 18).map((release) => ({
        ...release,
        websiteItems: getWebsiteVisibleItems(release),
        groups: groupReleaseItemsByType(getWebsiteVisibleItems(release)),
      })),
    };
  }

  if (route.kind === 'blog') {
    const posts = getPublishedBlogPostsAllLocales()
      .filter((post) => post.language === locale || (locale !== DEFAULT_LOCALE && post.language === DEFAULT_LOCALE))
      .slice(0, 24);
    return { posts };
  }

  if (route.kind === 'inspirations') {
    return {
      hero: {
        pill: t(locale, 'pages', 'inspirations.hero.pill', 'Trip Inspirations'),
        title: t(locale, 'pages', 'inspirations.hero.title', 'Where will you go next?'),
        description: t(locale, 'pages', 'inspirations.hero.description', ''),
      },
      categories,
      destinations: getAllDestinations().slice(0, 9),
      monthEntries,
      festivalEvents: festivalEvents.slice(0, 8),
      weekendGetaways: weekendGetaways.slice(0, 6),
      countryGroups,
      quickIdeas,
    };
  }

  if (route.kind === 'inspirationsSubpage') {
    const subpageKeyByPath: Record<string, string> = {
      '/inspirations/themes': 'themes',
      '/inspirations/best-time-to-travel': 'bestTime',
      '/inspirations/countries': 'countries',
      '/inspirations/events-and-festivals': 'festivals',
      '/inspirations/weekend-getaways': 'weekendGetaways',
    };
    const subpageKey = subpageKeyByPath[route.path] || 'themes';
    return {
      subpageKey,
      pill: t(locale, 'pages', `inspirations.subpages.${subpageKey}.pill`, 'Trip inspiration'),
      title: t(locale, 'pages', `inspirations.subpages.${subpageKey}.title`, 'Trip inspiration'),
      description: t(locale, 'pages', `inspirations.subpages.${subpageKey}.description`, ''),
      comingSoon: t(locale, 'pages', 'inspirations.subpages.comingSoon', 'Coming soon'),
      comingSoonDescription: t(locale, 'pages', `inspirations.subpages.${subpageKey}.comingSoonDescription`, ''),
    };
  }

  if (route.kind === 'contact') {
    return {
      title: t(locale, 'common', 'contact.title', 'Contact TravelFlow'),
      description: t(locale, 'common', 'contact.description', 'Tell us what is going on and we will route it to the right place.'),
      faqItems: FAQ_SECTIONS.flatMap((section) => section.items.slice(0, 2).map((item) => ({ ...item, sectionTitle: section.title }))).slice(0, 6),
    };
  }

  if (route.kind === 'legal') {
    const legalKey = route.key === 'privacy' ? 'privacy' : route.key === 'terms' ? 'terms' : route.key === 'cookies' ? 'cookies' : 'imprint';
    return {
      legalKey,
      title: t(locale, 'legal', `${legalKey}.title`, staticPageSeo(route, locale).title.replace(' | TravelFlow', '')),
      description: t(locale, 'legal', `${legalKey}.intro`, 'Legal information for TravelFlow.'),
      sections: [
        'Operator and contact details',
        'Use of the service',
        'Privacy, cookies, and browser storage',
        'Questions or requests',
      ],
    };
  }

  return {};
};

export const resolveStaticMarketingPage = (path: string): MarketingPageData | null => {
  const route = resolveAstroMarketingStaticRoute(path);
  if (!route) return null;
  const locale = route.locale as MarketingLocale;
  const seo = staticPageSeo(route, locale);
  return buildBasePage(route.kind, locale, route.path, seo, buildStaticPayload(route, locale));
};

const buildBlogPostPage = (path: string): MarketingPageData | null => {
  const { locale, basePath } = stripMarketingLocalePrefix(path);
  const match = basePath.match(/^\/blog\/([^/]+)$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  const post = getBlogPostBySlugWithFallback(slug, locale as MarketingLocale)
    || getPublishedBlogPostsAllLocales().find((entry) => entry.slug === slug);
  if (!post) return null;
  const postPath = `/blog/${encodeURIComponent(post.slug)}`;
  const canonicalPath = localizedPath(postPath, post.language);
  return buildBasePage('blogPost', locale as MarketingLocale, postPath, {
    title: titleWithBrand(post.title),
    description: post.summary,
    canonicalPath,
  }, {
    post,
    contentHtml: micromark(post.content),
    relatedPosts: getPublishedBlogPostsAllLocales()
      .filter((entry) => entry.slug !== post.slug && entry.language === post.language)
      .slice(0, 3),
  });
};

const buildCountryPage = (path: string): MarketingPageData | null => {
  const { locale, basePath } = stripMarketingLocalePrefix(path);
  const match = basePath.match(/^\/inspirations\/country\/([^/]+)$/);
  if (!match) return null;
  const decodedCountry = decodeURIComponent(match[1]);
  const country = countryGroups.find((entry) => entry.country.toLowerCase() === decodedCountry.toLowerCase());
  if (!country) return null;
  const countryPath = `/inspirations/country/${encodeURIComponent(country.country)}`;
  return buildBasePage('inspirationsCountry', locale as MarketingLocale, countryPath, {
    title: titleWithBrand(t(locale as MarketingLocale, 'pages', 'inspirations.subpages.country.title', `Travel to ${country.country}`, { country: country.country })),
    description: t(locale as MarketingLocale, 'pages', 'inspirations.subpages.country.description', '', { country: country.country }),
    canonicalPath: localizedPath(countryPath, locale as MarketingLocale),
  }, {
    country,
    pill: t(locale as MarketingLocale, 'pages', 'inspirations.subpages.country.pill', 'Country Guide'),
    comingSoon: t(locale as MarketingLocale, 'pages', 'inspirations.subpages.comingSoon', 'Coming soon'),
    comingSoonDescription: t(locale as MarketingLocale, 'pages', 'inspirations.subpages.country.comingSoonDescription', '', { country: country.country }),
    cta: t(locale as MarketingLocale, 'pages', 'inspirations.subpages.country.cta', `Plan a trip to ${country.country}`, { country: country.country }),
  });
};

export const resolveMarketingPage = (path: string): MarketingPageData | null =>
  resolveStaticMarketingPage(path) || buildBlogPostPage(path) || buildCountryPage(path);

export const getAllMarketingPagePaths = (): string[] => {
  const staticPaths = ASTRO_MARKETING_STATIC_ROUTES.flatMap((route) =>
    SUPPORTED_MARKETING_LOCALES.map((locale) => localizedPath(route.path, locale as MarketingLocale))
  );
  const blogSlugs = Array.from(new Set(getPublishedBlogPostsAllLocales().map((post) => post.slug)));
  const blogPaths = blogSlugs.flatMap((slug) =>
    SUPPORTED_MARKETING_LOCALES.map((locale) => localizedPath(`/blog/${encodeURIComponent(slug)}`, locale as MarketingLocale))
  );
  const countryPaths = countryGroups.flatMap((country) =>
    SUPPORTED_MARKETING_LOCALES.map((locale) => localizedPath(`/inspirations/country/${encodeURIComponent(country.country)}`, locale as MarketingLocale))
  );
  return Array.from(new Set([...staticPaths, ...blogPaths, ...countryPaths])).sort();
};

export const formatDate = (value: string, locale: MarketingLocale): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(localeToIntlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
