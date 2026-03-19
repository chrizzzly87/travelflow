import { describe, expect, it } from 'vitest';
import handler from '../../netlify/edge-functions/runtime-location';

describe('runtime location edge', () => {
  it('normalizes the Netlify geo context into the public payload', async () => {
    const response = await handler(new Request('https://travelflow.test/api/runtime/location'), {
      geo: {
        city: 'Berlin',
        country: {
          code: 'DE',
          name: 'Germany',
        },
        subdivision: {
          code: 'BE',
          name: 'Berlin',
        },
        latitude: '52.5200',
        longitude: 13.405,
        timezone: 'Europe/Berlin',
        postalCode: '10115',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      available: true,
      source: 'netlify-context',
      fetchedAt: expect.any(String),
      location: {
        city: 'Berlin',
        countryCode: 'DE',
        countryName: 'Germany',
        subdivisionCode: 'BE',
        subdivisionName: 'Berlin',
        latitude: 52.52,
        longitude: 13.405,
        timezone: 'Europe/Berlin',
        postalCode: '10115',
      },
    });
  });

  it('returns an unavailable snapshot when geo data is missing', async () => {
    const response = await handler(new Request('https://travelflow.test/api/runtime/location'), {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      available: false,
      source: 'unavailable',
      fetchedAt: expect.any(String),
      location: {
        city: null,
        countryCode: null,
        countryName: null,
        subdivisionCode: null,
        subdivisionName: null,
        latitude: null,
        longitude: null,
        timezone: null,
        postalCode: null,
      },
    });
  });

  it('rejects non-GET requests', async () => {
    const response = await handler(new Request('https://travelflow.test/api/runtime/location', {
      method: 'POST',
    }), {});

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
