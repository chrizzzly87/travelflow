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
