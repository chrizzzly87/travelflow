import { cleanDestinationSourceUrl } from './destinationGuides';

export interface AtobeachCountryPayload extends Record<string, unknown> {
  id: number;
  name: string;
  code: string;
  slug: string;
  description?: string;
  region?: string;
  currency_code?: string;
  timezone?: string;
  latitude?: string | number;
  longitude?: string | number;
  popularity?: number;
  calling_code?: string;
  safety_tips?: string[];
  bonus_tips?: string[];
  alert_message?: string | null;
  airports?: Array<{ iata: string; name: string }>;
  beaches?: Array<{ name: string; image_url?: string }>;
  cities?: Array<{ name: string; slug: string }>;
  weather?: Array<Record<string, unknown>>;
  exchange_rate?: number;
  exchange_base?: string;
  recent_updates?: Array<{ timestamp?: string } & Record<string, unknown>>;
}

export interface AtobeachCountrySourceRecord {
  provider: 'atobeach';
  sourceRecordId: string;
  originUrl: string;
  fetchedAt: string;
  payloadHash: string;
  payload: AtobeachCountryPayload;
}

export interface AtobeachCountrySourceDocument {
  schemaVersion: 1;
  provider: 'atobeach';
  listOriginUrl: string;
  generatedAt: string;
  recordCount: number;
  records: AtobeachCountrySourceRecord[];
}

export interface SanitizedSourceUrl {
  fieldPath: string;
  canonicalUrl: string;
  isReferral: boolean;
  removedTrackingParameters: string[];
}

export interface NormalizedAtobeachCountryRecord {
  sourceRow: Record<string, unknown>;
  versionRow: Record<string, unknown>;
  profileRow: Record<string, unknown>;
  referralRows: Array<Record<string, unknown>>;
}

const PROFILE_SECTION_KEYS = new Set([
  'spf_recommendations',
  'electrical_info',
  'driving_info',
  'emergency_info',
  'tipping_info',
  'card_info',
  'mobile_info',
  'internet_info',
  'health_info',
  'entry_requirements',
  'embassy_info',
]);

const sanitizePayloadUrls = (
  value: unknown,
  path: string[] = [],
  discovered: SanitizedSourceUrl[] = [],
): { payload: unknown; discovered: SanitizedSourceUrl[] } => {
  if (Array.isArray(value)) {
    return {
      payload: value.map((item, index) => sanitizePayloadUrls(item, [...path, String(index)], discovered).payload),
      discovered,
    };
  }

  if (value && typeof value === 'object') {
    return {
      payload: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          sanitizePayloadUrls(item, [...path, key], discovered).payload,
        ]),
      ),
      discovered,
    };
  }

  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) {
    return { payload: value, discovered };
  }

  const cleaned = cleanDestinationSourceUrl(value);
  const fieldPath = path.join('.');
  const isReferral = cleaned.removedTrackingParameters.length > 0
    || /(?:purchase|affiliate|referral)/i.test(fieldPath);
  discovered.push({
    fieldPath,
    canonicalUrl: cleaned.url,
    isReferral,
    removedTrackingParameters: cleaned.removedTrackingParameters,
  });
  return { payload: cleaned.url, discovered };
};

const parseCoordinate = (value: string | number | undefined): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const latestSourceTimestamp = (payload: AtobeachCountryPayload): string | null => {
  const timestamps = (payload.recent_updates || [])
    .map((update) => String(update.timestamp || ''))
    .filter(Boolean)
    .sort();
  return timestamps.at(-1) || null;
};

