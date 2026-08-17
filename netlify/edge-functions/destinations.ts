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

export const loadDestinationGuideDocumentFromDatabase = async (): Promise<DestinationGuideDocument | null> => {
  const supabaseUrl = readEnv('VITE_SUPABASE_URL').trim().replace(/\/$/, '');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY').trim();
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/destination_guides?select=payload&order=priority_rank.asc.nullslast,name.asc&limit=1000`,
    {
      headers: {
        accept: 'application/json',
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
    },
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null) as Array<{ payload?: DestinationGuideEntry }> | null;
  const guides = Array.isArray(rows) ? rows.flatMap((row) => row.payload ? [row.payload] : []) : [];
  const countryCount = guides.filter((guide) => guide.kind === 'country').length;
  if (countryCount !== STATIC_DOCUMENT.selection.countryCount) return null;

  return { ...STATIC_DOCUMENT, guides };
};

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

  if (segments.length === 1) {
    return json(200, {
      data: { ...country, children },
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
    },
    meta: { ...meta, inheritedFrom: country.id },
  });
};

export const __destinationEndpointInternals = { normalizeSlug, parseKind, parseLimit, resolveCountry };
