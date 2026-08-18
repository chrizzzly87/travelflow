import React, { useCallback, useDeferredValue, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Compass, Globe } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { CountryExplorerCard } from '../../components/inspirations/CountryExplorerCard';
import { CountryExplorerControls } from '../../components/inspirations/CountryExplorerControls';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import {
  getCountryMonthInsight,
  listCountryExplorerEntries,
  listCountryExplorerRegions,
  listCountryExplorerTags,
} from '../../services/countryExplorerService';
import {
  applyCountryExplorerState,
  countryExplorerReducer,
  parseCountryExplorerState,
  serializeCountryExplorerState,
  type CountryExplorerAction,
} from '../../services/countryExplorerFilters';

const MONTH_LABEL_SEED_YEAR = 2026;

const countryEntries = listCountryExplorerEntries();
const availableRegions = listCountryExplorerRegions(countryEntries);
const availableTags = listCountryExplorerTags(countryEntries);

const buildMonthLabels = (locale: string): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short' });
  return Array.from({ length: 12 }, (_entry, index) => (
    formatter.format(new Date(MONTH_LABEL_SEED_YEAR, index, 1))
  ));
};

export const CountriesPage: React.FC = () => {
  const { t } = useTranslation('pages');
  const location = useLocation();
  const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
  const [searchParams, setSearchParams] = useSearchParams();

  const monthLabels = useMemo(() => buildMonthLabels(locale), [locale]);

  /**
   * The query string is the single source of truth: the view is shareable, back/forward works for
   * free, and no effect is needed to keep state and URL in sync.
   */
  const state = useMemo(
    () => parseCountryExplorerState(searchParams, { availableRegions, availableTags }),
    [searchParams],
  );

  const dispatch = useCallback((action: CountryExplorerAction) => {
    setSearchParams(
      (current) => serializeCountryExplorerState(
        countryExplorerReducer(
          parseCountryExplorerState(current, { availableRegions, availableTags }),
          action,
        ),
      ),
      // Typing should not stack a history entry per keystroke; filter/month changes should.
      { replace: action.type === 'set-query' },
    );
  }, [setSearchParams]);

  // Keeps the input responsive: the 52-card grid re-derives at a lower priority than the keystroke.
  const deferredQuery = useDeferredValue(state.query);
  const filterState = useMemo(
    () => (deferredQuery === state.query ? state : { ...state, query: deferredQuery }),
    [state, deferredQuery],
  );

  const visibleEntries = useMemo(
    () => applyCountryExplorerState(countryEntries, filterState),
    [filterState],
  );

  const cards = useMemo(() => visibleEntries.map((entry) => ({
    entry,
    href: buildLocalizedMarketingPath('inspirationsCountryDetail', locale, { countryName: entry.slug }),
    insight: filterState.month === null ? undefined : getCountryMonthInsight(entry, filterState.month),
  })), [visibleEntries, locale, filterState.month]);

  return (
    <MarketingLayout>
      <section className="pt-8 pb-6 md:pt-14 md:pb-8 animate-hero-entrance">
        <Link
          to={buildLocalizedMarketingPath('inspirations', locale)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-accent-700"
        >
          <ArrowLeft className="rtl:rotate-180" size={14} weight="bold" />
          {t('inspirations.subpages.backToInspirations')}
        </Link>
        <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
          <Globe size={14} weight="duotone" />
          {t('inspirations.subpages.countries.pill')}
        </span>
        <h1
          className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
          style={{ fontFamily: 'var(--tf-font-heading)' }}
        >
          {t('inspirations.subpages.countries.title')}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          {t('inspirations.subpages.countries.description')}
        </p>
        <p className="mt-4 text-sm font-semibold text-accent-700">
          {t('inspirations.subpages.guide.countryCount', { count: countryEntries.length })}
        </p>
      </section>

      <section className="pb-8">
        <CountryExplorerControls
          state={state}
          dispatch={dispatch}
          availableRegions={availableRegions}
          availableTags={availableTags}
          monthLabels={monthLabels}
          resultCount={visibleEntries.length}
        />
      </section>

      {cards.length > 0 ? (
        <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3 md:pb-24">
          {cards.map((card) => (
            <CountryExplorerCard
              key={card.entry.id}
              entry={card.entry}
              href={card.href}
              insight={card.insight}
              selectedMonth={filterState.month}
              monthLabels={monthLabels}
            />
          ))}
        </section>
      ) : (
        <section className="pb-16 md:pb-24">
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Compass className="mx-auto text-slate-300" size={36} weight="duotone" />
            <h2 className="mt-4 text-lg font-black text-slate-900">
              {t('inspirations.subpages.explorer.emptyTitle')}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {t('inspirations.subpages.explorer.emptyDescription')}
            </p>
            <button
              type="button"
              onClick={() => dispatch({ type: 'reset' })}
              className="mt-5 inline-flex items-center rounded-full bg-accent-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-700"
            >
              {t('inspirations.subpages.explorer.resetAll')}
            </button>
          </div>
        </section>
      )}
    </MarketingLayout>
  );
};
