import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AirplaneTilt,
  ArrowLeft,
  ArrowRight,
  CalendarDots,
  City,
  Compass,
  Globe,
  Island,
  MapPin,
  Sparkle,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../types';
import type { DestinationGuideEntry, DestinationSeason } from '../../shared/destinationGuides';
import type { ResolvedDestinationGuide } from '../../services/destinationGuideService';
import { buildLocalizedMarketingPath } from '../../config/routes';
import { buildCreateTripUrl } from '../../utils';
import { FlagIcon } from '../flags/FlagIcon';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { useDestinationCountryProfile } from '../../hooks/useDestinationCountryProfile';
import { DestinationCountryProfileSections } from './DestinationCountryProfileSections';
import { CountryRouteCards } from './CountryRouteCards';
import {
  buildDestinationStructuredData,
  resolveStructuredDataOrigin,
  serializeStructuredData,
} from '../../services/destinationStructuredData';

interface DestinationGuideViewProps {
  resolved: ResolvedDestinationGuide;
  locale: AppLanguage;
}

const MONTH_DATE_SEED_YEAR = 2026;
const SEASON_STYLES: Record<DestinationSeason, string> = {
  ideal: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  shoulder: 'border-amber-200 bg-amber-50 text-amber-800',
  avoid: 'border-slate-200 bg-slate-50 text-slate-500',
};

const getMonthSeason = (guide: ResolvedDestinationGuide, month: number): DestinationSeason => {
  if (guide.effectiveSeasonality?.idealMonths.includes(month)) return 'ideal';
  if (guide.effectiveSeasonality?.shoulderMonths.includes(month)) return 'shoulder';
  return 'avoid';
};

const getMonthLabels = (locale: AppLanguage): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' });
  return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(MONTH_DATE_SEED_YEAR, index, 1)));
};

const getChildIcon = (kind: DestinationGuideEntry['kind']) => (
  kind === 'island' ? Island : City
);

