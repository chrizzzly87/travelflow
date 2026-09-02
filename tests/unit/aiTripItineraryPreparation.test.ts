import { describe, expect, it } from 'vitest';
import { prepareTripItineraryModelData } from '../../shared/aiTripItineraryPreparation.ts';

const buildDraft = () => ({
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
  cities: [
    {
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
    },
    {
      name: 'Kyoto',
      days: 3,
      recommendations: {
        mustSee: ['Fushimi Inari', 'Kinkaku-ji', 'Kiyomizu-dera'],
        mustTry: ['Seasonal kaiseki', 'Yudofu', 'Matcha sweets'],
        mustDo: ['Walk Gion early', 'Cycle the river', 'Visit Nishiki Market'],
        headsUp: ['Reserve temples ahead'],
      },
      countryCode: 'JP',
      lat: 35.0116,
      lng: 135.7681,
    },
  ],
  travelSegments: [{ transportMode: 'train', duration: 2.25 }],
  activities: [{
    title: 'Tsukiji food walk',
    cityIndex: 0,
    dayOffsetInCity: 1,
    duration: 0.5,
    description: 'Taste market specialties with a local guide.',
    activityTypes: ['food'],
  }],
});

describe('prepareTripItineraryModelData', () => {
  it('compiles model-owned draft fields into the legacy itinerary contract', () => {
    const draft = buildDraft();
    const result = prepareTripItineraryModelData(draft);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cities = result.value.data.cities as Array<Record<string, unknown>>;
    const segments = result.value.data.travelSegments as Array<Record<string, unknown>>;

    expect(cities[0]).toMatchObject({ countryName: 'Japan', countryCode: 'JP' });
    expect(cities[0].description).toContain('### Must See\n- [ ] Meiji Shrine');
    expect(cities[1].description).toContain('### Heads Up\n- [ ] Reserve temples ahead');
    expect(segments).toEqual([{
      fromCityIndex: 0,
      toCityIndex: 1,
      transportMode: 'train',
      description: '2h 15m Train',
      duration: 2.25,
    }]);
    expect(result.value.metrics).toMatchObject({
      derivedCountryNames: 2,
      derivedTravelFields: 3,
      renderedRecommendationSections: 7,
    });
  });

  it('rejects a parseable draft whose references would create a partial trip', () => {
    const draft = buildDraft();
    draft.activities[0].cityIndex = 9;
    draft.travelSegments = [];

    const result = prepareTripItineraryModelData(draft);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(expect.arrayContaining([
      'travelSegments must contain exactly 1 consecutive segment(s)',
      'activities[0].cityIndex is invalid',
    ]));
  });

  it('rejects activity types outside the product taxonomy', () => {
    const draft = buildDraft();
    draft.activities[0].activityTypes = ['made-up-category'];

    const result = prepareTripItineraryModelData(draft);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('activities[0].activityTypes must contain 1-3 values');
  });

  it('rejects coercible values, extra keys, injected Markdown, and overflowing activities', () => {
    const draft = buildDraft();
    (draft.cities[0] as Record<string, unknown>).days = '3';
    (draft.cities[0] as Record<string, unknown>).unexpected = true;
    draft.cities[1].recommendations.mustSee[0] = 'Temple\n### Injected';
    draft.activities[0].dayOffsetInCity = 2.75;
    draft.activities[0].duration = 0.5;

    const result = prepareTripItineraryModelData(draft);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('cities[0] must contain exactly'),
      'cities[0].days must be a positive whole number',
      expect.stringContaining('cities[1].recommendations.mustSee'),
      'activities[0] extends beyond the stop',
    ]));
  });

  it('allows only a terminal zero-night duplicate for round trips', () => {
    const draft = buildDraft();
    draft.cities.push({ ...draft.cities[0], days: 0 });
    draft.travelSegments.push({ transportMode: 'train', duration: 2.5 });

    expect(prepareTripItineraryModelData(draft).ok).toBe(false);
    expect(prepareTripItineraryModelData(draft, { roundTrip: true }).ok).toBe(true);
  });

  it('derives the zero-night return marker when the draft only supplies a return leg', () => {
    const draft = buildDraft();
    draft.travelSegments.push({ transportMode: 'train', duration: 2.5 });

    const result = prepareTripItineraryModelData(draft, { roundTrip: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.cities).toHaveLength(3);
    expect((result.value.data.cities as Array<Record<string, unknown>>)[2]).toMatchObject({ name: 'Tokyo', days: 0 });
    expect((result.value.data.travelSegments as Array<Record<string, unknown>>)[1]).toMatchObject({
      fromCityIndex: 1,
      toCityIndex: 2,
    });
  });

  it('renders durations that round to a whole hour without zero minutes', () => {
    const draft = buildDraft();
    draft.travelSegments[0].duration = 1.999;

    const result = prepareTripItineraryModelData(draft);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value.data.travelSegments as Array<Record<string, unknown>>)[0].description).toBe('2h Train');
  });
});
