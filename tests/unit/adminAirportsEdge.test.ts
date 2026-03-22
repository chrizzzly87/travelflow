import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadAirportReferenceMetadataFromStaticAsset: vi.fn(),
  loadCommercialAirportReferencesFromStaticAsset: vi.fn(),
  generateAirportReferenceArtifacts: vi.fn(),
}));

vi.mock('../../shared/airportReferenceCatalog.ts', () => ({
  generateAirportReferenceArtifacts: mocks.generateAirportReferenceArtifacts,
}));

vi.mock('../../netlify/edge-lib/airport-reference-static.ts', () => ({
  loadAirportReferenceMetadataFromStaticAsset: mocks.loadAirportReferenceMetadataFromStaticAsset,
  loadCommercialAirportReferencesFromStaticAsset: mocks.loadCommercialAirportReferencesFromStaticAsset,
}));

import handler, { __adminAirportsInternals } from '../../netlify/edge-functions/admin-airports.ts';

describe('admin airports edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.loadCommercialAirportReferencesFromStaticAsset.mockResolvedValue([
      {
        ident: 'EDDB',
        iataCode: 'BER',
        icaoCode: 'EDDB',
        name: 'Berlin Brandenburg Airport',
        municipality: 'Berlin',
        subdivisionName: 'Berlin',
        regionCode: 'DE-BE',
        countryCode: 'DE',
        countryName: 'Germany',
        latitude: 52.362247,
        longitude: 13.500672,
        timezone: 'Europe/Berlin',
        airportType: 'large_airport',
        scheduledService: true,
        isCommercial: true,
        commercialServiceTier: 'major',
        isMajorCommercial: true,
      },
    ]);
    mocks.loadAirportReferenceMetadataFromStaticAsset.mockResolvedValue({
      dataVersion: '2026-03-21-4086',
      generatedAt: '2026-03-21T16:45:00.000Z',
      commercialAirportCount: 4086,
      sourceAirportCount: 84934,
      sources: {
        primary: 'primary',
        mirror: 'mirror',
        enrichment: 'enrichment',
      },
    });
  });

  it('returns the repo snapshot fallback when Supabase config is unavailable', async () => {
    const response = await handler(new Request('https://travelflow.test/api/internal/admin/airports', {
      method: 'GET',
      headers: {
        authorization: 'Bearer test-token',
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      source: 'snapshot',
      databaseAvailable: false,
      airports: expect.any(Array),
      metadata: expect.objectContaining({
        dataVersion: '2026-03-21-4086',
        syncedBy: 'repo snapshot',
      }),
    });
  });

  it('rejects write actions when Supabase config is unavailable', async () => {
    const response = await handler(new Request('https://travelflow.test/api/internal/admin/airports', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'sync' }),
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Supabase config is missing for airport admin actions.',
    });
  });

  it('normalizes manual airport edits and derives commercial flags from airport type', () => {
    const normalized = __adminAirportsInternals.normalizeAdminAirportInput({
      ident: 'EDDH',
      iataCode: 'HAM',
      icaoCode: 'EDDH',
      name: 'Hamburg Airport',
      municipality: 'Hamburg',
      subdivisionName: 'Hamburg',
      regionCode: 'DE-HH',
      countryCode: 'DE',
      countryName: 'Germany',
      latitude: 53.630402,
      longitude: 9.988228,
      timezone: 'Europe/Berlin',
      airportType: 'medium_airport',
      scheduledService: true,
      isCommercial: true,
      commercialServiceTier: 'major',
      isMajorCommercial: true,
    });

    expect(normalized).toMatchObject({
      ident: 'EDDH',
      commercialServiceTier: 'regional',
      isMajorCommercial: false,
      isCommercial: true,
    });
  });

  it('applies bulk patch fields and re-derives commercial flags', () => {
    const updated = __adminAirportsInternals.applyBulkAirportPatch({
      ident: 'EDDB',
      iataCode: 'BER',
      icaoCode: 'EDDB',
      name: 'Berlin Brandenburg Airport',
      municipality: 'Berlin',
      subdivisionName: 'Berlin',
      regionCode: 'DE-BE',
      countryCode: 'DE',
      countryName: 'Germany',
      latitude: 52.362247,
      longitude: 13.500672,
      timezone: 'Europe/Berlin',
      airportType: 'large_airport',
      scheduledService: true,
      isCommercial: true,
      commercialServiceTier: 'major',
      isMajorCommercial: true,
    }, {
      airportType: 'small_airport',
      scheduledService: false,
      timezone: null,
    });

    expect(updated).toMatchObject({
      ident: 'EDDB',
      airportType: 'small_airport',
      scheduledService: false,
      timezone: null,
      commercialServiceTier: 'local',
      isMajorCommercial: false,
      isCommercial: false,
    });
  });

  it('normalizes bulk ident lists for delete actions', () => {
    expect(__adminAirportsInternals.normalizeBulkAirportIdentList([' eddb ', 'EDDB', 'eddh'])).toEqual(['EDDB', 'EDDH']);
    expect(__adminAirportsInternals.normalizeBulkAirportIdentList([])).toBeNull();
  });
});
