import React from 'react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
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

const resolveRoutePattern = (page: MarketingPageData): string => {
  const localePrefix = page.locale === 'en' ? '' : `/${page.locale}`;
  if (page.kind === 'blogPost') return `${localePrefix}/blog/:slug`;
  if (page.kind === 'inspirationsCountry') return `${localePrefix}/inspirations/country/:countryName`;
  return page.path;
};

export const ReactMarketingPage: React.FC<ReactMarketingPageProps> = ({ page }) => {
  const PageComponent = resolvePageComponent(page);
  const Router = typeof window === 'undefined' ? MemoryRouter : BrowserRouter;
  const routerProps = typeof window === 'undefined' ? { initialEntries: [page.path] } : {};
  const routePattern = resolveRoutePattern(page);

  return (
    <Router {...routerProps}>
      <Routes>
        <Route path={routePattern} element={<PageComponent />} />
      </Routes>
    </Router>
  );
};
