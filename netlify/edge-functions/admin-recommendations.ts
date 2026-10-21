/**
 * Admin CRUD for the place recommendation library.
 *
 *   GET  /api/admin/recommendations?country=TW
 *   POST /api/admin/recommendations  { action: 'save' | 'delete' | 'setStatus' | 'import', ... }
 *
 * Mirrors `admin-destinations`: the caller's own token proves the admin role,
 * and the writes then run on the service role so drafts and retired rows stay
 * invisible to row-level security everywhere else.
 */

import { validateRecommendationDraft, RECOMMENDATION_ROW_COLUMNS } from '../../shared/recommendationRows.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

interface SupabaseConfig { url: string; anonKey: string; serviceRoleKey: string }

const readEnv = (name: string): string => {
    try { return (globalThis as any).Deno?.env?.get(name) || ''; } catch { return ''; }
};

const getConfig = (): SupabaseConfig | null => {
    const url = readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
    const anonKey = readEnv('VITE_SUPABASE_ANON_KEY').trim();
    const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY').trim();
    return url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null;
};

const parseJson = async (response: Response): Promise<any> => {
    const text = await response.text();
    try { return text ? JSON.parse(text) : null; } catch { return null; }
};

const serviceHeaders = (config: SupabaseConfig, prefer?: string): HeadersInit => ({
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
});

const authorize = async (request: Request, config: SupabaseConfig): Promise<string | Response> => {
    const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) return json(401, { ok: false, error: 'Authentication required.' });
    const response = await fetch(`${config.url}/rest/v1/rpc/get_current_user_access`, {
        method: 'POST',
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${match[1]}`,
            'Content-Type': 'application/json',
            Prefer: 'params=single-object',
        },
        body: '{}',
    });
    const payload = await parseJson(response);
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!response.ok || row?.system_role !== 'admin') return json(403, { ok: false, error: 'Admin role required.' });
    return typeof row.user_id === 'string' && row.user_id ? row.user_id : json(403, { ok: false, error: 'Admin actor id is missing.' });
};

const requireOk = async (response: Response, fallback: string): Promise<any> => {
    const payload = await parseJson(response);
    if (!response.ok) throw new Error(payload?.message || payload?.error || fallback);
    return payload;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Every row for a country, drafts included — this is the editor's list. */
const loadCatalog = async (config: SupabaseConfig, country: string) => {
    const select = [...RECOMMENDATION_ROW_COLUMNS, 'updated_at', 'created_at'].join(',');
    const filter = country ? `&country_code=eq.${encodeURIComponent(country)}` : '';
    const response = await fetch(
        `${config.url}/rest/v1/recommendations?select=${select}${filter}&order=updated_at.desc&limit=2000`,
        { headers: serviceHeaders(config) },
    );
    const rows = await requireOk(response, 'Could not load the recommendation library.');

    const countriesResponse = await fetch(
        `${config.url}/rest/v1/recommendations?select=country_code&limit=5000`,
        { headers: serviceHeaders(config) },
    );
    const all = await requireOk(countriesResponse, 'Could not load the country list.');
    const countries = Array.from(new Set(
        (Array.isArray(all) ? all : []).map((entry: { country_code?: string }) => entry.country_code).filter(Boolean),
    )).sort();

    return { rows: Array.isArray(rows) ? rows : [], countries };
};

const saveRecommendation = async (config: SupabaseConfig, actorUserId: string, body: Record<string, unknown>) => {
    const validation = validateRecommendationDraft(body.recommendation);
    if ('error' in validation) throw new Error(validation.error);

    const response = await fetch(`${config.url}/rest/v1/recommendations?on_conflict=id`, {
        method: 'POST',
        headers: serviceHeaders(config, 'return=representation,resolution=merge-duplicates'),
        body: JSON.stringify({ ...validation.row, updated_by: actorUserId }),
    });
    const rows = await requireOk(response, 'Could not save the recommendation.');
    return Array.isArray(rows) ? rows[0] : rows;
};

const setStatus = async (config: SupabaseConfig, actorUserId: string, body: Record<string, unknown>) => {
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : '';
    if (!id) throw new Error('A recommendation id is required.');
    if (!['draft', 'in_review', 'published', 'rejected', 'retired'].includes(status)) {
        throw new Error('Status must be one of draft, in review, published, rejected or retired.');
    }
    const response = await fetch(`${config.url}/rest/v1/recommendations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: serviceHeaders(config, 'return=representation'),
        body: JSON.stringify({ status, updated_by: actorUserId }),
    });
    const rows = await requireOk(response, 'Could not change the status.');
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('That recommendation no longer exists.');
    return rows[0];
};

