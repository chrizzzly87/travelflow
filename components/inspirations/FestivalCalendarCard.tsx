import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDots, Compass, Info } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '../flags/FlagIcon';
import { buildLocalizedMarketingPath } from '../../config/routes';
import type { AppLanguage } from '../../types';
import { buildCreateTripUrl } from '../../utils';
import { resolveDestinationCodes } from '../../services/destinationService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { FestivalCatalogEntry } from '../../services/festivalCatalogService';
import { getOccurrenceTripWindow, type FestivalOccurrence } from '../../services/festivalDateService';
import { useFestivalDateLabels } from './useFestivalDateLabels';

interface FestivalCalendarCardProps {
  entry: FestivalCatalogEntry;
  occurrence: FestivalOccurrence;
  locale: AppLanguage;
}

/**
 * One festival in the calendar. The card is deliberately NOT a single big link:
 * it carries two distinct destinations (the country guide and a prefilled trip),
 * so both get their own focusable control instead of nesting anchors.
 */
export const FestivalCalendarCard: React.FC<FestivalCalendarCardProps> = ({ entry, occurrence, locale }) => {
  const { t } = useTranslation('pages');
  const { formatOccurrence, formatRecurrenceHint } = useFestivalDateLabels(locale);
  const { event } = entry;

  const dateLabel = formatOccurrence(occurrence);
  const recurrenceHint = formatRecurrenceHint(occurrence, event);
  const tripWindow = getOccurrenceTripWindow(occurrence);
  const guidePath = entry.guideSlug
    ? buildLocalizedMarketingPath('inspirationsCountryDetail', locale, { countryName: entry.guideSlug })
    : undefined;

  const planUrl = buildCreateTripUrl({
    countries: resolveDestinationCodes([entry.countryCode]),
    ...(tripWindow || {}),
    notes: event.summary,
    meta: { source: 'inspirations_festivals', label: event.name },
  });

  const payload = { name: event.name, country: entry.countryName, region: entry.regionId, precision: occurrence.kind };

  return (
    <article className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-accent-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-50">
          <FlagIcon code={entry.countryCode} size="2xl" label={entry.countryName} />
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            occurrence.kind === 'exact' ? 'bg-accent-50 text-accent-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          <CalendarDots size={13} weight="duotone" />
          {occurrence.kind === 'exact' && occurrence.isOngoing
            ? t('inspirations.subpages.festivals.happeningNow')
            : t(`inspirations.subpages.festivals.precision.${occurrence.kind}`)}
        </span>
      </div>

      <h2 className="mt-4 text-lg font-black leading-snug text-slate-900">
        {guidePath ? (
          <Link
            to={guidePath}
            onClick={() => trackEvent('inspirations__festival_card--guide', payload)}
            className="transition-colors hover:text-accent-700 focus-visible:text-accent-700"
            {...getAnalyticsDebugAttributes('inspirations__festival_card--guide', payload)}
          >
            {event.name}
          </Link>
        ) : (
          event.name
        )}
      </h2>

      <p className="mt-1 text-xs font-semibold text-slate-500">
        {t('inspirations.subpages.festivals.countryInRegion', {
          country: entry.countryName,
          region: t(`inspirations.subpages.festivals.regions.${entry.regionId}`),
        })}
      </p>

      <p className="mt-3 text-sm font-black text-accent-700">{dateLabel}</p>
      {recurrenceHint ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
          <Info className="mt-0.5 shrink-0" size={13} weight="duotone" />
          <span>{recurrenceHint}</span>
        </p>
      ) : null}

      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{event.summary}</p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm font-bold">
        <Link
          to={planUrl}
          onClick={() => trackEvent('inspirations__festival_plan', payload)}
          className="inline-flex items-center gap-1 text-accent-700 transition-colors hover:text-accent-900"
          {...getAnalyticsDebugAttributes('inspirations__festival_plan', payload)}
        >
          {t('inspirations.subpages.festivals.planCta')}
          <ArrowRight className="rtl:rotate-180" size={14} weight="bold" />
        </Link>
        {guidePath ? (
          <Link
            to={guidePath}
            onClick={() => trackEvent('inspirations__festival_card--guide', payload)}
            className="inline-flex items-center gap-1 text-slate-500 transition-colors hover:text-accent-700"
            {...getAnalyticsDebugAttributes('inspirations__festival_card--guide', payload)}
          >
            <Compass size={14} weight="duotone" />
            {t('inspirations.subpages.festivals.guideCta')}
          </Link>
        ) : null}
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => trackEvent('inspirations__festival_source', payload)}
            className="ms-auto text-xs font-semibold text-slate-400 transition-colors hover:text-accent-600"
            {...getAnalyticsDebugAttributes('inspirations__festival_source', payload)}
          >
            {t('inspirations.subpages.festivals.sourceCta')}
          </a>
        ) : null}
      </div>
    </article>
  );
};