export const DestinationGuideView: React.FC<DestinationGuideViewProps> = ({ resolved, locale }) => {
  const { t } = useTranslation('pages');
  const location = useLocation();
  const { guide, country, children, effectiveSeasonality, effectiveEvents } = resolved;
  const isCountry = guide.kind === 'country';
  const countryProfile = useDestinationCountryProfile(country.slug, isCountry);
  const monthLabels = getMonthLabels(locale);
  const countriesPath = buildLocalizedMarketingPath('inspirationsCountries', locale);
  const countryPath = buildLocalizedMarketingPath('inspirationsCountryDetail', locale, { countryName: country.slug });
  const planUrl = buildCreateTripUrl({
    countries: [country.name],
    cities: isCountry ? undefined : guide.name,
    meta: { source: 'inspirations', label: guide.name },
  });
  const hasHighlights = guide.highlights.length > 0;
  const hasAirports = country.airports.length > 0;
  const visibleSources = guide.sourceLinks.filter((source) => !source.isReferral);
  const typeLabel = guide.kind === 'country'
    ? t('inspirations.subpages.guide.countryPill')
    : guide.kind === 'island'
      ? t('inspirations.subpages.guide.islandPill')
      : t('inspirations.subpages.guide.cityPill');
  const structuredData = React.useMemo(() => serializeStructuredData(buildDestinationStructuredData({
    resolved,
    canonicalUrl: `${resolveStructuredDataOrigin()}${location.pathname}`,
    description: countryProfile.result?.profile.summary || guide.summary,
  })), [resolved, location.pathname, countryProfile.result?.profile.summary, guide.summary]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
        <nav aria-label={t('inspirations.subpages.guide.breadcrumbLabel')} className="mb-6 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link to={countriesPath} className="inline-flex items-center gap-1.5 transition-colors hover:text-accent-700">
            <ArrowLeft className="rtl:rotate-180" size={14} weight="bold" />
            {t('inspirations.subpages.guide.backToCountries')}
          </Link>
          {!isCountry ? (
            <>
              <span aria-hidden="true">/</span>
              <Link to={countryPath} className="transition-colors hover:text-accent-700">{country.name}</Link>
            </>
          ) : null}
        </nav>

        <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
          {guide.kind === 'island' ? <Island size={14} weight="duotone" /> : guide.kind === 'city' ? <City size={14} weight="duotone" /> : <Globe size={14} weight="duotone" />}
          {typeLabel}
        </span>
        <h1 className="mt-5 flex flex-wrap items-center gap-3 text-4xl font-black tracking-tight text-slate-900 md:text-6xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
          <FlagIcon code={country.countryCode} size="2xl" />
          {guide.name}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">
          {countryProfile.result?.profile.summary || guide.summary || t('inspirations.subpages.guide.intro')}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <MapPin size={16} weight="duotone" />
            {guide.region}
          </span>
          {guide.suggestedTripDays ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <CalendarDots size={16} weight="duotone" />
              {t('inspirations.subpages.guide.suggestedStay', { count: guide.suggestedTripDays.recommended })}
            </span>
          ) : null}
          {isCountry && children.length > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <Compass size={16} weight="duotone" />
              {t('inspirations.subpages.guide.destinationsCount', { count: children.length })}
            </span>
          ) : null}
        </div>
      </section>

      {effectiveSeasonality ? (
        <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '80ms' } as React.CSSProperties}>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.timingEyebrow')}</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.bestTime')}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                {(['ideal', 'shoulder', 'avoid'] as const).map((season) => (
                  <span key={season} className="inline-flex items-center gap-1.5">
                    <span className={`size-2.5 rounded-full border ${SEASON_STYLES[season]}`} />
                    {t(`inspirations.subpages.guide.${season}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {monthLabels.map((label, index) => {
                const season = getMonthSeason(resolved, index + 1);
                return (
                  <div key={`${index + 1}-${label}`} className={`rounded-xl border px-2 py-3 text-center ${SEASON_STYLES[season]}`}>
                    <p className="text-xs font-bold uppercase">{label}</p>
                  </div>
                );
              })}
            </div>
            {effectiveSeasonality.note ? <p className="mt-4 text-sm leading-relaxed text-slate-500">{effectiveSeasonality.note}</p> : null}
          </div>
        </section>
      ) : null}

      {isCountry && countryProfile.isLoading ? (
        <section aria-label={t('inspirations.subpages.guide.loadingProfile')} className="pb-10">
          <div className="grid animate-pulse gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-32 rounded-2xl border border-slate-100 bg-slate-100" />
            ))}
          </div>
        </section>
      ) : null}

      {isCountry && countryProfile.result ? (
        <DestinationCountryProfileSections
          countryName={country.name}
          locale={locale}
          result={countryProfile.result}
        />
      ) : null}

      {isCountry && countryProfile.hasError ? (
        <p className="mb-10 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {t('inspirations.subpages.guide.profileUnavailable')}
        </p>
      ) : null}

      {children.length > 0 ? (
        <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '140ms' } as React.CSSProperties}>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.goDeeperEyebrow')}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.exploreChildren')}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => {
              const Icon = getChildIcon(child.kind);
              const path = buildLocalizedMarketingPath('inspirationsDestinationDetail', locale, {
                countrySlug: country.slug,
                destinationSlug: child.slug,
              });
              const payload = { country: country.name, destination: child.name, kind: child.kind };
              return (
                <Link
                  key={child.id}
                  to={path}
                  onClick={() => trackEvent('inspirations__destination_card', payload)}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-md"
                  {...getAnalyticsDebugAttributes('inspirations__destination_card', payload)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700"><Icon size={20} weight="duotone" /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-900">{child.name}</span>
                      <span className="text-xs capitalize text-slate-500">{child.kind}</span>
                    </span>
                  </span>
                  <ArrowRight className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" size={16} weight="bold" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Both cards are optional, so only claim two columns when both actually render.
          Otherwise the single card sat in a half-width column next to an empty gap. */}
      {isCountry ? (
        <CountryRouteCards countryValue={country.slug} countryName={country.name} locale={locale} />
      ) : null}

      <section
        className={`grid gap-5 pb-10 animate-hero-stagger${hasHighlights && hasAirports ? ' md:grid-cols-2' : ''}`}
        style={{ '--stagger': '200ms' } as React.CSSProperties}
      >
        {guide.highlights.length > 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><Sparkle size={20} weight="duotone" className="text-accent-700" />{t('inspirations.subpages.guide.highlights')}</h2>
            <ul className="mt-4 space-y-3">
              {guide.highlights.map((highlight) => <li key={highlight} className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">{highlight}</li>)}
            </ul>
          </div>
        ) : null}
        {country.airports.length > 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><AirplaneTilt size={20} weight="duotone" className="text-accent-700" />{t('inspirations.subpages.guide.arrivalAirports')}</h2>
            <ul className="mt-4 space-y-3">
              {country.airports.slice(0, 4).map((airport) => (
                <li key={airport.iata} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="rounded-md bg-white px-2 py-1 font-mono text-xs font-bold text-accent-700 shadow-sm">{airport.iata}</span>
                  <span className="text-sm font-semibold text-slate-700">{airport.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {effectiveEvents.length > 0 ? (
        <section className="pb-10 animate-hero-stagger" style={{ '--stagger': '240ms' } as React.CSSProperties}>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{t('inspirations.subpages.guide.planAroundEyebrow')}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{t('inspirations.subpages.guide.events')}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {effectiveEvents.map((event) => (
              <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-accent-700">{monthLabels[event.month - 1]} · {event.type}</p>
                <h3 className="mt-2 text-lg font-black text-slate-900">{event.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{event.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pb-16 md:pb-24 animate-hero-stagger" style={{ '--stagger': '300ms' } as React.CSSProperties}>
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:flex md:items-center md:justify-between md:gap-8 md:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-300">{t('inspirations.subpages.guide.readyEyebrow')}</p>
            <h2 className="mt-2 text-2xl font-black">{t('inspirations.subpages.guide.planTitle', { destination: guide.name })}</h2>
            {visibleSources.length > 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                {t('inspirations.subpages.guide.sourcesLabel')} {visibleSources.map((source, index) => (
                  <React.Fragment key={source.url}>
                    {index > 0 ? ' · ' : ''}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-600 underline-offset-2 hover:text-white">
                      {new URL(source.url).hostname.replace(/^www\./, '')}
                    </a>
                  </React.Fragment>
                ))}
              </p>
            ) : null}
          </div>
          <Link
            to={planUrl}
            onClick={() => trackEvent('inspirations__destination_plan', { country: country.name, destination: guide.name, kind: guide.kind })}
            className="mt-6 inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition-transform hover:-translate-y-0.5 md:mt-0"
            {...getAnalyticsDebugAttributes('inspirations__destination_plan', { country: country.name, destination: guide.name, kind: guide.kind })}
          >
            {t('inspirations.subpages.guide.planCta')}
            <ArrowRight className="rtl:rotate-180" size={15} weight="bold" />
          </Link>
        </div>
      </section>
    </>
  );
};
