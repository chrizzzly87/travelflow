import React from 'react';
import { ArrowsClockwise, CalendarHeart, Funnel } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { Button } from '../ui/button';
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

// Filter chips are `Button variant="toggle"`: the pressed fill comes from `aria-pressed`, so the
// selection is announced as well as painted. The pill shape and border are the calendar's own.
const chipClassName = 'h-auto gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold aria-pressed:border-transparent not-aria-pressed:hover:border-accent-300 not-aria-pressed:hover:bg-card not-aria-pressed:hover:text-accent-700 dark:not-aria-pressed:hover:border-accent-400/30 dark:not-aria-pressed:hover:text-accent-200';

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
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
          <Funnel size={16} weight="duotone" className="text-accent-600 dark:text-accent-300" />
          {t('inspirations.subpages.festivals.resultSummary', {
            count: resultCount,
            total: totalCount,
          })}
        </p>
        {hasActiveFestivalFilters(state) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<ArrowsClockwise size={14} weight="bold" className="size-3.5" />}
            onClick={() => {
              dispatch({ type: 'clear-filters' });
              trackEvent('inspirations__festival_filter--clear', { active_filters: activeFilterCount });
            }}
            className="h-auto rounded-full bg-transparent px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-none has-[>svg]:px-3 hover:border-accent-300 hover:bg-transparent hover:text-accent-700 dark:bg-transparent dark:hover:border-accent-400/30 dark:hover:bg-transparent dark:hover:text-accent-200"
            {...getAnalyticsDebugAttributes('inspirations__festival_filter--clear', { active_filters: activeFilterCount })}
          >
            {t('inspirations.subpages.festivals.clearFilters')}
          </Button>
        ) : null}
      </div>

      <fieldset className="mt-5 min-w-0">
        <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t('inspirations.subpages.festivals.filterRegion')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {availableRegions.map((region) => {
            const isActive = state.regions.includes(region);
            return (
              <Button
                key={region}
                type="button"
                variant="toggle"
                size="sm"
                aria-pressed={isActive}
                onClick={() => handleToggleRegion(region)}
                className={chipClassName}
                {...getAnalyticsDebugAttributes('inspirations__festival_filter--region', { region })}
              >
                {t(`inspirations.subpages.festivals.regions.${region}`)}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5 min-w-0">
        <legend className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <CalendarHeart size={13} weight="duotone" />
          {t('inspirations.subpages.festivals.filterMonth')}
        </legend>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="toggle"
            size="sm"
            aria-pressed={state.month === null}
            onClick={() => handleSetMonth(null)}
            className={chipClassName}
            {...getAnalyticsDebugAttributes('inspirations__festival_filter--month', { month: 0 })}
          >
            {t('inspirations.subpages.festivals.filterAll')}
          </Button>
          {availableMonths.map((month) => {
            const isActive = state.month === month;
            return (
              <Button
                key={month}
                type="button"
                variant="toggle"
                size="sm"
                aria-pressed={isActive}
                onClick={() => handleSetMonth(isActive ? null : month)}
                className={chipClassName}
                {...getAnalyticsDebugAttributes('inspirations__festival_filter--month', { month })}
              >
                {monthLabels[month - 1]}
              </Button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};