export const normalizeAtobeachCountryRecord = (
  record: AtobeachCountrySourceRecord,
  importRunId: string,
): NormalizedAtobeachCountryRecord => {
  const sanitized = sanitizePayloadUrls(record.payload);
  const payload = sanitized.payload as AtobeachCountryPayload;
  const sourceId = `atobeach:${record.sourceRecordId}`;
  const countryCode = payload.code.toUpperCase();
  const staticSections = Object.fromEntries(
    Object.entries(payload).filter(([key]) => PROFILE_SECTION_KEYS.has(key)),
  );

  const sourceRow = {
    id: sourceId,
    provider: record.provider,
    source_record_id: record.sourceRecordId,
    entity_kind: 'country',
    origin_url: record.originUrl,
    country_code: countryCode,
    slug: payload.slug,
    payload_hash: record.payloadHash,
    acquisition_payload_hash: record.payloadHash,
    payload,
    source_updated_at: latestSourceTimestamp(payload),
    fetched_at: record.fetchedAt,
    last_seen_at: record.fetchedAt,
    last_import_run_id: importRunId,
  };

  return {
    sourceRow,
    versionRow: {
      source_record_id: sourceId,
      origin_url: record.originUrl,
      payload_hash: record.payloadHash,
      acquisition_payload_hash: record.payloadHash,
      payload,
      fetched_at: record.fetchedAt,
      import_run_id: importRunId,
    },
    profileRow: {
      country_code: countryCode,
      source_record_id: sourceId,
      source_provider: record.provider,
      source_country_id: record.sourceRecordId,
      origin_url: record.originUrl,
      name: payload.name,
      slug: payload.slug,
      region: payload.region || 'Other',
      popularity: payload.popularity ?? null,
      latitude: parseCoordinate(payload.latitude),
      longitude: parseCoordinate(payload.longitude),
      currency_code: payload.currency_code || null,
      timezone: payload.timezone || null,
      calling_code: payload.calling_code || null,
      summary: payload.description || null,
      alert_message: payload.alert_message || null,
      safety_tips: payload.safety_tips || [],
      bonus_tips: payload.bonus_tips || [],
      static_sections: staticSections,
      faqs: payload.faqs || [],
      recent_updates: payload.recent_updates || [],
      airports: payload.airports || [],
      beaches: payload.beaches || [],
      cities: payload.cities || [],
      weather: payload.weather || [],
      exchange_rate: payload.exchange_rate ?? null,
      exchange_base: payload.exchange_base || null,
      source_fetched_at: record.fetchedAt,
      source_updated_at: latestSourceTimestamp(payload),
      payload_hash: record.payloadHash,
      updated_at: record.fetchedAt,
    },
    referralRows: sanitized.discovered
      .filter((link) => link.isReferral)
      .map((link) => ({
        source_record_id: sourceId,
        source_provider: record.provider,
        field_path: link.fieldPath,
        provider: new URL(link.canonicalUrl).hostname.replace(/^www\./, ''),
        canonical_url: link.canonicalUrl,
        is_referral: true,
        removed_tracking_parameters: link.removedTrackingParameters,
        origin_url: record.originUrl,
        is_active: true,
        last_seen_at: record.fetchedAt,
        last_import_run_id: importRunId,
      })),
  };
};

export const validateAtobeachSourceDocument = (
  document: AtobeachCountrySourceDocument,
): string[] => {
  const errors: string[] = [];
  if (document.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (document.provider !== 'atobeach') errors.push('provider must be atobeach');
  if (document.recordCount !== document.records.length) errors.push('recordCount does not match records length');

  const countryCodes = new Set<string>();
  const slugs = new Set<string>();
  document.records.forEach((record) => {
    if (!/^https:\/\/atobeach\.com\/api\/countries\/[a-z0-9-]+\/$/.test(record.originUrl)) {
      errors.push(`${record.sourceRecordId}: invalid originUrl`);
    }
    if (!/^[a-f0-9]{64}$/.test(record.payloadHash)) errors.push(`${record.sourceRecordId}: invalid payloadHash`);
    if (!/^[A-Z]{2}$/.test(record.payload.code)) errors.push(`${record.sourceRecordId}: invalid country code`);
    if (countryCodes.has(record.payload.code)) errors.push(`duplicate country code: ${record.payload.code}`);
    if (slugs.has(record.payload.slug)) errors.push(`duplicate slug: ${record.payload.slug}`);
    countryCodes.add(record.payload.code);
    slugs.add(record.payload.slug);
  });
  return errors;
};
