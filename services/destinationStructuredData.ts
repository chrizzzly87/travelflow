import type { DestinationGuideEntry, DestinationEvent } from '../shared/destinationGuides';
import type { ResolvedDestinationGuide } from './destinationGuideService';

export interface DestinationStructuredDataOptions {
  resolved: ResolvedDestinationGuide;
  canonicalUrl: string;
  description?: string;
  /** Reference date used to resolve the next occurrence of month-only events. */
  now?: Date;
}

const MONTH_PAD = (month: number): string => String(month).padStart(2, '0');

const DEFAULT_SITE_ORIGIN = 'https://travelflowapp.netlify.app';
const LOCAL_HOSTNAME_PATTERN = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$|\.local$/i;

const normalizeOrigin = (value?: string | null): string => {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (LOCAL_HOSTNAME_PATTERN.test(parsed.hostname)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
};

/** Absolute origin used for canonical JSON-LD URLs, falling back to the public site. */
export const resolveStructuredDataOrigin = (): string => {
  const envOrigin = normalizeOrigin(
    (import.meta as { env?: Record<string, unknown> }).env?.VITE_SITE_URL as string | undefined,
  );
  if (envOrigin) return envOrigin;
  if (typeof window !== 'undefined' && window.location) {
    const browserOrigin = normalizeOrigin(window.location.origin);
    if (browserOrigin) return browserOrigin;
  }
  return DEFAULT_SITE_ORIGIN;
};

/**
 * Guide events only carry a month, so we publish the next upcoming occurrence at
 * month precision (ISO 8601 `YYYY-MM`) instead of inventing an exact day.
 */
export const resolveEventStartDate = (month: number, now: Date): string | undefined => {
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined;
  const currentYear = now.getUTCFullYear();
  const year = month >= now.getUTCMonth() + 1 ? currentYear : currentYear + 1;
  return `${year}-${MONTH_PAD(month)}`;
};

const buildEventNode = (
  event: DestinationEvent,
  placeName: string,
  now: Date,
): Record<string, unknown> => {
  const startDate = resolveEventStartDate(event.month, now);
  return {
    '@type': 'Event',
    name: event.name,
    ...(event.summary ? { description: event.summary } : {}),
    ...(startDate ? { startDate } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: placeName },
    ...(event.sourceUrl ? { url: event.sourceUrl } : {}),
  };
};

const buildGeoNode = (guide: DestinationGuideEntry): Record<string, unknown> | undefined => {
  const latitude = guide.facts?.latitude;
  const longitude = guide.facts?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  return { '@type': 'GeoCoordinates', latitude, longitude };
};

export const buildDestinationStructuredData = ({
  resolved,
  canonicalUrl,
  description,
  now = new Date(),
}: DestinationStructuredDataOptions): Record<string, unknown> => {
  const { guide, country, effectiveEvents } = resolved;
  const geo = buildGeoNode(guide) || buildGeoNode(country);
  const resolvedDescription = description
    || guide.summary
    || guide.seasonality?.note
    || `Travel guide for ${guide.name} with the best months to visit, arrival airports and notable events.`;

  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: guide.name,
    description: resolvedDescription,
    url: canonicalUrl,
    ...(guide.tags.length > 0 ? { keywords: guide.tags.join(', ') } : {}),
    address: { '@type': 'PostalAddress', addressCountry: country.countryCode },
    containedInPlace: guide.kind === 'country'
      ? { '@type': 'Place', name: guide.region }
      : { '@type': 'Country', name: country.name },
    ...(geo ? { geo } : {}),
    ...(guide.highlights.length > 0
      ? {
        touristAttraction: guide.highlights.map((highlight) => ({
          '@type': 'TouristAttraction',
          name: highlight,
        })),
      }
      : {}),
    ...(effectiveEvents.length > 0
      ? { event: effectiveEvents.map((event) => buildEventNode(event, guide.name, now)) }
      : {}),
  };
};

/** Serializes JSON-LD safely for inline `<script>` embedding. */
export const serializeStructuredData = (data: Record<string, unknown>): string => (
  JSON.stringify(data).replace(/</g, '\\u003c')
);
