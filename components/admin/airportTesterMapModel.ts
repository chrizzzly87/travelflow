import type { AirportCommercialServiceTier, AirportReference, NearbyAirportsResponse } from '../../shared/airportReference';
import type { MapImplementation, MapRuntimeResolution } from '../../shared/mapRuntime';

export interface AirportTesterOrigin {
  label: string;
  lat: number;
  lng: number;
  countryCode: string | null;
  countryName: string | null;
}

export interface AirportTesterMapPoint {
  id: string;
  lat: number;
  lng: number;
  /** Short text drawn inside the pill on the map. */
  label: string;
  kind: 'origin' | 'airport';
  rank: number | null;
  airport: AirportReference | null;
  airDistanceKm: number | null;
  origin: AirportTesterOrigin | null;
}

export interface AirportTesterDetailRow {
  label: string;
  value: string;
}

export const AIRPORT_TESTER_ORIGIN_POINT_ID = 'origin';

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const formatAirportTesterDistance = (value: number): string => (
  `${value.toFixed(value >= 100 ? 0 : 1)} km`
);

export const formatAirportTesterTypeLabel = (airportType: AirportReference['airportType']): string => {
  if (airportType === 'large_airport') return 'Large';
  if (airportType === 'medium_airport') return 'Medium';
  return 'Small';
};

export const formatAirportTesterTierLabel = (tier: AirportCommercialServiceTier): string => {
  if (tier === 'major') return 'Major';
  if (tier === 'regional') return 'Regional';
  return 'Local';
};

export const resolveAirportCode = (airport: AirportReference): string => (
  airport.iataCode || airport.icaoCode || airport.ident
);

/**
 * The tester used to mount a Google map no matter which renderer the admin had
 * selected, so a deploy running the Mapbox renderer showed a permanently empty
 * canvas. Mapbox only wins when the runtime asks for it *and* a token shipped.
 */
export const resolveAirportTesterRenderer = ({
  runtime,
  mapboxAccessToken,
}: {
  runtime: Pick<MapRuntimeResolution, 'effectiveSelection'>;
  mapboxAccessToken: string;
}): MapImplementation => {
  if (runtime.effectiveSelection.renderer !== 'mapbox') return 'google';
  return mapboxAccessToken.trim().length > 0 ? 'mapbox' : 'google';
};

export const buildAirportTesterPoints = ({
  origin,
  result,
}: {
  origin: AirportTesterOrigin | null;
  result: NearbyAirportsResponse | null;
}): AirportTesterMapPoint[] => {
  const points: AirportTesterMapPoint[] = [];

  if (origin) {
    points.push({
      id: AIRPORT_TESTER_ORIGIN_POINT_ID,
      lat: origin.lat,
      lng: origin.lng,
      label: 'Origin',
      kind: 'origin',
      rank: null,
      airport: null,
      airDistanceKm: null,
      origin,
    });
  }

  (result?.airports || []).forEach((entry) => {
    points.push({
      id: `airport:${entry.airport.ident}:${entry.rank}`,
      lat: entry.airport.latitude,
      lng: entry.airport.longitude,
      label: resolveAirportCode(entry.airport),
      kind: 'airport',
      rank: entry.rank,
      airport: entry.airport,
      airDistanceKm: entry.airDistanceKm,
      origin: null,
    });
  });

  return points;
};

/**
 * One markup builder for both renderers so a Mapbox marker and a Google overlay
 * pill stay pixel-identical.
 */
export const buildAirportTesterPillHtml = ({
  point,
  selected,
}: {
  point: AirportTesterMapPoint;
  selected: boolean;
}): string => {
  const isOrigin = point.kind === 'origin';
  const background = isOrigin ? '#0f172a' : selected ? '#2563eb' : '#ffffff';
  const color = isOrigin || selected ? '#ffffff' : '#0f172a';
  const border = isOrigin ? '#0f172a' : selected ? '#1d4ed8' : '#cbd5e1';
  const shadow = selected ? '0 12px 28px rgba(37,99,235,0.34)' : '0 10px 24px rgba(15,23,42,0.18)';
  const style = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'white-space:nowrap',
    'border-radius:9999px',
    `min-width:${isOrigin ? '44px' : '34px'}`,
    `height:${isOrigin ? '34px' : '30px'}`,
    `padding:0 ${isOrigin ? '12px' : '8px'}`,
    `font-size:${isOrigin ? '11px' : '12px'}`,
    'font-weight:700',
    `background:${background}`,
    `color:${color}`,
    `border:1px solid ${border}`,
    `box-shadow:${shadow}`,
  ].join(';');

  const rankBadge = point.rank !== null
    ? `<span style="margin-right:4px;opacity:0.6">${point.rank}</span>`
    : '';

  return `<span style="${style}">${rankBadge}${escapeHtml(point.label)}</span>`;
};

export const buildAirportTesterDetailRows = (point: AirportTesterMapPoint): AirportTesterDetailRow[] => {
  const coordinates = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

  if (point.kind === 'origin') {
    const rows: AirportTesterDetailRow[] = [{ label: 'Coordinates', value: coordinates }];
    if (point.origin?.countryName || point.origin?.countryCode) {
      rows.push({
        label: 'Country',
        value: [point.origin?.countryName, point.origin?.countryCode].filter(Boolean).join(' · '),
      });
    }
    return rows;
  }

  const airport = point.airport;
  if (!airport) return [{ label: 'Coordinates', value: coordinates }];

  const rows: AirportTesterDetailRow[] = [
    { label: 'Codes', value: [airport.iataCode, airport.icaoCode, airport.ident].filter(Boolean).join(' · ') },
    {
      label: 'Location',
      value: [airport.municipality, airport.subdivisionName, airport.countryName]
        .filter(Boolean)
        .join(', ') || 'Unknown',
    },
    { label: 'Service tier', value: formatAirportTesterTierLabel(airport.commercialServiceTier) },
    { label: 'Airport type', value: formatAirportTesterTypeLabel(airport.airportType) },
    { label: 'Scheduled service', value: airport.scheduledService ? 'Yes' : 'No' },
    { label: 'Timezone', value: airport.timezone || 'Unknown' },
    { label: 'Coordinates', value: coordinates },
  ];

  if (point.airDistanceKm !== null) {
    rows.splice(2, 0, { label: 'Air distance', value: formatAirportTesterDistance(point.airDistanceKm) });
  }

  return rows;
};

export const buildAirportTesterDetailTitle = (point: AirportTesterMapPoint): string => {
  if (point.kind === 'origin') return point.origin?.label || 'Origin';
  if (!point.airport) return point.label;
  return point.rank !== null ? `${point.rank}. ${point.airport.name}` : point.airport.name;
};

export const __airportTesterMapModelInternals = {
  escapeHtml,
};
