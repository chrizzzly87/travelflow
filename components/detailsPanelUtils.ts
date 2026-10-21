export interface RouteDistanceTextInput {
  routeDistanceLabel: string | null;
  canRoute: boolean;
  routeStatus?: 'calculating' | 'ready' | 'failed' | 'idle';
}

export interface HotelSearchResult {
  id: string;
  name: string;
  address: string;
}

export type SearchByTextResponseShape = {
  places?: Array<{
    id?: string;
    displayName?: string | { text?: string };
    formattedAddress?: string;
  }>;
};

// Activities can be much shorter than a city stay, so they are edited in hours
// while `ITimelineItem.duration` stays in days.
export const ACTIVITY_MIN_DURATION_HOURS = 0.5;
export const ACTIVITY_MAX_DURATION_HOURS = 24 * 30;

export const clampActivityDurationHours = (hours: number): number => {
  if (!Number.isFinite(hours)) return ACTIVITY_MIN_DURATION_HOURS;
  return Math.min(ACTIVITY_MAX_DURATION_HOURS, Math.max(ACTIVITY_MIN_DURATION_HOURS, hours));
};

export const activityDurationDaysToHours = (days: number): number => (
  Math.round(days * 24 * 10) / 10
);

export const formatActivityDuration = (days: number): string => {
  const safeDays = Number.isFinite(days) ? Math.max(0, days) : 0;
  if (safeDays >= 1) {
    const rounded = Number(safeDays.toFixed(2));
    return `${rounded} day${rounded === 1 ? '' : 's'}`;
  }
  const hours = Number((safeDays * 24).toFixed(1));
  return `${hours} hour${hours === 1 ? '' : 's'}`;
};

export const getRouteDistanceText = ({
  routeDistanceLabel,
  canRoute,
  routeStatus,
}: RouteDistanceTextInput): string => {
  if (routeDistanceLabel) return routeDistanceLabel;
  if (!canRoute) return 'N/A';
  if (routeStatus === 'calculating') return 'Calculating…';
  return 'N/A';
};

const resolvePlaceDisplayName = (displayName: unknown): string => {
  if (typeof displayName === 'string') return displayName.trim();
  if (displayName && typeof displayName === 'object') {
    const text = (displayName as { text?: unknown }).text;
    if (typeof text === 'string') return text.trim();
  }
  return '';
};

export const mapSearchByTextPlacesToHotelResults = (
  response: SearchByTextResponseShape | null | undefined,
): HotelSearchResult[] => {
  const places = Array.isArray(response?.places) ? response.places : [];
  return places
    .flatMap((place) => {
      const name = resolvePlaceDisplayName(place?.displayName) || 'Hotel';
      const address = (place?.formattedAddress || '').trim();
      const id = (place?.id || '').trim() || `${name}-${address}`;
      if (id.length === 0) return [];
      return [{ id, name, address }];
    })
    .slice(0, 5);
};
