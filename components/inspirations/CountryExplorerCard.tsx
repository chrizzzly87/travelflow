import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Drop, MapPin, ThermometerSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '../flags/FlagIcon';
import { CountryMonthStrip } from './CountryMonthStrip';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { CountryExplorerEntry, CountryMonthInsight } from '../../services/countryExplorerService';
import type { ClimateSeason } from '../../services/countryClimateService';

interface CountryExplorerCardProps {
  entry: CountryExplorerEntry;
  href: string;
  /** Present only while a month is selected. `insight.climate` is absent for uncovered countries. */
  insight?: CountryMonthInsight;
  selectedMonth: number | null;
  /** Localized short month names, index 0 = January. */
  monthLabels: string[];
}

const SEASON_DOT_CLASS: Record<ClimateSeason, string> = {
  high: 'bg-rose-500',
  shoulder: 'bg-amber-500',
  low: 'bg-sky-500',
};

const MAX_VISIBLE_TAGS = 3;

/** Unit lives in the localized string, so only the rounded number is interpolated. */
const formatTemperature = (value: number): string => String(Math.round(value));

const CountryExplorerCardComponent: React.FC<CountryExplorerCardProps> = ({
  entry,
  href,
  insight,
  selectedMonth,
  monthLabels,
}) => {
  const { t } = useTranslation('pages');

  const idealMonthNames = entry.idealMonths
    .filter((month) => month >= 1 && month <= 12)
    .map((month) => monthLabels[month - 1])
    .join(', ');
  const stripLabel = idealMonthNames
    ? t('inspirations.subpages.explorer.stripLabel', { country: entry.name, months: idealMonthNames })
    : t('inspirations.subpages.explorer.stripLabelUnknown', { country: entry.name });

  const payload = {
    country: entry.name,
    kind: 'country',
    month: selectedMonth ?? 0,
    season: insight?.climate?.season || '',
  };

  return (
    <Link
      to={href}
      onClick={() => trackEvent('inspirations__destination_card', payload)}
      className="group flex min-h-52 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-accent-200 hover:shadow-lg"
      {...getAnalyticsDebugAttributes('inspirations__destination_card', payload)}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-slate-50">
          <FlagIcon code={entry.countryCode} size="2xl" />
        </span>
        <ArrowRight
          className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-600 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          size={18}
          weight="bold"
        />
      </div>

      <h2 className="mt-5 text-xl font-black text-slate-900">{entry.name}</h2>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1">
          <MapPin size={13} />
          {entry.region}
        </span>
        {entry.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
          <span key={tag} className="rounded-full bg-accent-50 px-2.5 py-1 font-bold capitalize text-accent-700">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-5">
        {insight ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-600">
            {insight.climate ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <ThermometerSimple size={14} weight="duotone" className="text-slate-400" />
                  {t('inspirations.subpages.explorer.temperature', {
                    high: formatTemperature(insight.climate.avgHighC),
                    low: formatTemperature(insight.climate.avgLowC),
                  })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Drop size={14} weight="duotone" className="text-slate-400" />
                  {t(`inspirations.subpages.explorer.rainfall.${insight.climate.rainfall}`)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${SEASON_DOT_CLASS[insight.climate.season]}`} aria-hidden="true" />
                  {t(`inspirations.subpages.explorer.season.${insight.climate.season}`)}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1">
                  {t(`inspirations.subpages.explorer.band.${insight.band}`)}
                </span>
                <span className="font-medium text-slate-400">
                  {t('inspirations.subpages.explorer.climateUnavailable')}
                </span>
              </>
            )}
          </div>
        ) : null}

        <CountryMonthStrip
          seasonBands={entry.seasonBands}
          selectedMonth={selectedMonth}
          label={stripLabel}
        />
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {idealMonthNames
            ? t('inspirations.subpages.explorer.bestMonths', { months: idealMonthNames })
            : t('inspirations.subpages.explorer.bestMonthsUnknown')}
        </p>
      </div>
    </Link>
  );
};

export const CountryExplorerCard = React.memo(CountryExplorerCardComponent);
CountryExplorerCard.displayName = 'CountryExplorerCard';
