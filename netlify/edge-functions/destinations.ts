import destinationGuidesJson from '../../data/destinationGuides.json' with { type: 'json' };
import type {
  DestinationGuideDocument,
  DestinationGuideEntry,
  DestinationGuideKind,
} from '../../shared/destinationGuides.ts';

const STATIC_DOCUMENT = destinationGuidesJson as DestinationGuideDocument;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
};
const MAX_LIMIT = 100;

interface DestinationCountryProfileRow {
  source_provider: string;
  origin_url: string;
  source_fetched_at: string;
  source_updated_at: string | null;
  payload_hash: string;
  popularity: number | null;
  summary: string | null;
  alert_message: string | null;
  safety_tips: unknown[];
  bonus_tips: unknown[];
  static_sections: Record<string, unknown>;
  faqs: unknown[];
  recent_updates: unknown[];
  airports: unknown[];
  beaches: unknown[];
  cities: unknown[];
  weather: unknown[];
  exchange_rate: number | null;
  exchange_base: string | null;
}

const json = (status: number, payload: unknown, extraHeaders: Record<string, string> = {}): Response => (
  new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...extraHeaders } })
);

const normalizeSlug = (value: string): string => value
  .trim()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const parseLimit = (value: string | null): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
};

const parseKind = (value: string | null): DestinationGuideKind | null => {
  if (value === 'country' || value === 'city' || value === 'island') return value;
  return null;
};

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || '';
  } catch {
    return '';
  }
};

const databaseHeaders = (): { supabaseUrl: string; headers: Record<string, string> } | null => {
  const supabaseUrl = readEnv('VITE_SUPABASE_URL').trim().replace(/\/$/, '');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY').trim();
  return supabaseUrl && anonKey
    ? { supabaseUrl, headers: { accept: 'application/json', apikey: anonKey, authorization: `Bearer ${anonKey}` } }
    : null;
};

export const loadDestinationGuideDocumentFromDatabase = async (): Promise<DestinationGuideDocument | null> => {
  const database = databaseHeaders();
  if (!database) return null;

  const response = await fetch(
    `${database.supabaseUrl}/rest/v1/destination_guides?select=payload&order=priority_rank.asc.nullslast,name.asc&limit=1000`,
    { headers: database.headers },
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null) as Array<{ payload?: DestinationGuideEntry }> | null;
  const guides = Array.isArray(rows) ? rows.flatMap((row) => row.payload ? [row.payload] : []) : [];
  const countryCount = guides.filter((guide) => guide.kind === 'country').length;
  if (countryCount !== STATIC_DOCUMENT.selection.countryCount) return null;

  return { ...STATIC_DOCUMENT, guides };
};

export const loadDestinationCountryProfileFromDatabase = async (
  countryCode: string,
): Promise<DestinationCountryProfileRow | null> => {
  const database = databaseHeaders();
  if (!database) return null;
  const fields = [
    'source_provider', 'origin_url', 'source_fetched_at', 'source_updated_at', 'payload_hash',
    'popularity', 'summary', 'alert_message', 'safety_tips', 'bonus_tips', 'static_sections',
    'faqs', 'recent_updates', 'airports', 'beaches', 'cities', 'weather', 'exchange_rate', 'exchange_base',
  ].join(',');
  const response = await fetch(
    `${database.supabaseUrl}/rest/v1/destination_country_profiles?country_code=eq.${encodeURIComponent(countryCode)}&select=${fields}&limit=1`,
    { headers: database.headers },
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null) as DestinationCountryProfileRow[] | null;
  return Array.isArray(rows) ? rows[0] || null : null;
};

const serializeCountryProfile = (profile: DestinationCountryProfileRow) => ({
  popularity: profile.popularity,
  summary: profile.summary,
  alertMessage: profile.alert_message,
  safetyTips: profile.safety_tips,
  bonusTips: profile.bonus_tips,
  sections: profile.static_sections,
  faqs: profile.faqs,
  recentUpdates: profile.recent_updates,
  airports: profile.airports,
  beaches: profile.beaches,
  cities: profile.cities,
  weather: profile.weather,
  exchange: { rate: profile.exchange_rate, base: profile.exchange_base },
});

