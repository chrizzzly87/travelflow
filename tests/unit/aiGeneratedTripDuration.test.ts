import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareTripItineraryModelData } from '../../shared/aiTripItineraryPreparation';
import { getTripSpan, formatLocalIsoDate } from '../../shared/tripSpan';
import type { ITrip } from '../../types';
import { generateItinerary } from '../../services/aiService';
import { buildTripFromModelData } from '../../netlify/edge-functions/ai-generate-worker';
import { buildTripFromModelData as buildBenchmarkTrip } from '../../netlify/edge-functions/ai-benchmark';

vi.mock('../../services/analyticsService', () => ({ trackEvent: vi.fn() }));

const city = (name: string, days: unknown) => ({
  name, days, countryCode: 'JP', lat: 35, lng: 139,
  recommendations: {
    mustSee: ['Temple', 'Market', 'Park'], mustTry: ['Sushi', 'Ramen', 'Tea'],
    mustDo: ['Walk', 'Cycle', 'Museum'], headsUp: [],
  },
});
const prepareRoundTrip = () => {
  const result = prepareTripItineraryModelData({
    tripTitle: 'Japan release regression',
    countryInfo: { currencyCode: 'JPY', currencyName: 'Yen', exchangeRate: 165,
      languages: ['Japanese'], electricSockets: 'A', visaInfoUrl: 'https://example.com/visa',
      auswaertigesAmtUrl: 'https://example.com/advice' },
    cities: [city('Tokyo', 5), city('Kyoto', 4)],
    travelSegments: [{ transportMode: 'train', duration: 2 }, { transportMode: 'train', duration: 2 }],
    activities: [{ title: 'Kyoto walk', cityIndex: 1, dayOffsetInCity: 3, duration: 0.5,
      description: 'An afternoon walk', activityTypes: ['culture'] }],
  }, { roundTrip: true });
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result.value.data;
};

const builders = {
  benchmark: async (data: Record<string, unknown>, roundTrip: boolean) => buildBenchmarkTrip(data, '2026-11-10', {
    roundTrip, provider: 'gemini', model: 'test-model', benchmarkSessionId: 'test-session', benchmarkRunId: 'test-run',
  }) as unknown as ITrip,
  client: async (data: Record<string, unknown>, roundTrip: boolean) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data, meta: {} }), { status: 200 })));
    return generateItinerary('Japan', '2026-11-10', { roundTrip, totalDays: 10, totalNights: 9 });
  },
  worker: async (data: Record<string, unknown>, roundTrip: boolean) => buildTripFromModelData(data, {
    tripId: 'regression-trip', startDate: '2026-11-10', roundTrip, provider: 'gemini', model: 'test-model',
  }) as unknown as ITrip,
};

afterEach(() => vi.unstubAllGlobals());

for (const [name, build] of Object.entries(builders)) describe(`${name} generated itinerary duration`, () => {
  it('preserves the compiled zero-night return marker and the requested departure date', async () => {
    const trip = await build(prepareRoundTrip(), true);
    const cities = trip.items.filter(item => item.type === 'city');
    expect(cities.map(item => [item.title, item.startDateOffset, item.duration])).toEqual([
      ['Tokyo', 0, 5], ['Kyoto', 5, 4], ['Tokyo', 9, 0],
    ]);
    const span = getTripSpan(trip);
    expect(span.compactLabel).toBe('10D/9N');
    expect(formatLocalIsoDate(span.endDate)).toBe('2026-11-19');
    const activity = trip.items.find(item => item.type === 'activity');
    expect(activity).toMatchObject({ startDateOffset: 8, duration: 0.5, stayCityId: cities[1].id });
  });

  it('adds a zero-night return marker for a legacy response without one', async () => {
    const data = prepareRoundTrip();
    (data.cities as unknown[]).pop();
    const trip = await build(data, true);
    expect(trip.items.filter(item => item.type === 'city').at(-1)).toMatchObject({ title: 'Tokyo', duration: 0, startDateOffset: 9 });
    expect(getTripSpan(trip).compactLabel).toBe('10D/9N');
  });

  it.each([0, -1, null, '', 'invalid', Number.NaN, Number.POSITIVE_INFINITY])('keeps invalid interior stay %s on the existing one-night fallback', async value => {
    const data = prepareRoundTrip();
    (data.cities as Array<Record<string, unknown>>)[1].days = value;
    const trip = await build(data, true);
    expect(trip.items.filter(item => item.type === 'city')[1].duration).toBe(1);
  });

  it.each([-1, null, '', 'invalid', Number.NaN, Number.POSITIVE_INFINITY])('does not exempt an invalid terminal-origin duration %s', async value => {
    const data = prepareRoundTrip();
    (data.cities as Array<Record<string, unknown>>)[2].days = value;
    const trip = await build(data, true);
    expect(trip.items.filter(item => item.type === 'city').at(-1)?.duration).toBe(1);
  });

  it('preserves an intentional overnight return stay', async () => {
    const data = prepareRoundTrip();
    (data.cities as Array<Record<string, unknown>>)[2].days = 2;
    const trip = await build(data, true);
    expect(trip.items.filter(item => item.type === 'city').at(-1)?.duration).toBe(2);
  });

  it('does not turn a single zero-night origin into a terminal return marker', async () => {
    const data = prepareRoundTrip();
    data.cities = [{ ...city('Tokyo', 0), description: 'Origin' }];
    data.activities = [];
    data.travelSegments = [];
    const trip = await build(data, true);
    expect(trip.items.filter(item => item.type === 'city')).toHaveLength(1);
    expect(trip.items[0].duration).toBe(1);
  });

  it.each([false, true])('does not allow a zero-night terminal non-origin stop (roundTrip=%s)', async roundTrip => {
    const data = prepareRoundTrip();
    const cities = data.cities as Array<Record<string, unknown>>;
    cities[2].name = 'Osaka';
    const trip = await build(data, roundTrip);
    expect(trip.items.filter(item => item.type === 'city')[2]).toMatchObject({ title: 'Osaka', duration: 1 });
  });

  it('does not preserve zero nights on a matching terminal city without round-trip intent', async () => {
    const trip = await build(prepareRoundTrip(), false);
    expect(trip.items.filter(item => item.type === 'city').at(-1)?.duration).toBe(1);
  });
});
