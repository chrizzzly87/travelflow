import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDots, Globe, MapPin } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { FlagIcon } from '../../components/flags/FlagIcon';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import { listDestinationGuides } from '../../services/destinationGuideService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const countryGuides = listDestinationGuides({ kind: 'country', limit: 50 });

export const CountriesPage: React.FC = () => {
  const { t } = useTranslation('pages');
  const location = useLocation();
  const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;

  return (
    <MarketingLayout>
      <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
        <Link to={buildLocalizedMarketingPath('inspirations', locale)} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-accent-700">
          <ArrowLeft className="rtl:rotate-180" size={14} weight="bold" />
          {t('inspirations.subpages.backToInspirations')}
        </Link>
        <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
          <Globe size={14} weight="duotone" />
          {t('inspirations.subpages.countries.pill')}
        </span>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
          {t('inspirations.subpages.countries.title')}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          {t('inspirations.subpages.countries.description')}
        </p>
        <p className="mt-4 text-sm font-semibold text-accent-700">
          {t('inspirations.subpages.guide.countryCount', { count: countryGuides.length })}
        </p>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3 md:pb-24">
        {countryGuides.map((country) => {
          const path = buildLocalizedMarketingPath('inspirationsCountryDetail', locale, { countryName: country.slug });
          const payload = { country: country.name, kind: country.kind };
          return (
            <Link
              key={country.id}
              to={path}
              onClick={() => trackEvent('inspirations__destination_card', payload)}
              className="group flex min-h-52 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-accent-200 hover:shadow-lg"
              {...getAnalyticsDebugAttributes('inspirations__destination_card', payload)}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-slate-50"><FlagIcon code={country.countryCode} size="2xl" /></span>
                <ArrowRight className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-600 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" size={18} weight="bold" />
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-900">{country.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1"><MapPin size={13} />{country.region}</span>
                {country.suggestedTripDays ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1"><CalendarDots size={13} />{t('inspirations.subpages.guide.daysShort', { count: country.suggestedTripDays.recommended })}</span>
                ) : null}
              </div>
              {country.tags.length > 0 ? (
                <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                  {country.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] font-bold capitalize text-accent-700">{tag}</span>)}
                </div>
              ) : null}
            </Link>
          );
        })}
      </section>
    </MarketingLayout>
  );
};
