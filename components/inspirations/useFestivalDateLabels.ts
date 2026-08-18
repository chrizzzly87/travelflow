import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { localeToIntlLocale } from '../../config/locales';
import type { AppLanguage } from '../../types';
import type { DestinationEvent } from '../../shared/destinationGuides';
import type { FestivalOccurrence } from '../../services/festivalDateService';

const parseIsoDay = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/**
 * Turns a resolved occurrence into display copy.
 *
 * Exact occurrences get a real formatted date. Approximate ones deliberately
 * never do — they read as "usually in <month>" so the page never implies a
 * precision the data does not have.
 */
export const useFestivalDateLabels = (locale: AppLanguage) => {
  const { t } = useTranslation('pages');
  const intlLocale = localeToIntlLocale(locale);

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'long', timeZone: 'UTC' }),
    [intlLocale],
  );
  const dayMonthFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    [intlLocale],
  );
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    [intlLocale],
  );

  const formatMonthName = useCallback(
    (month: number) => monthFormatter.format(new Date(Date.UTC(2000, month - 1, 1))),
    [monthFormatter],
  );

  const formatOccurrence = useCallback((occurrence: FestivalOccurrence): string => {
    if (occurrence.kind === 'approximate') {
      const values = { month: formatMonthName(occurrence.month), year: String(occurrence.year) };
      if (occurrence.qualifier === 'throughout') return t('inspirations.subpages.festivals.date.throughout', values);
      if (occurrence.qualifier) return t(`inspirations.subpages.festivals.date.usually_${occurrence.qualifier}`, values);
      return t('inspirations.subpages.festivals.date.usually', values);
    }

    const start = parseIsoDay(occurrence.date);
    const end = parseIsoDay(occurrence.endDate);
    if (occurrence.date === occurrence.endDate) return fullDateFormatter.format(start);
    // An en dash reads as a range in every supported locale; the surrounding
    // text direction is handled by the browser via the page `dir` attribute.
    return `${dayMonthFormatter.format(start)} – ${fullDateFormatter.format(end)}`;
  }, [dayMonthFormatter, formatMonthName, fullDateFormatter, t]);

  const formatRecurrenceHint = useCallback((
    occurrence: FestivalOccurrence,
    event: DestinationEvent,
  ): string | undefined => {
    // Exact dates speak for themselves; the rule only earns space when the page
    // is showing an approximation and the reader deserves to know why.
    if (occurrence.kind === 'exact') return undefined;
    const kind = event.recurrence?.kind;
    if (!kind) return undefined;
    const kindLabel = t(`inspirations.subpages.festivals.recurrence.${kind}`);
    return event.recurrence?.rule ? `${kindLabel} — ${event.recurrence.rule}` : kindLabel;
  }, [t]);

  return { formatOccurrence, formatRecurrenceHint, formatMonthName };
};
