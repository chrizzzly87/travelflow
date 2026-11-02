import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTripFromDraft, createTripDraftFromText, extractJsonBlock, fetchTripDraft, TripDraftRequestError } from '../../services/tripDraftService';
import type { ITrip } from '../../types';
import { resolveTripExpiryFromEntitlements } from '../../config/productLimits';

vi.mock('../../services/supabaseClient', () => ({ supabase: null }));

const draftTrip = {
  id: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', title: 'Portugal', startDate: '2027-05-03', items: [],
  createdAt: 1, updatedAt: 1, sourceKind: 'external_draft', isExample: true, exampleTemplateId: 'x',
} as unknown as ITrip;

afterEach(() => vi.unstubAllGlobals());

describe('extractJsonBlock', () => {
  it('takes the fenced block from an assistant answer', () => {
    expect(extractJsonBlock('Here you go:\n```json\n{"trip":{"a":1}}\n```\nEnjoy!')).toBe('{"trip":{"a":1}}');
  });
  it('falls back to the outermost braces', () => {
    expect(extractJsonBlock('Sure! {"trip":{"a":{"b":2}}} Have fun.')).toBe('{"trip":{"a":{"b":2}}}');
  });
});

describe('buildTripFromDraft', () => {
  it('makes a fresh owned trip that remembers its draft', () => {
    const trip = buildTripFromDraft({ draftId: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', trip: draftTrip }, { now: 1_000, tripExpirationDays: null });
    expect(trip.id).not.toBe(draftTrip.id);
    expect(trip).toMatchObject({
      createdAt: 1_000, updatedAt: 1_000, status: 'active', isExample: false,
      sourceKind: 'external_draft', sourceTemplateId: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA',
      tripExpiresAt: resolveTripExpiryFromEntitlements(1_000, undefined, null),
    });
    expect(trip.exampleTemplateId).toBeUndefined();
  });

  it('applies the plan expiry', () => {
    const now = Date.UTC(2026, 0, 1);
    const trip = buildTripFromDraft({ draftId: 'drf_AAAAAAAAAAAAAAAAAAAAAAAA', trip: draftTrip }, { now, tripExpirationDays: 7 });
    expect(trip.tripExpiresAt).toBe(resolveTripExpiryFromEntitlements(now, undefined, 7));
    expect(trip.tripExpiresAt).not.toBeNull();
  });
});

describe('fetchTripDraft', () => {
  it('skips the network for ids that cannot be drafts', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchTripDraft('../admin')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for a missing draft and counts the view', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchTripDraft('drf_AAAAAAAAAAAAAAAAAAAAAAAA')).toBeNull();
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/api/trip-drafts/drf_AAAAAAAAAAAAAAAAAAAAAAAA?view=1');
  });
});

describe('fetchTripDraft preloads', () => {
  it('does not count a hover preload as a view', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchTripDraft('drf_AAAAAAAAAAAAAAAAAAAAAAAA', undefined, { countView: false });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/api/trip-drafts/drf_AAAAAAAAAAAAAAAAAAAAAAAA');
  });
});

describe('createTripDraftFromText', () => {
  it('rejects text without JSON before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createTripDraftFromText('no json here')).rejects.toMatchObject({ code: 'invalid_json' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tags the request as a paste and surfaces validation errors', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: false, code: 'validation_failed', message: 'x', errors: ['cities must be an array'] }, { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await createTripDraftFromText('```json\n{"trip":{}}\n```').catch((caught) => caught);
    expect(error).toBeInstanceOf(TripDraftRequestError);
    expect(error.errors).toEqual(['cities must be an array']);
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-TravelFlow-Draft-Source']).toBe('paste');
  });
});
