import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const envValues: Record<string, string | undefined> = {};

import handler from '../../netlify/edge-functions/ai-generate.ts';

const buildRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://travelflowapp.netlify.app/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe('netlify/edge-functions/ai-generate hardening (regression)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    for (const key of Object.keys(envValues)) delete envValues[key];
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('Deno', {
      env: {
        get: (key: string) => envValues[key],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects oversized prompts with 413 before any provider call', async () => {
    const response = await handler(buildRequest({ prompt: 'x'.repeat(200_000) }), { ip: '10.0.0.1' });
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PROMPT_TOO_LONG' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects arbitrary provider/model targets with 400 before any provider call', async () => {
    const response = await handler(buildRequest({
      prompt: 'Trip to Japan',
      target: { provider: 'gemini', model: 'gemini-ultra-unlimited' },
    }), { ip: '10.0.0.2' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MODEL_NOT_ALLOWED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still returns the legacy 400 for a missing prompt', async () => {
    const response = await handler(buildRequest({}), { ip: '10.0.0.3' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing required field: prompt' });
  });

  it('rejects invalid Supabase access tokens with 401', async () => {
    envValues.VITE_SUPABASE_URL = 'https://supabase.example';
    envValues.VITE_SUPABASE_ANON_KEY = 'anon-key';
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));

    const response = await handler(buildRequest(
      { prompt: 'Trip to Japan' },
      { Authorization: 'Bearer forged-token' },
    ), { ip: '10.0.0.4' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rate limits unauthenticated callers per IP with 429 and Retry-After', async () => {
    // No provider keys configured: allowed requests fail fast with 500
    // GEMINI_KEY_MISSING instead of hitting the network.
    const statuses: number[] = [];
    let lastResponse: Response | null = null;
    for (let i = 0; i < 6; i += 1) {
      lastResponse = await handler(buildRequest({ prompt: 'Trip to Japan' }), { ip: '10.99.0.42' });
      statuses.push(lastResponse.status);
    }

    expect(statuses.slice(0, 5)).toEqual([500, 500, 500, 500, 500]);
    expect(statuses[5]).toBe(429);
    expect(lastResponse?.headers.get('Retry-After')).toBeTruthy();
    await expect(lastResponse?.json()).resolves.toMatchObject({ code: 'RATE_LIMITED' });
    // No outbound provider/auth fetches happened at any point.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not rate limit a fresh IP after another IP is exhausted', async () => {
    const response = await handler(buildRequest({ prompt: 'Trip to Japan' }), { ip: '10.99.1.7' });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'GEMINI_KEY_MISSING' });
  });
});
