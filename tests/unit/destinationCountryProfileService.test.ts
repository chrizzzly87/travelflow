import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearDestinationCountryProfileCacheForTests,
  getCachedDestinationCountryProfile,
  loadDestinationCountryProfile,
} from '../../services/destinationCountryProfileService';

afterEach(() => {
  clearDestinationCountryProfileCacheForTests();
  vi.unstubAllGlobals();
});

describe('destinationCountryProfileService', () => {
  it('loads the public profile projection with provenance and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        sourceProfile: {
          currencyCode: 'THB',
          timezone: 'Asia/Bangkok',
          callingCode: '66',
          popularity: 10,
          summary: 'Thailand summary',
          alertMessage: null,
          safetyTips: [],
          bonusTips: [],
          sections: {},
          faqs: [],
          recentUpdates: [],
          airports: [],
          beaches: [],
          cities: [],
          weather: [],
          exchange: { rate: 44.8, base: 'GBP' },
        },
        provenance: {
          provider: 'atobeach',
          originUrl: 'https://atobeach.com/api/countries/thailand/',
          fetchedAt: '2026-08-17T12:00:00Z',
          sourceUpdatedAt: null,
          payloadHash: 'a'.repeat(64),
        },
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadDestinationCountryProfile(' Thailand ');
    const cached = await loadDestinationCountryProfile('thailand');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/destinations/thailand?include=source-profile',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
    expect(result?.profile.currencyCode).toBe('THB');
    expect(result?.provenance?.originUrl).toBe('https://atobeach.com/api/countries/thailand/');
    expect(cached).toBe(result);
    expect(getCachedDestinationCountryProfile('THAILAND')).toBe(result);
  });

  it('returns null when the API has no public source profile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 })));
    await expect(loadDestinationCountryProfile('unknown')).resolves.toBeNull();
  });

  it('rejects failed API requests so the page can retain its compact fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));
    await expect(loadDestinationCountryProfile('thailand')).rejects.toThrow('503');
  });
});
