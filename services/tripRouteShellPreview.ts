import { getTripById } from './storageService';
import { getStoredAppLanguage } from './appRuntimeUtils';
import { getTripSpan } from '../shared/tripSpan';

/**
 * What the loading placeholder can know about a trip before the trip loads.
 *
 * A trip the traveller has opened on this device is already in local storage,
 * so the day strip can show the real dates from the first frame instead of
 * grey circles that are then replaced by different-looking ones.
 */
export interface TripRouteShellPreviewDay {
  /** Short weekday, e.g. "Mon" — matches the day strip's own formatting. */
  weekdayLabel: string;
  dayOfMonthLabel: string;
  /** Short month, shown above the first day of each month. */
  monthLabel: string;
  /** True on the first day of the trip and on each month boundary. */
  isMonthStart: boolean;
}

/** More days than any strip shows before the traveller scrolls. */
const MAX_PREVIEW_DAYS = 24;

/**
 * Reading every trip out of local storage parses the whole store, and the shell
 * renders two or three times per navigation. The answer cannot change while the
 * placeholder is up, so it is resolved once per trip id.
 */
const previewCache = new Map<string, TripRouteShellPreviewDay[] | null>();

const buildPreviewDays = (tripId: string): TripRouteShellPreviewDay[] | null => {
  const trip = getTripById(tripId);
  if (!trip || !trip.startDate) return null;

  const span = getTripSpan(trip);
  if (!Number.isFinite(span.days) || span.days <= 0) return null;

  const locale = getStoredAppLanguage();
  const dayCount = Math.min(MAX_PREVIEW_DAYS, span.days);
  const days: TripRouteShellPreviewDay[] = [];

  for (let index = 0; index < dayCount; index += 1) {
    const date = new Date(span.startDate);
    date.setDate(date.getDate() + index);
    days.push({
      weekdayLabel: date.toLocaleDateString(locale, { weekday: 'short' }),
      dayOfMonthLabel: date.toLocaleDateString(locale, { day: 'numeric' }),
      monthLabel: date.toLocaleDateString(locale, { month: 'short' }),
      isMonthStart: index === 0 || date.getDate() === 1,
    });
  }

  return days.length > 0 ? days : null;
};

/**
 * The trip's days, or null when nothing local is known about it — a shared
 * trip, an example trip, or the first time this device opens it. Callers fall
 * back to placeholder circles in that case.
 */
export const readTripRouteShellPreviewDays = (
  tripId: string | undefined,
): TripRouteShellPreviewDay[] | null => {
  if (!tripId) return null;
  if (previewCache.has(tripId)) return previewCache.get(tripId) ?? null;

  let days: TripRouteShellPreviewDay[] | null = null;
  try {
    days = buildPreviewDays(tripId);
  } catch {
    // A corrupt or unreadable store must not keep the planner from opening.
    days = null;
  }

  previewCache.set(tripId, days);
  return days;
};

export const resetTripRouteShellPreviewForTests = (): void => {
  previewCache.clear();
};
