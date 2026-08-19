import React from 'react';
import { ArrowsClockwise, CalendarHeart, Funnel } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { FestivalRegionId } from '../../services/festivalCatalogService';
import {
  countActiveFestivalFilters,
  hasActiveFestivalFilters,
  type FestivalFilterAction,
  type FestivalFilterState,
} from '../../services/festivalFilters';

interface FestivalCalendarControlsProps {
  state: FestivalFilterState;
  dispatch: (action: FestivalFilterAction) => void;
  availableRegions: FestivalRegionId[];
  availableMonths: number[];
  /** Localized short month names, index 0 = January. */
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

/**
 * Region and month filters for the festivals index.
 *
 * Purely presentational: every interaction dispatches into the festival filter reducer that the
 * page mirrors into the query string, so this component holds no state of its own.
 *
 * Direction: spacing uses logical utilities (`ms-*`, `me-*`) so the chip rails and the reset
 * button mirror correctly in RTL locales.
 */
export const FestivalCalendarControls: React.FC<FestivalCalendarControlsProps> = ({
  state,
  dispatch,
  availableRegions,
  availableMonths,
  monthLabels,
  resultCount,
  totalCount,
}) => {
  const { t } = useTranslation('pages');
  const activeFilterCount = countActiveFestivalFilters(state);

  const handleToggleRegion = (region: FestivalRegionId): void => {
    dispatch({ type: 'toggle-region', region });
    trackEvent('inspirations__festival_filter--region', { region });
  };

  const handleSetMonth = (month: number | null): void => {
    dispatch({ type: 'set-month', month });
    trackEvent('inspirations__festival_filter--month', { month: month ?? 0 });
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
          <Funnel size={16} weight="duotone" className="text-accent-600" />
          {t('inspirations.subpages.festivals.resultSummary', {
            count: resultCount,
            total: totalCount,
          })}
        </p>
        {hasActiveFestivalFilters(state) ? (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'clear-filters' });
              trackEvent('inspirations__festival_filter--clear', { active_filters: activeFilterCount });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-accent-300 hover:text-accent-700"
            {...getAnalyticsDebugAttributes('inspirations__festival_filter--clear', { active_filters: activeFilterCount })}
          >
            <ArrowsClockwise size={14} weight="bold" />
            {t('inspirations.subpages.festivals.clearFilters')}
          </button>
        ) : null}
      </div>

      <fieldset className="mt-5 min-w-0">
        <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {t('inspirations.subpages.festivals.filterRegion')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {availableRegions.map((region) => {
            const isActive = state.regions.includes(region);
            return (
              <button
                key={region}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleToggleRegion(region)}
                className={chipClass(isActive)}
                {...getAnalyticsDebugAttributes('inspirations__festival_filter--region', { region })}
              >
                {t(`inspirations.subpages.festivals.regions.${region}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5 min-w-0">
        <legend className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <CalendarHeart size={13} weight="duotone" />
          {t('inspirations.subpages.festivals.filterMonth')}
        </legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={state.month === null}
            onClick={() => handleSetMonth(null)}
            className={chipClass(state.month === null)}
            {...getAnalyticsDebugAttributes('inspirations__festival_filter--month', { month: 0 })}
          >
            {t('inspirations.subpages.festivals.filterAll')}
          </button>
          {availableMonths.map((month) => {
            const isActive = state.month === month;
            return (
              <button
                key={month}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleSetMonth(isActive ? null : month)}
                className={chipClass(isActive)}
                {...getAnalyticsDebugAttributes('inspirations__festival_filter--month', { month })}
              >
                {monthLabels[month - 1]}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};
