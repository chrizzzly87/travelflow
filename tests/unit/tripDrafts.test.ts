import { describe, expect, it } from 'vitest';
import {
  TRIP_DRAFT_EXAMPLE_REQUEST,
  TRIP_DRAFT_LIMITS,
  TRIP_DRAFT_REQUEST_JSON_SCHEMA,
  buildTripDraftSchemaDocument,
  defaultTripDraftStartDate,
  generateTripDraftId,
  isTripDraftId,
  parseTripDraftRequest,
  validateTripDraftBody,
} from '../../shared/tripDrafts';
import { buildTripDraftTrip } from '../../netlify/edge-lib/trip-drafts';
import type { ITrip } from '../../types';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

describe('trip draft ids', () => {
  it('are drf_ plus 24 base62 characters and unique', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateTripDraftId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isTripDraftId(id)).toBe(true);
    expect(isTripDraftId('drf_short')).toBe(false);
    expect(isTripDraftId('trip-123')).toBe(false);
  });
});

describe('parseTripDraftRequest', () => {
  const now = new Date('2026-10-31T12:00:00Z');

  it('defaults the start date to 30 days out and roundTrip to false', () => {
    const result = parseTripDraftRequest({ trip: { tripTitle: 'x' } }, now);
    expect(result.ok && result.value.startDate).toBe('2026-11-30');
    expect(result.ok && result.value.roundTrip).toBe(false);
    expect(defaultTripDraftStartDate(now)).toBe('2026-11-30');
  });

  it('accepts a bare itinerary without the envelope', () => {
    const result = parseTripDraftRequest(clone(TRIP_DRAFT_EXAMPLE_REQUEST.trip), now);
    expect(result.ok && result.value.trip.tripTitle).toBe('Portugal: Lisbon to Porto');
  });

  it('rejects impossible dates, non-boolean roundTrip and unknown fields', () => {
    const result = parseTripDraftRequest({ trip: {}, startDate: '2027-02-30', roundTrip: 'yes', extra: 1 }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('startDate');
      expect(result.errors.join('\n')).toContain('roundTrip');
      expect(result.errors.join('\n')).toContain('"extra"');
    }
  });

  it('trims and caps the self-reported client labels', () => {
    const result = parseTripDraftRequest({ trip: {}, client: { name: ' chatgpt\n', model: 'x'.repeat(200) } }, now);
    expect(result.ok && result.value.client.name).toBe('chatgpt');
    expect(result.ok && result.value.client.model?.length).toBe(TRIP_DRAFT_LIMITS.maxClientLabelLength);
  });
});

describe('validateTripDraftBody', () => {
  it('accepts the published example', () => {
    const result = validateTripDraftBody(clone(TRIP_DRAFT_EXAMPLE_REQUEST));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cityCount).toBe(2);
      expect(result.value.activityCount).toBe(6);
      expect(result.value.countryCodes).toEqual(['PT']);
    }
  });

  it('accepts a single recommendation per list, like the compact generator schema', () => {
    const body = clone(TRIP_DRAFT_EXAMPLE_REQUEST) as any;
    body.trip.cities[0].recommendations = { mustSee: ['Alfama'], mustTry: ['Nata'], mustDo: ['Tram 28'], headsUp: [] };
    expect(validateTripDraftBody(body).ok).toBe(true);
  });

  it('reports precise errors for a broken itinerary', () => {
    const body = clone(TRIP_DRAFT_EXAMPLE_REQUEST) as any;
    body.trip.cities[1].days = 1.5;
    body.trip.travelSegments = [];
    body.trip.activities[0].dayOffsetInCity = 9;
    body.trip.cities[0].extra = true;
    const result = validateTripDraftBody(body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.errors.join('\n');
      expect(text).toContain('cities[1].days');
      expect(text).toContain('travelSegments must contain exactly 1');
      expect(text).toContain('activities[0].dayOffsetInCity');
      expect(text).toContain('cities[0] must contain exactly');
    }
  });

  it('needs one extra return leg for a round trip', () => {
    const body = clone(TRIP_DRAFT_EXAMPLE_REQUEST) as any;
    body.roundTrip = true;
    expect(validateTripDraftBody(body).ok).toBe(false);
    body.trip.travelSegments.push({ transportMode: 'train', duration: 3 });
    expect(validateTripDraftBody(body).ok).toBe(true);
  });

  it('caps the number of stops before running the full validator', () => {
    const body = clone(TRIP_DRAFT_EXAMPLE_REQUEST) as any;
    body.trip.cities = Array.from({ length: TRIP_DRAFT_LIMITS.maxCities + 1 }, () => body.trip.cities[0]);
    const result = validateTripDraftBody(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([`cities can contain at most ${TRIP_DRAFT_LIMITS.maxCities} stops.`]);
  });
});

describe('buildTripDraftTrip', () => {
  it('builds a complete trip with stays, travel, activities and the day trip', () => {
    const result = validateTripDraftBody(clone(TRIP_DRAFT_EXAMPLE_REQUEST));
    if (!result.ok) throw new Error(result.errors.join('; '));
    const trip = buildTripDraftTrip('drf_AAAAAAAAAAAAAAAAAAAAAAAA', result.value, new Date('2026-10-31T00:00:00Z')) as unknown as ITrip;

    expect(trip.id).toBe('drf_AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(trip.startDate).toBe('2027-05-03');
    expect(trip.sourceKind).toBe('external_draft');
    expect(trip.sourceTemplateId).toBe('drf_AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(trip.aiMeta).toMatchObject({ provider: 'external', model: 'none' });
    expect(trip.countryInfo?.currencyCode).toBe('EUR');

    const cities = trip.items.filter(item => item.type === 'city');
    expect(cities.map(city => [city.title, city.startDateOffset, city.duration])).toEqual([['Lisbon', 0, 4], ['Porto', 4, 3]]);
    expect(cities[0].coordinates).toEqual({ lat: 38.7223, lng: -9.1393 });
    expect(cities[0].description).toContain('### Must See');

    expect(trip.items.filter(item => item.type === 'travel')).toHaveLength(1);
    const dayTrip = trip.items.find(item => item.activityKind === 'day-trip');
    expect(dayTrip).toMatchObject({ title: 'Sintra', stayCityId: cities[0].id });
    expect(trip.items.filter(item => item.type === 'activity')).toHaveLength(6);
  });
});

describe('schema document', () => {
  it('documents every field the validator needs and points at every endpoint', () => {
    const doc = buildTripDraftSchemaDocument('https://travelflowapp.netlify.app');
    expect(doc.endpoints.mcp).toBe('https://travelflowapp.netlify.app/api/mcp');
    const tripSchema = (TRIP_DRAFT_REQUEST_JSON_SCHEMA.properties as any).trip;
    expect(tripSchema.properties.cities.items.properties.days.description).toMatch(/nights/i);
    expect(tripSchema.properties.travelSegments.items.properties.duration.description).toMatch(/HOURS/);
    expect(tripSchema.properties.activities.items.properties.duration.description).toMatch(/DAYS/);
    expect(doc.rules.some(rule => rule.includes('does not generate'))).toBe(true);
  });
});
