import { describe, expect, it, vi } from 'vitest';
import { generatePreparedTripItinerary } from '../../netlify/edge-lib/ai-trip-generation.ts';
import type { ProviderGenerationResult } from '../../netlify/edge-lib/ai-provider-runtime.ts';
import { TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA } from '../../shared/aiTripItinerarySchema.ts';

const draft = (cityIndex = 0) => ({
  tripTitle: 'Japan by rail',
  countryInfo: {
    currencyCode: 'JPY', currencyName: 'Japanese Yen', exchangeRate: 165,
    languages: ['Japanese'], electricSockets: 'Type A, B',
    visaInfoUrl: 'https://example.com/visa', auswaertigesAmtUrl: 'https://example.com/advice',
  },
  cities: [{
    name: 'Tokyo', days: 3, countryCode: 'JP', lat: 35.6762, lng: 139.6503,
    recommendations: {
      mustSee: ['Meiji Shrine', 'Senso-ji', 'Shibuya Crossing'],
      mustTry: ['Sushi breakfast', 'Ramen', 'Tempura'],
      mustDo: ['Explore Yanaka', 'Walk Omotesando', 'Visit TeamLab'],
      headsUp: [],
    },
  }],
  travelSegments: [],
  activities: [{
    title: 'Tsukiji food walk', cityIndex, dayOffsetInCity: 1, duration: 0.5,
    description: 'Taste market specialties with a local guide.', activityTypes: ['food'],
  }],
});

const success = (data: Record<string, unknown>, promptTokens = 100): ProviderGenerationResult => ({
  ok: true,
  value: {
    data,
    meta: {
      provider: 'openai', model: 'gpt-5.4', providerModel: 'gpt-5.4-2026-08-01',
      usage: { promptTokens, completionTokens: 50, totalTokens: promptTokens + 50, estimatedCostUsd: 0.01 },
    },
  },
});

const options = {
  prompt: 'Build a trip', provider: 'openai', model: 'gpt-5.4', timeoutMs: 45_000,
  jsonSchema: TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA,
};

describe('generatePreparedTripItinerary', () => {
  it('accepts a valid first draft without repair', async () => {
    const generate = vi.fn().mockResolvedValue(success(draft()));
    const result = await generatePreparedTripItinerary({ ...options, generate });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.value.repair).toMatchObject({ attempted: false, succeeded: false, initialErrors: [] });
  });

  it('repairs one semantic failure and combines billed usage', async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce(success(draft(4), 100))
      .mockResolvedValueOnce(success(draft(), 120));
    const result = await generatePreparedTripItinerary({ ...options, generate });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0].prompt).toContain('activities[0].cityIndex is invalid');
    expect(generate.mock.calls[1][0].prompt).toContain('dayOffsetInCity + duration');
    expect(result.value.meta.usage).toMatchObject({ promptTokens: 220, completionTokens: 100, totalTokens: 320, estimatedCostUsd: 0.02 });
    expect(result.value.repair).toMatchObject({ attempted: true, succeeded: true });
  });

  it('fails closed after exactly two invalid drafts', async () => {
    const generate = vi.fn().mockResolvedValue(success(draft(4)));
    const result = await generatePreparedTripItinerary({ ...options, generate });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('validation');
    expect(result.repair).toMatchObject({ attempted: true, succeeded: false });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('retains the first semantic errors when the repair provider call fails', async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce(success(draft(4)))
      .mockResolvedValueOnce({ ok: false, status: 503, value: { error: 'Unavailable', code: 'PROVIDER_UNAVAILABLE' } });
    const result = await generatePreparedTripItinerary({ ...options, generate });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('provider');
    expect(result.repair).toMatchObject({
      attempted: true,
      succeeded: false,
      providerFailureCode: 'PROVIDER_UNAVAILABLE',
      initialErrors: expect.arrayContaining(['activities[0].cityIndex is invalid']),
    });
  });
});
