import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEventMock = vi.fn();

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

import {
  generateActivityProposals,
  generateCityNotesAddition,
  generateItinerary,
  suggestActivityDetails,
  TripGenerationError,
} from '../../services/aiService';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');

const buildSuccessPayload = () => ({
  data: {
    title: 'Test Trip',
    cities: [
      { name: 'Lisbon', days: 2, lat: 38.7223, lng: -9.1393, description: 'Start' },
      { name: 'Porto', days: 2, lat: 41.1579, lng: -8.6291, description: 'End' },
    ],
    activities: [
      { cityIndex: 0, dayOffsetInCity: 0, duration: 1, title: 'Tram 28 ride', type: 'sightseeing' },
    ],
    travelLegs: [],
  },
  meta: {
    requestId: 'req-test-1',
    durationMs: 1234,
    provider: 'gemini',
    model: 'gemini-test-model',
    providerModel: 'gemini-test-model',
    status: 200,
  },
});

describe('aiService server-only generation (no client provider keys)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends trip generation requests to the server endpoint /api/ai/generate', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(buildSuccessPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const trip = await generateItinerary('Trip through Portugal', '2026-08-01');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/generate');
    expect(init?.method).toBe('POST');
    const requestBody = JSON.parse(String(init?.body));
    expect(typeof requestBody.prompt).toBe('string');
    expect(requestBody.prompt.length).toBeGreaterThan(0);

    expect(trip.items.some((item) => item.type === 'city')).toBe(true);
    expect(trip.aiMeta?.provider).toBe('gemini');
    expect(trip.aiMeta?.generation?.state).toBe('succeeded');
  });

  it('fails gracefully with TripGenerationError and never falls back to a direct provider call', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'Server-side generation failed.', code: 'PROVIDER_REQUEST_FAILED' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(generateItinerary('Trip through Portugal')).rejects.toBeInstanceOf(TripGenerationError);

    // Regression guard: the removed browser fallback used to issue a second,
    // direct Gemini SDK request. Only the single server request may happen.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/generate');
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('googleapis.com');
    }
  });

  it('keeps failure analytics on the existing failed-event path (no fallback events)', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'boom', code: 'PROVIDER_REQUEST_FAILED' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(generateItinerary('Trip through Portugal')).rejects.toBeInstanceOf(TripGenerationError);

    const eventNames = trackEventMock.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain('create_trip__ai_request--failed');
    expect(eventNames.some((name) => String(name).includes('fallback'))).toBe(false);
  });

  it('degrades AI helper utilities gracefully without any network/provider calls', async () => {
    await expect(suggestActivityDetails('Surfing', 'Lisbon')).resolves.toEqual({
      cost: 'Unknown',
      bestTime: 'Anytime',
      tips: 'No details available.',
      type: 'general',
      activityTypes: ['general'],
    });
    await expect(generateActivityProposals('something fun', 'Lisbon')).resolves.toEqual([]);
    await expect(generateCityNotesAddition('Lisbon', 'existing notes')).resolves.toBe('');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('client bundle must not contain provider API key access (static regression guards)', () => {
  it('client code does not import @google/genai or read Gemini keys', () => {
    const aiServiceSource = readRepoFile('services/aiService.ts');
    expect(aiServiceSource).not.toContain('@google/genai');
    expect(aiServiceSource).not.toContain('GoogleGenAI');
    expect(aiServiceSource).not.toContain('getGeminiApiKey');

    const utilsSource = readRepoFile('utils.ts');
    expect(utilsSource).not.toContain('VITE_GEMINI_API_KEY');
    expect(utilsSource).not.toContain('getGeminiApiKey');
  });

  it('vite config does not inline server Gemini keys into the bundle', () => {
    const viteConfigSource = readRepoFile('vite.config.ts');
    expect(viteConfigSource).not.toContain('GEMINI_API_KEY');
    expect(viteConfigSource).not.toContain("'process.env.API_KEY'");
  });

  it('package.json no longer depends on the browser Gemini SDK', () => {
    const pkg = JSON.parse(readRepoFile('package.json'));
    expect(pkg.dependencies?.['@google/genai']).toBeUndefined();
    expect(pkg.devDependencies?.['@google/genai']).toBeUndefined();
  });

  it('netlify secrets scan no longer omits Gemini keys', () => {
    const netlifyToml = readRepoFile('netlify.toml');
    const omitLine = netlifyToml
      .split('\n')
      .find((line) => line.trimStart().startsWith('SECRETS_SCAN_OMIT_KEYS'));
    expect(omitLine).toBeDefined();
    expect(omitLine).not.toContain('VITE_GEMINI_API_KEY');
    expect(omitLine).not.toContain(',GEMINI_API_KEY');
  });
});
