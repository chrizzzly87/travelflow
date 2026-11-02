import { afterEach, describe, expect, it, vi } from 'vitest';
import { __benchmarkAuthInternals } from '../../netlify/edge-functions/ai-benchmark.ts';

const config = { url: 'https://supabase.example', anonKey: 'anon' };
const request = new Request('https://app.example/api/internal/ai/benchmark');

describe('ai-benchmark admin authorization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('answers a failed role check with a code and an authored sentence, never the PostgREST text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ message: 'JWT expired', details: 'jwt "exp" claim timestamp check failed' }),
      { status: 401 },
    )));

    const response = await __benchmarkAuthInternals.authorizeInternalRequest(request, config, 'token');

    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body).toEqual({ error: 'Admin role verification failed.', code: 'ADMIN_ROLE_CHECK_FAILED' });
  });

  it('rejects a signed-in user who is not an admin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ system_role: 'user' }]), { status: 200 })));

    const response = await __benchmarkAuthInternals.authorizeInternalRequest(request, config, 'token');

    expect(response?.status).toBe(403);
    expect((await response?.json()).code).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('lets an admin through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ system_role: 'admin' }]), { status: 200 })));

    expect(await __benchmarkAuthInternals.authorizeInternalRequest(request, config, 'token')).toBeNull();
  });
});
