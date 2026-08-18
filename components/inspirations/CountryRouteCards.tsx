import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarBlank } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../types';
import type { CountryRoute } from '../../shared/countryRoutes';
import {
  buildCountryRouteExampleCard,
  buildCountryRouteMiniCalendar,
  buildCountryRoutePrefillUrl,
  getCountryRoutes,
  getLocalizedCountryRoute,
} from '../../services/countryRouteService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ExampleTripCard } from '../marketing/ExampleTripCard';

interface CountryRouteCardsProps {
  countryValue: string;
  countryName: string;
  locale: AppLanguage;
}

const MONTH_SEED_YEAR = 2026;

const formatBestMonths = (months: number[], locale: AppLanguage): string => {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' });
  const listFormatter = new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' });
  const labels = [...months]
    .sort((left, right) => left - right)
    .map((month) => formatter.format(new Date(MONTH_SEED_YEAR, month - 1, 1)));
  return listFormatter.format(labels);
};

const CountryRouteCard: React.FC<{ route: CountryRoute; locale: AppLanguage }> = ({ route, locale }) => {
  const { t } = useTranslation('pages');
  const card = React.useMemo(() => buildCountryRouteExampleCard(route), [route]);
  const miniCalendar = React.useMemo(() => buildCountryRouteMiniCalendar(route), [route]);
  const prefillUrl = React.useMemo(() => buildCountryRoutePrefillUrl(route), [route]);
  const localized = getLocalizedCountryRoute(route, locale);
  const payload = {
    route_id: route.id,
    country: route.countryCode,
    style: route.style,
    duration_days: route.durationDays,
    stop_count: route.stops.length,
  };

  return (
    <div className="flex flex-col gap-3">
      <Link
        to={prefillUrl}
        onClick={() => trackEvent('inspirations__country_route', payload)}
        className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        aria-label={t('inspirations.subpages.guide.routes.cardLabel', { title: localized.title })}
        {...getAnalyticsDebugAttributes('inspirations__country_route', payload)}
      >
        <ExampleTripCard card={card} miniCalendar={miniCalendar} />
      </Link>
      <div className="px-1">
        <p className="text-sm leading-relaxed text-slate-600">{localized.pitch}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <CalendarBlank size={14} weight="duotone" className="text-accent-600" />
          {t('inspirations.subpages.guide.routes.bestMonths', { months: formatBestMonths(route.bestMonths, locale) })}
        </p>
      </div>
    </div>
  );
};

export const CountryRouteCards: React.FC<CountryRouteCardsProps> = ({ countryValue, countryName, locale }) => {
  const { t } = useTranslation('pages');
  const routes = React.useMemo(() => getCountryRoutes(countryValue), [countryValue]);

  if (routes.length === 0) return null;

  return (
    <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '170ms' } as React.CSSProperties}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
            {t('inspirations.subpages.guide.routes.eyebrow')}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">
            {t('inspirations.subpages.guide.routes.title', { destination: countryName })}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            {t('inspirations.subpages.guide.routes.subtitle')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          {t('inspirations.subpages.guide.routes.hint')}
          <ArrowRight className="rtl:rotate-180" size={13} weight="bold" />
        </span>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {routes.map((route) => (
          <CountryRouteCard key={route.id} route={route} locale={locale} />
        ))}
      </div>
    </section>
  );
};
