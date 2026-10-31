import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import tripDraftsEndpoint from '../../netlify/edge-functions/trip-drafts';
import mcpEndpoint from '../../netlify/edge-functions/mcp';
import { TRIP_DRAFT_EXAMPLE_REQUEST } from '../../shared/tripDrafts';

const ORIGIN = 'https://travelflowapp.netlify.app';

const stubEnv = () => vi.stubGlobal('Deno', { env: { get: (name: string) => ({
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
} as Record<string, string>)[name] } });

const post = (path: string, body: unknown, headers: Record<string, string> = {}) => new Request(`${ORIGIN}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const rpcCalls = (fetchMock: ReturnType<typeof vi.fn>, name: string) => fetchMock.mock.calls
  .filter(([input]) => String(input).endsWith(`/rpc/${name}`))
  .map(([, init]) => JSON.parse(String((init as RequestInit).body)));

describe('trip drafts HTTP API', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stubEnv();
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/rpc/create_trip_draft')) return Response.json([{ ok: true, code: 'created', draft_id: 'x', expires_at: '2026-11-30T00:00:00Z' }]);
      if (url.endsWith('/rpc/get_trip_draft')) {
        return Response.json([{ id: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', title: 'Portugal', start_date: '2027-05-03', round_trip: false, data: { id: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', items: [] }, source: 'mcp', status: 'draft', view_count: 2, claim_count: 0, expires_at: null, created_at: '2026-10-31T00:00:00Z' }]);
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('serves the schema and OpenAPI documents with a CDN cache and open CORS', async () => {
    const schema = await tripDraftsEndpoint(new Request(`${ORIGIN}/api/trip-drafts/schema`));
    expect(schema.status).toBe(200);
    expect(schema.headers.get('access-control-allow-origin')).toBe('*');
    expect(schema.headers.get('netlify-cdn-cache-control')).toContain('s-maxage');
    expect((await schema.json()).example.trip.tripTitle).toBe('Portugal: Lisbon to Porto');

    const openapi = await (await tripDraftsEndpoint(new Request(`${ORIGIN}/api/trip-drafts/openapi.json`))).json();
    expect(openapi.openapi).toBe('3.1.0');
    expect(openapi.paths['/api/trip-drafts'].post.operationId).toBe('createTripDraft');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates without touching the database', async () => {
    const ok = await tripDraftsEndpoint(post('/api/trip-drafts/validate', TRIP_DRAFT_EXAMPLE_REQUEST));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, cityCount: 2, title: 'Portugal: Lisbon to Porto' });

    const bad = await tripDraftsEndpoint(post('/api/trip-drafts/validate', { trip: { tripTitle: 'x' } }));
    expect(bad.status).toBe(422);
    const body = await bad.json();
    expect(body.code).toBe('validation_failed');
    expect(body.errors.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a draft, hashes the caller IP and returns the share link', async () => {
    const response = await tripDraftsEndpoint(
      post('/api/trip-drafts', TRIP_DRAFT_EXAMPLE_REQUEST, { 'X-TravelFlow-Draft-Source': 'paste', 'User-Agent': 'test-agent' }),
      { ip: '203.0.113.9' },
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.draftId).toMatch(/^drf_[A-Za-z0-9]{24}$/);
    expect(body.url).toBe(`${ORIGIN}/draft/${body.draftId}`);

    const [args] = rpcCalls(fetchMock, 'create_trip_draft');
    expect(args.p_id).toBe(body.draftId);
    expect(args.p_source).toBe('paste');
    expect(args.p_user_agent).toBe('test-agent');
    expect(args.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain('203.0.113.9');
    expect(args.p_data.sourceKind).toBe('external_draft');
    expect(args.p_data.items.length).toBeGreaterThan(5);
    expect(args.p_country_codes).toEqual(['PT']);
  });

  it('still rate-limits callers without an IP', async () => {
    await tripDraftsEndpoint(post('/api/trip-drafts', TRIP_DRAFT_EXAMPLE_REQUEST));
    expect(rpcCalls(fetchMock, 'create_trip_draft')[0].p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('maps the database rate limit to 429', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ ok: false, code: 'rate_limited_ip' }]));
    const response = await tripDraftsEndpoint(post('/api/trip-drafts', TRIP_DRAFT_EXAMPLE_REQUEST));
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe('rate_limited');
  });

  it('answers 503 when the database is missing the migration', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"code":"PGRST202"}', { status: 404 }));
    const response = await tripDraftsEndpoint(post('/api/trip-drafts', TRIP_DRAFT_EXAMPLE_REQUEST));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('drafts_unavailable');
  });

  it('refuses oversized and malformed bodies before validating', async () => {
    const huge = await tripDraftsEndpoint(post('/api/trip-drafts', 'x'.repeat(300 * 1024)));
    expect(huge.status).toBe(413);
    const malformed = await tripDraftsEndpoint(post('/api/trip-drafts', '{nope'));
    expect(malformed.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads a draft and only counts a view when asked', async () => {
    const response = await tripDraftsEndpoint(new Request(`${ORIGIN}/api/trip-drafts/drf_AAAAAAAAAAAAAAAAAAAAAAAA?view=1`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ draftId: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', status: 'draft', viewCount: 2 });
    expect(rpcCalls(fetchMock, 'get_trip_draft')[0]).toEqual({ p_draft_id: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', p_track_view: true });

    const missing = await tripDraftsEndpoint(new Request(`${ORIGIN}/api/trip-drafts/not-a-draft`));
    expect(missing.status).toBe(404);
  });

  it('answers CORS preflight', async () => {
    const response = await tripDraftsEndpoint(new Request(`${ORIGIN}/api/trip-drafts`, { method: 'OPTIONS' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });
});

describe('TravelFlow MCP server', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stubEnv();
    fetchMock = vi.fn(async () => Response.json([{ ok: true, code: 'created', expires_at: null }]));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const rpc = async (message: unknown) => {
    const response = await mcpEndpoint(post('/api/mcp', message, { Accept: 'application/json, text/event-stream' }));
    return { response, body: response.status === 202 ? null : await response.json() };
  };

  it('negotiates the protocol version and advertises tools', async () => {
    const { body } = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    expect(body.result.protocolVersion).toBe('2025-06-18');
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.instructions).toContain('does not generate');

    const unknown = await rpc({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    expect(unknown.body.result.protocolVersion).toBe('2025-11-25');
  });

  it('acknowledges notifications with 202 and no body', async () => {
    const { response } = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(response.status).toBe(202);
  });

  it('lists the four draft tools and nothing that generates trips', async () => {
    const { body } = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'get_trip_draft_schema', 'validate_trip_draft', 'create_trip_draft', 'get_trip_draft',
    ]);
  });

  it('creates a draft through tools/call and tags it as an MCP draft', async () => {
    const { body } = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_trip_draft', arguments: TRIP_DRAFT_EXAMPLE_REQUEST } });
    expect(body.result.isError).toBeUndefined();
    expect(body.result.structuredContent.url).toMatch(/\/draft\/drf_/);
    expect(body.result.content[0].text).toContain('/draft/drf_');
    expect(rpcCalls(fetchMock, 'create_trip_draft')[0].p_source).toBe('mcp');
  });

  it('returns validation errors as a tool error the model can read', async () => {
    const { body } = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'validate_trip_draft', arguments: { trip: { tripTitle: 'x' } } } });
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.errors.length).toBeGreaterThan(0);
  });

  it('answers client responses with 202 and no body', async () => {
    const { response } = await rpc({ jsonrpc: '2.0', id: 9, result: {} });
    expect(response.status).toBe(202);
  });

  it('runs batches in order and rejects entries past the cap', async () => {
    const batch = Array.from({ length: 21 }, (_, index) => ({ jsonrpc: '2.0', id: index, method: 'ping' }));
    const { body } = await rpc(batch);
    expect(body).toHaveLength(21);
    expect(body[0]).toEqual({ jsonrpc: '2.0', id: 0, result: {} });
    expect(body[20].error.code).toBe(-32600);
  });

  it('uses JSON-RPC errors for unknown methods, unknown tools and bad JSON', async () => {
    expect((await rpc({ jsonrpc: '2.0', id: 6, method: 'sampling/createMessage' })).body.error.code).toBe(-32601);
    expect((await rpc({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'generate_trip' } })).body.error.code).toBe(-32602);
    const parse = await mcpEndpoint(post('/api/mcp', '{'));
    expect(parse.status).toBe(400);
    expect((await parse.json()).error.code).toBe(-32700);
  });
});
