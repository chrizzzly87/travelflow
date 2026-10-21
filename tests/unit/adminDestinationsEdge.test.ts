import { afterEach, describe, expect, it, vi } from 'vitest';
import adminDestinationsEndpoint from '../../netlify/edge-functions/admin-destinations';

describe('admin destinations endpoint', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the catalog using the destination import-run schema', async () => {
    vi.stubGlobal('Deno', { env: { get: (name: string) => ({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    } as Record<string, string>)[name] } });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rpc/get_current_user_access')) {
        return Response.json([{ system_role: 'admin', user_id: '00000000-0000-0000-0000-000000000001' }]);
      }
      if (url.includes('/destination_import_runs')) {
        expect(url).toContain('provider,status,schema_version');
        expect(url).toContain('completed_at');
        expect(url).not.toContain('source_provider');
        return Response.json([{ id: 'run-1', provider: 'atobeach', status: 'completed' }]);
      }
      if (url.includes('/destination_referral_links')) {
        return new Response('[]', { status: 200, headers: { 'content-range': '0-0/171' } });
      }
      return Response.json([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminDestinationsEndpoint(new Request(
      'https://example.test/api/internal/admin/destinations',
      { headers: { Authorization: 'Bearer user-token' } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.importRuns).toEqual([{ id: 'run-1', provider: 'atobeach', status: 'completed' }]);
    expect(body.referralCount).toBe(171);
  });
});
