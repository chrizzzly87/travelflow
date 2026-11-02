/**
 * Published place recommendations for a country.
 *
 * GET /api/recommendations?country=TW
 *
 * Reads with the anon key so row-level security is what decides what is
 * visible — a draft must not leak through an endpoint that forgot a filter.
 * The client falls back to the repo dataset when this is unavailable, so a
 * failure here degrades to yesterday's data rather than an empty deck.
 */

import {
    RECOMMENDATION_ROW_COLUMNS,
    rowToRecommendation,
    type RecommendationRow,
} from '../../shared/recommendationRows.ts';

const JSON_HEADERS: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    // The library changes when an editor publishes, not per request. A short
    // edge cache keeps a deck opening instant without holding a correction back
    // for long.
    'Cache-Control': 'public, max-age=60',
    'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300',
    'Netlify-Vary': 'query=country',
};

const readEnv = (name: string): string => {
    try { return (globalThis as any).Deno?.env?.get(name) || ''; } catch { return ''; }
};

const json = (status: number, payload: unknown, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { ...JSON_HEADERS, ...headers },
    });

export default async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') {
        return json(405, { ok: false, error: 'Method not allowed.' }, { 'Cache-Control': 'no-store' });
    }

    const url = new URL(request.url);
    const country = (url.searchParams.get('country') || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
        return json(400, { ok: false, error: 'A two-letter country code is required.' }, { 'Cache-Control': 'no-store' });
    }

    const supabaseUrl = readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
    const anonKey = readEnv('VITE_SUPABASE_ANON_KEY').trim();
    if (!supabaseUrl || !anonKey) {
        // Not an error the traveller can act on: the client has the repo copy.
        return json(503, { ok: false, error: 'The recommendation library is not configured.' }, { 'Cache-Control': 'no-store' });
    }

    const select = RECOMMENDATION_ROW_COLUMNS.join(',');
    const query = `${supabaseUrl}/rest/v1/recommendations`
        + `?select=${select}`
        + `&country_code=eq.${encodeURIComponent(country)}`
        + '&status=eq.published'
        + '&order=title.asc&limit=2000';

    try {
        const response = await fetch(query, {
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        if (!response.ok) {
            return json(502, { ok: false, error: 'The recommendation library could not be read.' }, { 'Cache-Control': 'no-store' });
        }
        const rows = await response.json() as RecommendationRow[];
        return json(200, {
            ok: true,
            countryCode: country,
            recommendations: Array.isArray(rows) ? rows.map(rowToRecommendation) : [],
        });
    } catch {
        // Never leak the upstream error: it carries the project URL.
        return json(502, { ok: false, error: 'The recommendation library could not be read.' }, { 'Cache-Control': 'no-store' });
    }
};
