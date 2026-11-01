import { describe, expect, it, vi } from 'vitest';

import {
  resolveMapboxCitySuggestion,
  searchMapboxCitySuggestions,
} from '../../shared/mapboxCityLookup';

const capeTownFeature = {
  type: 'Feature',
  properties: {
    mapbox_id: 'dXJuOm1ieHBsYzpDYXBl',
    name: 'Kapstadt',
    full_address: 'Kapstadt, Westkap, Südafrika',
    place_formatted: 'Westkap, Südafrika',
    coordinates: { latitude: -33.92, longitude: 18.42 },
    context: { country: { name: 'Südafrika', country_code: 'za' } },
  },
};

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as unknown as Response;

describe('shared/mapboxCityLookup', () => {
  it('builds the v6 forward request for places', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ features: [] }));

    await searchMapboxCitySuggestions('Kapstadt', {
      accessToken: 'pk.test',
      language: 'de',
      maxResults: 5,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://api.mapbox.com/search/geocode/v6/forward');
    expect(url.searchParams.get('q')).toBe('Kapstadt');
    expect(url.searchParams.get('types')).toBe('place');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('language')).toBe('de');
    expect(url.searchParams.get('access_token')).toBe('pk.test');
  });

  it('maps a feature to a CityLookupSuggestion', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ features: [capeTownFeature] }));

    const result = await searchMapboxCitySuggestions('Kapstadt', {
      accessToken: 'pk.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual([{
      id: 'dXJuOm1ieHBsYzpDYXBl',
      name: 'Kapstadt',
      label: 'Kapstadt, Westkap, Südafrika',
      coordinates: { lat: -33.92, lng: 18.42 },
      countryName: 'Südafrika',
      countryCode: 'ZA',
    }]);
  });

  it('returns [] on HTTP 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: 'Not Authorized' }, 401));
    await expect(searchMapboxCitySuggestions('Kapstadt', {
      accessToken: 'bad',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toEqual([]);
  });

  it('returns [] on a network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(searchMapboxCitySuggestions('Kapstadt', {
      accessToken: 'pk.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toEqual([]);
  });

  it('returns null when nothing matches', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ features: [] }));
    await expect(resolveMapboxCitySuggestion('Zzzzzz', {
      accessToken: 'pk.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toBeNull();
  });

  it('resolves the first match', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ features: [capeTownFeature] }));
    const result = await resolveMapboxCitySuggestion('Kapstadt', {
      accessToken: 'pk.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result?.name).toBe('Kapstadt');
    expect(new URL(String(fetchImpl.mock.calls[0][0])).searchParams.get('limit')).toBe('1');
  });
});
