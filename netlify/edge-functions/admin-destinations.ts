import {
  isPlainObject,
  validateDestinationOverridePatch,
  type DestinationOverrideStatus,
  type DestinationOverrideTargetKind,
} from '../../shared/destinationContentOverrides.ts';

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
    headers: { apikey: config.anonKey, Authorization: `Bearer ${match[1]}`, 'Content-Type': 'application/json', Prefer: 'params=single-object' },
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

const loadAdminCatalog = async (config: SupabaseConfig) => {
  const headers = serviceHeaders(config);
  const guideFields = 'id,slug,kind,country_code,parent_id,name,region,priority_rank,source_updated_at,reviewed_at,payload';
  const profileFields = 'country_code,name,slug,region,source_provider,origin_url,source_fetched_at,source_updated_at,updated_at,popularity,currency_code,timezone,calling_code,summary,alert_message,safety_tips,bonus_tips,static_sections,faqs,recent_updates,airports,beaches,cities,weather,exchange_rate,exchange_base';
  const [guidesResponse, profilesResponse, overridesResponse, runsResponse, referralsResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/destination_guides?select=${guideFields}&order=name.asc&limit=1000`, { headers }),
    fetch(`${config.url}/rest/v1/destination_country_profiles?select=${profileFields}&order=name.asc&limit=500`, { headers }),
    fetch(`${config.url}/rest/v1/destination_content_overrides?select=*&order=updated_at.desc&limit=1000`, { headers }),
    fetch(`${config.url}/rest/v1/destination_import_runs?select=id,provider,status,schema_version,expected_records,fetched_records,changed_records,unchanged_records,failed_records,started_at,completed_at,metadata,error_summary&order=started_at.desc&limit=20`, { headers }),
    fetch(`${config.url}/rest/v1/destination_referral_links?select=id&limit=1`, { headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } }),
  ]);
  const [guides, profiles, overrides, importRuns] = await Promise.all([
    requireOk(guidesResponse, 'Could not load guides.'),
    requireOk(profilesResponse, 'Could not load profiles.'),
    requireOk(overridesResponse, 'Could not load overrides.'),
    requireOk(runsResponse, 'Could not load import runs.'),
  ]);
  if (!referralsResponse.ok) throw new Error('Could not load referral count.');
  const contentRange = referralsResponse.headers.get('content-range') || '';
  const referralCount = Number(contentRange.split('/')[1]) || 0;
  return { guides, profiles, overrides, importRuns, referralCount };
};

const normalizeRequestBody = (value: unknown) => isPlainObject(value) ? value : {};

const saveOverride = async (config: SupabaseConfig, actorUserId: string, body: Record<string, unknown>) => {
  const targetKind = body.targetKind as DestinationOverrideTargetKind;
  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  const status = body.status as DestinationOverrideStatus;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null;
  if ((targetKind !== 'guide' && targetKind !== 'country_profile') || !targetId) throw new Error('A valid override target is required.');
  if (status !== 'draft' && status !== 'published') throw new Error('Status must be draft or published.');
  const validation = validateDestinationOverridePatch(targetKind, body.patch);
  if ('error' in validation) throw new Error(validation.error);

  const targetTable = targetKind === 'guide' ? 'destination_guides' : 'destination_country_profiles';
  const targetColumn = targetKind === 'guide' ? 'id' : 'country_code';
  const targetResponse = await fetch(
    `${config.url}/rest/v1/${targetTable}?${targetColumn}=eq.${encodeURIComponent(targetId)}&select=${targetColumn}&limit=1`,
    { headers: serviceHeaders(config) },
  );
  const targets = await requireOk(targetResponse, 'Could not verify the override target.');
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('Override target does not exist.');

  const encodedKind = encodeURIComponent(targetKind);
  const encodedId = encodeURIComponent(targetId);
  const existingResponse = await fetch(
    `${config.url}/rest/v1/destination_content_overrides?target_kind=eq.${encodedKind}&target_id=eq.${encodedId}&select=id&limit=1`,
    { headers: serviceHeaders(config) },
  );
  const existing = await requireOk(existingResponse, 'Could not inspect the current override.');
  const now = new Date().toISOString();
  const payload = { target_kind: targetKind, target_id: targetId, status, patch: validation.patch, note, updated_by: actorUserId, updated_at: now };
  const response = Array.isArray(existing) && existing.length > 0
    ? await fetch(`${config.url}/rest/v1/destination_content_overrides?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: 'PATCH', headers: serviceHeaders(config, 'return=representation'), body: JSON.stringify(payload),
      })
    : await fetch(`${config.url}/rest/v1/destination_content_overrides`, {
        method: 'POST', headers: serviceHeaders(config, 'return=representation'), body: JSON.stringify({ ...payload, created_by: actorUserId }),
      });
  const rows = await requireOk(response, 'Could not save the destination override.');
  return Array.isArray(rows) ? rows[0] : rows;
};

const deleteOverride = async (config: SupabaseConfig, body: Record<string, unknown>) => {
  const targetKind = body.targetKind;
  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  if ((targetKind !== 'guide' && targetKind !== 'country_profile') || !targetId) throw new Error('A valid override target is required.');
  const response = await fetch(
    `${config.url}/rest/v1/destination_content_overrides?target_kind=eq.${encodeURIComponent(targetKind)}&target_id=eq.${encodeURIComponent(targetId)}`,
    { method: 'DELETE', headers: serviceHeaders(config, 'return=representation') },
  );
  return requireOk(response, 'Could not reset the destination override.');
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });
  const config = getConfig();
  if (!config) return json(503, { ok: false, error: 'Destination administration is not configured.' });
  const authorization = await authorize(request, config);
  if (authorization instanceof Response) return authorization;
  try {
    if (request.method === 'GET') return json(200, { ok: true, ...(await loadAdminCatalog(config)) });
    const body = normalizeRequestBody(await request.json().catch(() => null));
    if (body.action === 'saveOverride') return json(200, { ok: true, override: await saveOverride(config, authorization, body) });
    if (body.action === 'deleteOverride') return json(200, { ok: true, deleted: await deleteOverride(config, body) });
    return json(400, { ok: false, error: 'Unsupported destination admin action.' });
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : 'Destination admin request failed.' });
  }
};

export const __adminDestinationInternals = { normalizeRequestBody };
