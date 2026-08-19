import React, { useCallback, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Confetti } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { FestivalCalendarCard } from '../../components/inspirations/FestivalCalendarCard';
import { FestivalCalendarControls } from '../../components/inspirations/FestivalCalendarControls';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import {
  FESTIVAL_CATALOG,
  listFestivalMonths,
  listFestivalRegions,
} from '../../services/festivalCatalogService';
import { sortFestivalsByNextOccurrence } from '../../services/festivalDateService';
import {
  applyFestivalFilterState,
  festivalFilterReducer,
  parseFestivalFilterState,
  serializeFestivalFilterState,
  type FestivalFilterAction,
} from '../../services/festivalFilters';
import {
  buildFestivalListStructuredData,
  resolveStructuredDataOrigin,
  serializeStructuredData,
} from '../../services/destinationStructuredData';

const MONTH_LABEL_SEED_YEAR = 2026;

const availableRegions = listFestivalRegions();
const availableMonths = listFestivalMonths();

const buildMonthLabels = (locale: string): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' });
  return Array.from({ length: 12 }, (_entry, index) => (
    formatter.format(new Date(MONTH_LABEL_SEED_YEAR, index, 1))
  ));
};

export const FestivalsPage: React.FC = () => {
  const { t } = useTranslation('pages');
  const location = useLocation();
  const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
  const [searchParams, setSearchParams] = useSearchParams();

  const monthLabels = useMemo(() => buildMonthLabels(locale), [locale]);

  /**
   * The query string is the single source of truth, so a filtered view is shareable and
   * back/forward works without an effect keeping state and URL in sync.
   */
  const state = useMemo(
    () => parseFestivalFilterState(searchParams, availableRegions),
    [searchParams],
  );

  const dispatch = useCallback((action: FestivalFilterAction) => {
    setSearchParams(
      (current) => serializeFestivalFilterState(
        festivalFilterReducer(parseFestivalFilterState(current, availableRegions), action),
      ),
    );
  }, [setSearchParams]);

  /**
   * Resolved once per mount: "soonest first" must not reshuffle mid-session, and a single clock
   * value keeps every card consistent with every other one.
   */
  const rankedFestivals = useMemo(() => {
    const now = new Date();
    const entryByEvent = new Map(FESTIVAL_CATALOG.map((entry) => [entry.event, entry]));
    return sortFestivalsByNextOccurrence(FESTIVAL_CATALOG.map((entry) => entry.event), now)
      .map(({ event, occurrence }) => ({ entry: entryByEvent.get(event)!, occurrence }));
  }, []);

  const visibleFestivals = useMemo(
    () => applyFestivalFilterState(rankedFestivals, state),
    [rankedFestivals, state],
  );

  const exactCount = useMemo(
    () => rankedFestivals.filter(({ occurrence }) => occurrence.kind === 'exact').length,
    [rankedFestivals],
  );

  const structuredData = useMemo(() => serializeStructuredData(buildFestivalListStructuredData({
    items: rankedFestivals.map(({ entry }) => ({ event: entry.event, countryName: entry.countryName })),
    canonicalUrl: `${resolveStructuredDataOrigin()}${buildLocalizedMarketingPath('inspirationsFestivals', locale)}`,
    name: t('inspirations.subpages.festivals.title'),
  })), [rankedFestivals, locale, t]);

  return (
    <MarketingLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <section className="pt-8 pb-6 md:pt-14 md:pb-8 animate-hero-entrance">
        <Link
          to={buildLocalizedMarketingPath('inspirations', locale)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-accent-700"
        >
          <ArrowLeft className="rtl:rotate-180" size={14} weight="bold" />
          {t('inspirations.subpages.backToInspirations')}
        </Link>
        <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
          <Confetti size={14} weight="duotone" />
          {t('inspirations.subpages.festivals.pill')}
        </span>
        <h1
          className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
          style={{ fontFamily: 'var(--tf-font-heading)' }}
        >
          {t('inspirations.subpages.festivals.title')}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          {t('inspirations.subpages.festivals.description')}
        </p>
        <p className="mt-4 text-sm font-semibold text-accent-700">
          {t('inspirations.subpages.festivals.counts', {
            total: rankedFestivals.length,
            exact: exactCount,
          })}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          {t('inspirations.subpages.festivals.accuracyNote')}
        </p>
      </section>

      <section className="pb-8">
        <FestivalCalendarControls
          state={state}
          dispatch={dispatch}
          availableRegions={availableRegions}
          availableMonths={availableMonths}
          monthLabels={monthLabels}
          resultCount={visibleFestivals.length}
          totalCount={rankedFestivals.length}
        />
      </section>

      <section className="pb-16 md:pb-24">
        {visibleFestivals.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFestivals.map(({ entry, occurrence }) => (
              <FestivalCalendarCard key={entry.id} entry={entry} occurrence={occurrence} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            {t('inspirations.subpages.festivals.emptyState')}
          </div>
        )}
      </section>
    </MarketingLayout>
  );
};
