import React, { useId } from 'react';
import { ArrowsClockwise, CalendarHeart, Funnel, MagnifyingGlass, NavigationArrow, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
import type { CountryOriginStatus } from '../../services/countryOriginService';

export interface CountryExplorerOriginControl {
  status: CountryOriginStatus;
  /** What the lookup inferred, shown verbatim so the guess is never hidden from the traveller. */
  inferredCity: string | null;
  inferredCountry: string | null;
  canSortByDistance: boolean;
  onDismiss: () => void;
  onRestore: () => void;
}

interface CountryExplorerControlsProps {
  state: CountryExplorerState;
  dispatch: (action: CountryExplorerAction) => void;
  availableRegions: string[];
  availableTags: string[];
  monthLabels: string[];
  resultCount: number;
  totalCount: number;
  /** Absent on the server render and in tests that do not exercise distance sorting. */
  origin?: CountryExplorerOriginControl;
}

// Filter chips are `Button variant="toggle"`: the pressed fill comes from `aria-pressed`, so the
// selection is announced as well as painted. The pill shape and border are the explorer's own.
const chipClassName = 'h-auto gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold aria-pressed:border-transparent not-aria-pressed:hover:border-accent-300 not-aria-pressed:hover:bg-card not-aria-pressed:hover:text-accent-700 dark:not-aria-pressed:hover:border-accent-400/30 dark:not-aria-pressed:hover:text-accent-200';

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
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const isActive = activeValues.includes(value);
          return (
            <Button
              key={value}
              type="button"
              variant="toggle"
              size="sm"
              aria-pressed={isActive}
              onClick={() => onToggle(facet, value)}
              className={chipClassName}
            >
              {renderLabel(value)}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
};

/**
 * The honesty panel for distance sorting.
 *
 * IP geolocation is approximate and is regularly wrong behind a VPN or a mobile carrier, so this
 * never presents itself as "your location". It names the city the lookup guessed, says where the
 * guess came from, offers a one-click way out, and — when the lookup gives us nothing — says so
 * and admits the list is not actually sorted by distance instead of showing a confident order.
 */
const OriginNotice: React.FC<{ origin: CountryExplorerOriginControl }> = ({ origin }) => {
  const { t } = useTranslation('pages');
  const { status, inferredCity, inferredCountry } = origin;
  const place = [inferredCity, inferredCountry].filter(Boolean).join(', ');

  const tone = status === 'ready'
    ? 'border-accent-200 bg-accent-50 text-accent-800 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30'
    : 'border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30';

  return (
    <div
      role="status"
      className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-xs font-semibold ${tone}`}
    >
      <NavigationArrow className="shrink-0" size={15} weight="duotone" />
      <span className="min-w-0 flex-1 text-start leading-relaxed">
        {status === 'loading' ? t('inspirations.subpages.explorer.origin.loading') : null}
        {status === 'ready' && place ? t('inspirations.subpages.explorer.origin.ready', { place }) : null}
        {status === 'dismissed' ? t('inspirations.subpages.explorer.origin.dismissed') : null}
        {(status === 'unavailable' || status === 'idle' || (status === 'ready' && !place))
          ? t('inspirations.subpages.explorer.origin.unavailable')
          : null}
      </span>
      {status === 'ready' ? (
        <button
          type="button"
          onClick={() => {
            trackEvent('inspirations__country_sort--origin_dismiss');
            origin.onDismiss();
          }}
          className="shrink-0 rounded-full border border-accent-300 px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-card dark:border-accent-400/30"
          {...getAnalyticsDebugAttributes('inspirations__country_sort--origin_dismiss')}
        >
          {t('inspirations.subpages.explorer.origin.notMe')}
        </button>
      ) : null}
      {status === 'dismissed' ? (
        <button
          type="button"
          onClick={() => {
            trackEvent('inspirations__country_sort--origin_restore');
            origin.onRestore();
          }}
          className="shrink-0 rounded-full border border-amber-300 px-2.5 py-1 text-[11px] font-bold transition-colors hover:bg-card dark:border-amber-400/30"
          {...getAnalyticsDebugAttributes('inspirations__country_sort--origin_restore')}
        >
          {t('inspirations.subpages.explorer.origin.useAnyway')}
        </button>
      ) : null}
      {origin.canSortByDistance ? (
        <span className="w-full text-[11px] font-medium opacity-80">
          {t('inspirations.subpages.explorer.origin.straightLine')}
        </span>
      ) : null}
    </div>
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
  origin,
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
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6 dark:shadow-none">
      <div className="relative">
        <label className="sr-only" htmlFor={searchId}>{t('inspirations.subpages.explorer.searchLabel')}</label>
        <MagnifyingGlass
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground"
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
          className="w-full rounded-2xl border border-border bg-secondary py-3 pe-11 ps-12 text-start text-sm font-semibold text-foreground outline-none transition-colors placeholder:font-medium placeholder:text-muted-foreground focus:border-accent-400 focus:bg-card"
          {...getAnalyticsDebugAttributes('inspirations__country_search')}
        />
        {state.query ? (
          <button
            type="button"
            onClick={() => dispatch({ type: 'set-query', query: '' })}
            aria-label={t('inspirations.subpages.explorer.clearSearch')}
            className="absolute end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-slate-200 text-muted-foreground transition-colors hover:bg-slate-300"
          >
            <X size={13} weight="bold" />
          </button>
        ) : null}
      </div>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-base font-black text-foreground">
          <CalendarHeart className="text-accent-600 dark:text-accent-300" size={18} weight="duotone" />
          {t('inspirations.subpages.explorer.monthTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('inspirations.subpages.explorer.monthSubtitle')}</p>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          <Button
            type="button"
            variant="toggle"
            size="sm"
            aria-pressed={state.month === null}
            onClick={() => handleSelectMonth(null)}
            className={chipClassName}
          >
            {t('inspirations.subpages.explorer.anyMonth')}
          </Button>
          {monthLabels.map((label, index) => {
            const month = index + 1;
            return (
              <Button
                key={label}
                type="button"
                variant="toggle"
                size="sm"
                aria-pressed={state.month === month}
                onClick={() => handleSelectMonth(month)}
                className={chipClassName}
              >
                {label}
              </Button>
            );
          })}
        </div>
        {state.month !== null ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t('inspirations.subpages.explorer.dataDisclaimer')}
          </p>
        ) : null}
      </section>

      <details className="group mt-6 border-t border-border pt-5" open={activeFilterCount > 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-foreground marker:content-['']">
          <Funnel className="text-muted-foreground" size={16} weight="duotone" />
          {t('inspirations.subpages.explorer.filtersTitle')}
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-black text-accent-700 dark:bg-accent-400/12 dark:text-accent-200">
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm font-bold text-foreground" aria-live="polite">
          {t('inspirations.subpages.explorer.resultCount', { count: resultCount, total: totalCount })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {/* A span, not a wrapping <label>: a label around a Radix trigger forwards a second
              click and the menu opens and closes at once. */}
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span id={sortId}>{t('inspirations.subpages.explorer.sortLabel')}</span>
            <Select value={state.sort} onValueChange={(value) => handleSort(value as CountryExplorerSort)}>
              <SelectTrigger
                aria-labelledby={sortId}
                className="h-8 w-auto gap-1.5 rounded-xl text-xs font-bold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_EXPLORER_SORTS.map((sort) => (
                  <SelectItem
                    key={sort}
                    value={sort}
                    // `distance` is never disabled: choosing it is what asks for the location
                    // lookup in the first place, and the notice below explains any failure.
                    disabled={sort === 'month' && state.month === null}
                  >
                    {t(`inspirations.subpages.explorer.sort.${sort}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveCountryExplorerState(state) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<ArrowsClockwise size={13} weight="bold" className="size-[13px]" />}
              onClick={() => {
                trackEvent('inspirations__country_filter--reset');
                dispatch({ type: 'reset' });
              }}
              className="h-auto rounded-full bg-transparent px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-none has-[>svg]:px-3 hover:border-accent-300 hover:bg-transparent hover:text-accent-700 dark:bg-transparent dark:hover:border-accent-400/30 dark:hover:bg-transparent dark:hover:text-accent-200"
              {...getAnalyticsDebugAttributes('inspirations__country_filter--reset')}
            >
              {t('inspirations.subpages.explorer.resetAll')}
            </Button>
          ) : null}
        </div>
      </div>

      {state.sort === 'distance' && origin ? <OriginNotice origin={origin} /> : null}
    </div>
  );
};