const deleteRecommendation = async (config: SupabaseConfig, body: Record<string, unknown>) => {
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) throw new Error('A recommendation id is required.');
    const response = await fetch(`${config.url}/rest/v1/recommendations?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: serviceHeaders(config, 'return=representation'),
    });
    const rows = await requireOk(response, 'Could not delete the recommendation.');
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('That recommendation no longer exists.');
    return rows[0];
};

/**
 * Bulk upsert, used to seed a country from the repo dataset.
 *
 * Chunked because a single request carrying two thousand rows is the kind of
 * payload that fails at the gateway rather than in the database.
 */
const importRecommendations = async (config: SupabaseConfig, actorUserId: string, body: Record<string, unknown>) => {
    const entries = Array.isArray(body.recommendations) ? body.recommendations : [];
    if (entries.length === 0) throw new Error('No recommendations were supplied.');
    if (entries.length > 1000) throw new Error('Import at most 1000 recommendations at a time.');

    const rows: Record<string, unknown>[] = [];
    for (const entry of entries) {
        const validation = validateRecommendationDraft(entry);
        if ('error' in validation) throw new Error(validation.error);
        rows.push({ ...validation.row, updated_by: actorUserId });
    }

    let imported = 0;
    const CHUNK = 100;
    for (let index = 0; index < rows.length; index += CHUNK) {
        const response = await fetch(`${config.url}/rest/v1/recommendations?on_conflict=id`, {
            method: 'POST',
            headers: serviceHeaders(config, 'return=minimal,resolution=merge-duplicates'),
            body: JSON.stringify(rows.slice(index, index + CHUNK)),
        });
        await requireOk(response, 'Could not import the recommendations.');
        imported += Math.min(CHUNK, rows.length - index);
    }
    return { imported };
};

export default async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'POST') {
        return json(405, { ok: false, error: 'Method not allowed.' });
    }
    const config = getConfig();
    if (!config) return json(503, { ok: false, error: 'Recommendation administration is not configured.' });

    const authorization = await authorize(request, config);
    if (authorization instanceof Response) return authorization;

    try {
        if (request.method === 'GET') {
            const country = (new URL(request.url).searchParams.get('country') || '').trim().toUpperCase();
            return json(200, { ok: true, ...(await loadCatalog(config, /^[A-Z]{2}$/.test(country) ? country : '')) });
        }

        const parsed = await request.json().catch(() => null);
        const body = isPlainObject(parsed) ? parsed : {};
        if (body.action === 'save') {
            return json(200, { ok: true, recommendation: await saveRecommendation(config, authorization, body) });
        }
        if (body.action === 'setStatus') {
            return json(200, { ok: true, recommendation: await setStatus(config, authorization, body) });
        }
        if (body.action === 'delete') {
            return json(200, { ok: true, deleted: await deleteRecommendation(config, body) });
        }
        if (body.action === 'import') {
            return json(200, { ok: true, ...(await importRecommendations(config, authorization, body)) });
        }
        return json(400, { ok: false, error: 'Unsupported recommendation admin action.' });
    } catch (error) {
        return json(400, { ok: false, error: error instanceof Error ? error.message : 'Recommendation admin request failed.' });
    }
};