const serializeProvenance = (profile: DestinationCountryProfileRow) => ({
  provider: profile.source_provider,
  originUrl: profile.origin_url,
  fetchedAt: profile.source_fetched_at,
  sourceUpdatedAt: profile.source_updated_at,
  payloadHash: profile.payload_hash,
});

const loadDocument = async (): Promise<{ document: DestinationGuideDocument; source: 'database' | 'snapshot' }> => {
  const databaseDocument = await loadDestinationGuideDocumentFromDatabase().catch(() => null);
  return databaseDocument
    ? { document: databaseDocument, source: 'database' }
    : { document: STATIC_DOCUMENT, source: 'snapshot' };
};

const resolveCountry = (document: DestinationGuideDocument, value: string): DestinationGuideEntry | undefined => {
  const lookup = normalizeSlug(value);
  return document.guides.find((guide) => guide.kind === 'country' && (
    guide.slug === lookup || normalizeSlug(guide.name) === lookup || normalizeSlug(guide.countryCode) === lookup
  ));
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' }, { allow: 'GET' });
  }

  const url = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/destinations\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const { document, source } = await loadDocument();
  const meta = { schemaVersion: document.schemaVersion, generatedAt: document.generatedAt, source };

  if (segments.length === 0) {
    const requestedKind = url.searchParams.get('type') || url.searchParams.get('kind');
    const kind = requestedKind ? parseKind(requestedKind) : 'country';
    if (!kind) return json(400, { ok: false, error: 'type must be country, city, or island' });
    const countryCode = url.searchParams.get('country')?.trim().toUpperCase();
    const parentSlug = url.searchParams.get('parent') ? normalizeSlug(url.searchParams.get('parent') || '') : null;
    const data = document.guides
      .filter((guide) => guide.kind === kind)
      .filter((guide) => !countryCode || guide.countryCode === countryCode)
      .filter((guide) => !parentSlug || guide.parentSlug === parentSlug)
      .sort((left, right) => kind === 'country'
        ? (left.priorityRank || Number.MAX_SAFE_INTEGER) - (right.priorityRank || Number.MAX_SAFE_INTEGER)
        : left.name.localeCompare(right.name))
      .slice(0, parseLimit(url.searchParams.get('limit')));
    return json(200, { data, meta: { ...meta, count: data.length } });
  }

  const country = resolveCountry(document, segments[0]);
  if (!country) return json(404, { ok: false, error: 'Destination country not found' });
  const children = document.guides.filter((guide) => guide.parentSlug === country.slug);
  const countryProfile = await loadDestinationCountryProfileFromDatabase(country.countryCode).catch(() => null);
  const includeProfile = url.searchParams.get('include')?.split(',').includes('source-profile') || false;

  if (segments.length === 1) {
    return json(200, {
      data: {
        ...country,
        children,
        provenance: countryProfile ? serializeProvenance(countryProfile) : null,
        ...(includeProfile && countryProfile ? { sourceProfile: serializeCountryProfile(countryProfile) } : {}),
      },
      meta: { ...meta, inheritedFrom: null },
    });
  }

  const childLookup = normalizeSlug(segments[1]);
  const child = children.find((guide) => guide.slug === childLookup || normalizeSlug(guide.name) === childLookup);
  if (!child) return json(404, { ok: false, error: 'Nested destination not found' });
  return json(200, {
    data: {
      ...child,
      country: { id: country.id, name: country.name, slug: country.slug, countryCode: country.countryCode },
      seasonality: child.seasonality || country.seasonality,
      events: child.events.length > 0 ? child.events : country.events,
      provenance: countryProfile ? serializeProvenance(countryProfile) : null,
      ...(includeProfile && countryProfile ? { sourceProfile: serializeCountryProfile(countryProfile) } : {}),
    },
    meta: { ...meta, inheritedFrom: country.id },
  });
};

export const __destinationEndpointInternals = {
  normalizeSlug,
  parseKind,
  parseLimit,
  resolveCountry,
  serializeCountryProfile,
  serializeProvenance,
};
