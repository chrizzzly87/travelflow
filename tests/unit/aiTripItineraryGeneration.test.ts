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
    const repairPatch = {
      travelSegments: [],
      activitySchedules: [{ activityIndex: 0, cityIndex: 0, dayOffsetInCity: 1, duration: 0.5 }],
    };
    const generate = vi.fn()
      .mockResolvedValueOnce(success(draft(4), 100))
      .mockResolvedValueOnce(success(repairPatch, 120));
    const result = await generatePreparedTripItinerary({ ...options, generate });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0].prompt).toContain('activities[0].cityIndex is invalid');
    expect(generate.mock.calls[1][0].prompt).toContain('activitySchedules');
    expect(generate.mock.calls[1][0].jsonSchema.name).toContain('schedule_repair');
    expect(result.value.meta.usage).toMatchObject({ promptTokens: 220, completionTokens: 100, totalTokens: 320, estimatedCostUsd: 0.02 });
    expect(result.value.repair).toMatchObject({ attempted: true, succeeded: true, strategy: 'targeted_schedule_patch' });
  });

  it('repairs the GLM zero-duration and missing-segment failure without replacing valid content', async () => {
    const invalid = draft();
    invalid.cities.push({
      name: 'Kyoto', days: 2, countryCode: 'JP', lat: 35.0116, lng: 135.7681,
      recommendations: {
        mustSee: ['Fushimi Inari', 'Kiyomizu-dera', 'Kinkaku-ji'],
        mustTry: ['Kaiseki', 'Yudofu', 'Matcha'],
        mustDo: ['Walk Gion', 'Visit Arashiyama', 'Explore Nishiki'],
        headsUp: [],
      },
    });
    invalid.activities[0].duration = 0;
    invalid.activities.push({
      title: 'Gion walk', cityIndex: 1, dayOffsetInCity: 0, duration: 0,
      description: 'Explore the preserved streets of Gion.', activityTypes: ['culture'],
    });

    const generate = vi.fn()
      .mockResolvedValueOnce(success(invalid, 100))
      .mockResolvedValueOnce(success({
        travelSegments: [{ transportMode: 'train', duration: 2.25 }],
        activitySchedules: [
          { activityIndex: 0, cityIndex: 0, dayOffsetInCity: 1, duration: 0.5 },
          { activityIndex: 1, cityIndex: 1, dayOffsetInCity: 0, duration: 0.25 },
        ],
      }, 45));

    const result = await generatePreparedTripItinerary({ ...options, generate });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.draft.tripTitle).toBe('Japan by rail');
    expect((result.value.draft.activities as Array<Record<string, unknown>>)[1]).toMatchObject({
      title: 'Gion walk',
      description: 'Explore the preserved streets of Gion.',
      duration: 0.25,
    });
    expect(result.value.draft.travelSegments).toEqual([{ transportMode: 'train', duration: 2.25 }]);
    expect(result.value.repair).toMatchObject({
      attempted: true,
      succeeded: true,
      strategy: 'targeted_schedule_patch',
    });
  });

  it('fails closed after exactly two invalid drafts', async () => {
    const generate = vi.fn().mockResolvedValue(success(draft(4)));
    const result = await generatePreparedTripItinerary({ ...options, generate });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('validation');
    expect(result.repair).toMatchObject({ attempted: true, succeeded: false });
    expect(result.repair.strategy).toBe('targeted_schedule_patch');
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
