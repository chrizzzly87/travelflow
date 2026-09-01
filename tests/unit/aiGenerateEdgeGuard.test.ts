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

const buildProviderDraft = () => ({
  tripTitle: 'Japan by rail',
  countryInfo: {
    currencyCode: 'JPY',
    currencyName: 'Japanese Yen',
    exchangeRate: 165,
    languages: ['Japanese'],
    electricSockets: 'Type A, B',
    visaInfoUrl: 'https://example.com/visa',
    auswaertigesAmtUrl: 'https://example.com/advice',
  },
  cities: [{
    name: 'Tokyo',
    days: 3,
    recommendations: {
      mustSee: ['Meiji Shrine', 'Senso-ji', 'Shibuya Crossing'],
      mustTry: ['Sushi breakfast', 'Ramen', 'Tempura'],
      mustDo: ['Explore Yanaka', 'Walk Omotesando', 'Visit TeamLab'],
      headsUp: [],
    },
    countryCode: 'JP',
    lat: 35.6762,
    lng: 139.6503,
  }],
  travelSegments: [],
  activities: [{
    title: 'Tsukiji food walk',
    cityIndex: 0,
    dayOffsetInCity: 1,
    duration: 0.5,
    description: 'Taste market specialties with a local guide.',
    activityTypes: ['food'],
  }],
});

const mockGeminiDraft = (draft: Record<string, unknown>) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 80, totalTokenCount: 180 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
};

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
    for (const key of [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'GEMINI_API_KEY',
      'VITE_GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'OPENROUTER_API_KEY',
    ]) {
      vi.stubEnv(key, '');
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it('compiles a valid provider draft into the stable client contract', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    mockGeminiDraft(buildProviderDraft());

    const response = await handler(buildRequest({ prompt: 'Trip to Japan' }), { ip: '10.99.2.7' });
    const payload = await response.json() as { data: { cities: Array<Record<string, unknown>> } };

    expect(response.status).toBe(200);
    expect(payload.data.cities[0]).toMatchObject({ countryName: 'Japan', countryCode: 'JP' });
    expect(payload.data.cities[0].description).toContain('### Must See\n- [ ] Meiji Shrine');
  });

  it('fails closed when structured provider output is semantically invalid', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const draft = buildProviderDraft();
    draft.activities[0].cityIndex = 4;
    mockGeminiDraft(draft);

    const response = await handler(buildRequest({ prompt: 'Trip to Japan' }), { ip: '10.99.3.7' });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: 'TRIP_DRAFT_VALIDATION_FAILED' });
  });
});
