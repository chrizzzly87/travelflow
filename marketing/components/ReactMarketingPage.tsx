import React from 'react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { TripManagerProvider } from '../../contexts/TripManagerContext';
import { BlogPage } from '../../pages/BlogPage';
import { BlogPostPage } from '../../pages/BlogPostPage';
import { ContactPage } from '../../pages/ContactPage';
import { CookiesPage } from '../../pages/CookiesPage';
import { FaqPage } from '../../pages/FaqPage';
import { FeaturesPage } from '../../pages/FeaturesPage';
import { ImprintPage } from '../../pages/ImprintPage';
import { InspirationsPage } from '../../pages/InspirationsPage';
import { MarketingHomePage } from '../../pages/MarketingHomePage';
import { PricingPage } from '../../pages/PricingPage';
import { PrivacyPage } from '../../pages/PrivacyPage';
import { TermsPage } from '../../pages/TermsPage';
import { UpdatesPage } from '../../pages/UpdatesPage';
import { BestTimeToTravelPage } from '../../pages/inspirations/BestTimeToTravelPage';
import { CountriesPage } from '../../pages/inspirations/CountriesPage';
import { CountryDetailPage } from '../../pages/inspirations/CountryDetailPage';
import { FestivalsPage } from '../../pages/inspirations/FestivalsPage';
import { ThemesPage } from '../../pages/inspirations/ThemesPage';
import { WeekendGetawaysPage } from '../../pages/inspirations/WeekendGetawaysPage';
import type { MarketingPageData } from '../lib/marketingContent';

interface ReactMarketingPageProps {
  page: MarketingPageData;
}

const SUPPORTED_MARKETING_LOCALES = ['en', 'es', 'de', 'fr', 'pt', 'ru', 'it', 'pl', 'ko', 'fa', 'ur'] as const;

const MARKETING_ROUTE_DEFINITIONS: Array<{
  path: string;
  Component: React.ComponentType;
}> = [
  { path: '/', Component: MarketingHomePage },
  { path: '/features', Component: FeaturesPage },
  { path: '/pricing', Component: PricingPage },
  { path: '/faq', Component: FaqPage },
  { path: '/updates', Component: UpdatesPage },
  { path: '/blog', Component: BlogPage },
  { path: '/blog/:slug', Component: BlogPostPage },
  { path: '/inspirations', Component: InspirationsPage },
  { path: '/inspirations/best-time-to-travel', Component: BestTimeToTravelPage },
  { path: '/inspirations/countries', Component: CountriesPage },
  { path: '/inspirations/events-and-festivals', Component: FestivalsPage },
  { path: '/inspirations/themes', Component: ThemesPage },
  { path: '/inspirations/weekend-getaways', Component: WeekendGetawaysPage },
  { path: '/inspirations/country/:countryName', Component: CountryDetailPage },
  { path: '/contact', Component: ContactPage },
  { path: '/imprint', Component: ImprintPage },
  { path: '/privacy', Component: PrivacyPage },
  { path: '/terms', Component: TermsPage },
  { path: '/cookies', Component: CookiesPage },
];

const localizeRoutePattern = (path: string, locale: (typeof SUPPORTED_MARKETING_LOCALES)[number]): string => {
  if (locale === 'en') return path;
  if (path === '/') return `/${locale}`;
  return `/${locale}${path}`;
};

const resolvePageComponent = (page: MarketingPageData): React.ComponentType => {
  if (page.kind === 'legal') {
    if (page.basePath === '/imprint') return ImprintPage;
    if (page.basePath === '/privacy') return PrivacyPage;
    if (page.basePath === '/terms') return TermsPage;
    if (page.basePath === '/cookies') return CookiesPage;
  }

  if (page.kind === 'inspirationsSubpage') {
    if (page.basePath === '/inspirations/best-time-to-travel') return BestTimeToTravelPage;
    if (page.basePath === '/inspirations/countries') return CountriesPage;
    if (page.basePath === '/inspirations/events-and-festivals') return FestivalsPage;
    if (page.basePath === '/inspirations/themes') return ThemesPage;
    if (page.basePath === '/inspirations/weekend-getaways') return WeekendGetawaysPage;
  }

  switch (page.kind) {
    case 'home':
      return MarketingHomePage;
    case 'features':
      return FeaturesPage;
    case 'pricing':
      return PricingPage;
    case 'faq':
      return FaqPage;
    case 'updates':
      return UpdatesPage;
    case 'blog':
      return BlogPage;
    case 'blogPost':
      return BlogPostPage;
    case 'inspirations':
      return InspirationsPage;
    case 'inspirationsCountry':
      return CountryDetailPage;
    case 'contact':
      return ContactPage;
    default:
      return MarketingHomePage;
  }
};

export const ReactMarketingPage: React.FC<ReactMarketingPageProps> = ({ page }) => {
  const PageComponent = resolvePageComponent(page);
  const Router = typeof window === 'undefined' ? MemoryRouter : BrowserRouter;
  const routerProps = typeof window === 'undefined' ? { initialEntries: [page.path] } : {};
  const openTripManager = () => {
    if (typeof window === 'undefined') return;
    const profilePath = page.locale === 'en' ? '/profile' : `/${page.locale}/profile`;
    window.location.assign(profilePath);
  };
  const prewarmTripManager = () => undefined;

  return (
    <Router {...routerProps}>
      <TripManagerProvider openTripManager={openTripManager} prewarmTripManager={prewarmTripManager}>
        <Routes>
          {SUPPORTED_MARKETING_LOCALES.flatMap((locale) => (
            MARKETING_ROUTE_DEFINITIONS.map(({ path, Component }) => (
              <Route
                key={`${locale}:${path}`}
                path={localizeRoutePattern(path, locale)}
                element={<Component />}
              />
            ))
          ))}
          <Route path="*" element={<PageComponent />} />
        </Routes>
      </TripManagerProvider>
    </Router>
  );
};
