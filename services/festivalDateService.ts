import type {
  DestinationEvent,
  DestinationEventMonthQualifier,
} from '../shared/destinationGuides';

/**
 * Resolves when a festival next happens.
 *
 * The hard rule of this module: never invent a precise date. A festival only
 * resolves to `exact` when the underlying data actually pins it down — either a
 * fixed calendar day, or a sourced entry in `knownDates` for that year.
 * Everything else resolves to `approximate`, which the UI renders as
 * "usually in <month>" / "usually late <month>".
 *
 * Every function takes the current time as an argument so the behaviour is pure
 * and deterministic (and therefore testable across year boundaries).
 */

export type FestivalOccurrencePrecision = 'exact' | 'approximate';

export interface ExactFestivalOccurrence {
  kind: 'exact';
  /** ISO `YYYY-MM-DD` start date. */
  date: string;
  /** ISO `YYYY-MM-DD` end date. Equals `date` for single-day events. */
  endDate: string;
  year: number;
  month: number;
  /** True while the festival window has started but not yet finished. */
  isOngoing: boolean;
  /** Where the certainty came from. */
  source: 'fixed' | 'known';
}

export interface ApproximateFestivalOccurrence {
  kind: 'approximate';
  year: number;
  month: number;
  qualifier?: DestinationEventMonthQualifier;
}

export type FestivalOccurrence = ExactFestivalOccurrence | ApproximateFestivalOccurrence;

/** How many future years of `knownDates` we are willing to look ahead. */
const MAX_LOOKAHEAD_YEARS = 6;

/** Nominal day-of-month used purely for ordering approximate occurrences. */
const QUALIFIER_SORT_DAY: Record<DestinationEventMonthQualifier, number> = {
  early: 5,
  mid: 15,
  late: 25,
  throughout: 15,
};

const pad = (value: number): string => String(value).padStart(2, '0');

export const toIsoDay = (year: number, month: number, day: number): string => (
  `${year}-${pad(month)}-${pad(day)}`
);

const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

const clampDay = (year: number, month: number, day: number): number => (
  Math.min(Math.max(day, 1), daysInMonth(year, month))
);

/** Start-of-day UTC timestamp for an ISO `YYYY-MM-DD` string. */
const isoToTimestamp = (iso: string): number => Date.UTC(
  Number(iso.slice(0, 4)),
  Number(iso.slice(5, 7)) - 1,
  Number(iso.slice(8, 10)),
);

const addDaysIso = (iso: string, days: number): string => {
  const date = new Date(isoToTimestamp(iso));
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

/** Today in UTC, normalised to `YYYY-MM-DD` so comparisons ignore clock time. */
export const toIsoDayFromDate = (value: Date): string => toIsoDay(
  value.getUTCFullYear(),
  value.getUTCMonth() + 1,
  value.getUTCDate(),
);

const resolveWindowLength = (event: DestinationEvent): number => {
  if (event.durationDays && event.durationDays > 0) return event.durationDays;
  if (event.startDay !== undefined && event.endDay !== undefined) return event.endDay - event.startDay + 1;
  return 1;
};

/** Fixed-day window for a given year, or `undefined` when the event is not fixed to a day. */
const buildFixedWindow = (event: DestinationEvent, year: number): { start: string; end: string } | undefined => {
  if (event.startDay !== undefined && event.endDay !== undefined) {
    return {
      start: toIsoDay(year, event.month, clampDay(year, event.month, event.startDay)),
      end: toIsoDay(year, event.month, clampDay(year, event.month, event.endDay)),
    };
  }
  if (event.day !== undefined) {
    const day = toIsoDay(year, event.month, clampDay(year, event.month, event.day));
    return { start: day, end: addDaysIso(day, resolveWindowLength(event) - 1) };
  }
  return undefined;
};

const buildKnownWindow = (event: DestinationEvent, year: number): { start: string; end: string } | undefined => {
  const start = event.knownDates?.[String(year)];
  if (!start) return undefined;
  return { start, end: addDaysIso(start, resolveWindowLength(event) - 1) };
};

/**
 * Resolves the next (or currently running) occurrence of an event.
 *
 * Rolls over the year boundary correctly: asked in December about a January
 * event, the answer is next year's January.
 */
export const resolveNextOccurrence = (event: DestinationEvent, now: Date): FestivalOccurrence => {
  const today = toIsoDayFromDate(now);
  const currentYear = now.getUTCFullYear();

  // A currently running window still counts as "upcoming", so start one year back.
  for (let offset = -1; offset <= MAX_LOOKAHEAD_YEARS; offset += 1) {
    const year = currentYear + offset;
    const known = buildKnownWindow(event, year);
    const fixed = known ? undefined : buildFixedWindow(event, year);
    const window = known || fixed;
    if (!window || window.end < today) continue;

    return {
      kind: 'exact',
      date: window.start,
      endDate: window.end,
      year: Number(window.start.slice(0, 4)),
      month: Number(window.start.slice(5, 7)),
      isOngoing: window.start <= today,
      source: known ? 'known' : 'fixed',
    };
  }

  // No exact date available — degrade honestly to the month it usually falls in.
  const currentMonth = now.getUTCMonth() + 1;
  const year = event.month >= currentMonth ? currentYear : currentYear + 1;
  return {
    kind: 'approximate',
    year,
    month: event.month,
    ...(event.monthQualifier ? { qualifier: event.monthQualifier } : {}),
  };
};

/**
 * Comparable key for "soonest first" ordering. Approximate occurrences are
 * placed at a nominal day inside their month — for ordering only, never shown.
 */
export const getOccurrenceSortKey = (occurrence: FestivalOccurrence): string => {
  if (occurrence.kind === 'exact') return occurrence.date;
  const day = QUALIFIER_SORT_DAY[occurrence.qualifier || 'mid'];
  return toIsoDay(occurrence.year, occurrence.month, day);
};

export interface FestivalWithOccurrence<TEvent extends DestinationEvent = DestinationEvent> {
  event: TEvent;
  occurrence: FestivalOccurrence;
}

/**
 * Attaches the resolved occurrence to each event and sorts soonest first.
 * Ties break on festival name so the order stays stable between renders.
 */
export const sortFestivalsByNextOccurrence = <TEvent extends DestinationEvent>(
  events: TEvent[],
  now: Date,
): Array<FestivalWithOccurrence<TEvent>> => events
  .map((event) => ({ event, occurrence: resolveNextOccurrence(event, now) }))
  .sort((left, right) => {
    const byDate = getOccurrenceSortKey(left.occurrence).localeCompare(getOccurrenceSortKey(right.occurrence));
    if (byDate !== 0) return byDate;
    return left.event.name.localeCompare(right.event.name);
  });

/** Trip window used to prefill Create Trip. Only exact occurrences produce dates. */
export const getOccurrenceTripWindow = (
  occurrence: FestivalOccurrence,
  paddingDays = 1,
): { startDate: string; endDate: string } | undefined => {
  if (occurrence.kind !== 'exact') return undefined;
  return {
    startDate: addDaysIso(occurrence.date, -paddingDays),
    endDate: addDaysIso(occurrence.endDate, paddingDays),
  };
};
