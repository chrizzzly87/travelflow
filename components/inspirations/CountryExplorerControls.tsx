import React, { useId } from 'react';
import { ArrowsClockwise, CalendarHeart, Funnel, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
  TRIP_LENGTH_BAND_ORDER,
  TRIP_LENGTH_BANDS,
  COUNTRY_EXPLORER_SORTS,
  countActiveFilters,
  hasActiveCountryExplorerState,
  type CountryExplorerAction,
  type CountryExplorerFacet,
  type CountryExplorerSort,
  type CountryExplorerState,
} from '../../services/countryExplorerFilters';

interface CountryExplorerControlsProps {
  state: CountryExplorerState;
  dispatch: (action: CountryExplorerAction) => void;
  availableRegions: string[];
  availableTags: string[];
  monthLabels: string[];
  resultCount: number;
  totalCount: number;
}

const chipClass = (isActive: boolean): string => [
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
  isActive
    ? 'border-accent-500 bg-accent-500 text-white'
    : 'border-slate-200 bg-white text-slate-600 hover:border-accent-300 hover:text-accent-700',
].join(' ');

const FacetGroup: React.FC<{
  legend: string;
  facet: CountryExplorerFacet;
  values: string[];
  activeValues: string[];
  renderLabel: (value: string) => string;
  onToggle: (facet: CountryExplorerFacet, value: string) => void;
}> = ({ legend, facet, values, activeValues, renderLabel, onToggle }) => {
  if (values.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const isActive = activeValues.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggle(facet, value)}
              className={chipClass(isActive)}
            >
              {renderLabel(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

/**
 * Search, month picker, facets and sort for the countries explorer.
 *
 * Purely presentational: every interaction dispatches into the explorer reducer that the page
 * mirrors into the query string, so this component holds no state of its own and a future map
 * can drive the exact same actions.
 *
 * Direction: spacing uses logical utilities (`ps-*`, `end-*`, `text-start`) so the search icon,
 * clear button and month rail mirror correctly in RTL locales.
 */
export const CountryExplorerControls: React.FC<CountryExplorerControlsProps> = ({
  state,
  dispatch,
  availableRegions,
  availableTags,
  monthLabels,
  resultCount,
  totalCount,
}) => {
  const { t } = useTranslation('pages');
  const searchId = useId();
  const sortId = useId();
  const activeFilterCount = countActiveFilters(state);

  const handleToggleFacet = (facet: CountryExplorerFacet, value: string): void => {
    trackEvent('inspirations__country_filter', { facet, value });
    dispatch({ type: 'toggle-facet', facet, value });
  };

  const handleSelectMonth = (month: number | null): void => {
    trackEvent('inspirations__country_month', { month: month ?? 0 });
    dispatch({ type: 'set-month', month });
  };

  const handleSort = (sort: CountryExplorerSort): void => {
    trackEvent('inspirations__country_sort', { sort });
    dispatch({ type: 'set-sort', sort });
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="relative">
        <label className="sr-only" htmlFor={searchId}>{t('inspirations.subpages.explorer.searchLabel')}</label>
        <MagnifyingGlass
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
          weight="bold"
        />
        <input
          id={searchId}
          type="search"
          value={state.query}
          onChange={(event) => dispatch({ type: 'set-query', query: event.target.value })}
          onBlur={() => {
            if (!state.query.trim()) return;
            trackEvent('inspirations__country_search', {
              query_length: state.query.trim().length,
              result_count: resultCount,
            });
          }}
          placeholder={t('inspirations.subpages.explorer.searchPlaceholder')}
          autoComplete="off"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pe-11 ps-12 text-start text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:font-medium placeholder:text-slate-400 focus:border-accent-400 focus:bg-white"
          {...getAnalyticsDebugAttributes('inspirations__country_search')}
        />
        {state.query ? (
          <button
            type="button"
            onClick={() => dispatch({ type: 'set-query', query: '' })}
            aria-label={t('inspirations.subpages.explorer.clearSearch')}
            className="absolute end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-slate-200 text-slate-600 transition-colors hover:bg-slate-300"
          >
            <X size={13} weight="bold" />
          </button>
        ) : null}
      </div>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
          <CalendarHeart className="text-accent-600" size={18} weight="duotone" />
          {t('inspirations.subpages.explorer.monthTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('inspirations.subpages.explorer.monthSubtitle')}</p>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            aria-pressed={state.month === null}
            onClick={() => handleSelectMonth(null)}
            className={`${chipClass(state.month === null)} shrink-0`}
          >
            {t('inspirations.subpages.explorer.anyMonth')}
          </button>
          {monthLabels.map((label, index) => {
            const month = index + 1;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={state.month === month}
                onClick={() => handleSelectMonth(month)}
                className={`${chipClass(state.month === month)} shrink-0`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {state.month !== null ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            {t('inspirations.subpages.explorer.dataDisclaimer')}
          </p>
        ) : null}
      </section>

      <details className="group mt-6 border-t border-slate-100 pt-5" open={activeFilterCount > 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-slate-700 marker:content-['']">
          <Funnel className="text-slate-400" size={16} weight="duotone" />
          {t('inspirations.subpages.explorer.filtersTitle')}
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-black text-accent-700">
              {activeFilterCount}
            </span>
          ) : null}
        </summary>

        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <FacetGroup
            legend={t('inspirations.subpages.explorer.facets.region')}
            facet="regions"
            values={availableRegions}
            activeValues={state.regions}
            renderLabel={(value) => value}
            onToggle={handleToggleFacet}
          />
          <FacetGroup
            legend={t('inspirations.subpages.explorer.facets.style')}
            facet="tags"
            values={availableTags}
            activeValues={state.tags}
            renderLabel={(value) => value}
            onToggle={handleToggleFacet}
          />
          <FacetGroup
            legend={t('inspirations.subpages.explorer.facets.length')}
            facet="tripLengths"
            values={TRIP_LENGTH_BAND_ORDER}
            activeValues={state.tripLengths}
            renderLabel={(value) => t(`inspirations.subpages.explorer.tripLength.${value}`, {
              min: TRIP_LENGTH_BANDS[value as keyof typeof TRIP_LENGTH_BANDS].minDays ?? 0,
              max: TRIP_LENGTH_BANDS[value as keyof typeof TRIP_LENGTH_BANDS].maxDays ?? 0,
            })}
            onToggle={handleToggleFacet}
          />
        </div>
      </details>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm font-bold text-slate-700" aria-live="polite">
          {t('inspirations.subpages.explorer.resultCount', { count: resultCount, total: totalCount })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500" htmlFor={sortId}>
            {t('inspirations.subpages.explorer.sortLabel')}
            <select
              id={sortId}
              value={state.sort}
              onChange={(event) => handleSort(event.target.value as CountryExplorerSort)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-accent-400"
            >
              {COUNTRY_EXPLORER_SORTS.map((sort) => (
                <option key={sort} value={sort} disabled={sort === 'month' && state.month === null}>
                  {t(`inspirations.subpages.explorer.sort.${sort}`)}
                </option>
              ))}
            </select>
          </label>
          {hasActiveCountryExplorerState(state) ? (
            <button
              type="button"
              onClick={() => {
                trackEvent('inspirations__country_filter--reset');
                dispatch({ type: 'reset' });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700"
              {...getAnalyticsDebugAttributes('inspirations__country_filter--reset')}
            >
              <ArrowsClockwise size={13} weight="bold" />
              {t('inspirations.subpages.explorer.resetAll')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
