import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../../netlify/edge-functions/trip-map-preview.ts';

let ipCounter = 0;
const nextIp = (): string => {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
};

const callPreview = (
  query: string,
  options?: { ip?: string },
): Promise<Response> => {
  const ip = options?.ip ?? nextIp();
  const request = new Request(`https://travelflow.example/api/trip-map-preview?${query}`, {
    headers: { 'x-nf-client-connection-ip': ip },
  });
  return Promise.resolve(handler(request));
};

describe('trip-map-preview edge function hardening', () => {
  beforeEach(() => {
    const edgeEnv: Record<string, string> = {
      VITE_GOOGLE_MAPS_API_KEY: 'test-google-key',
      VITE_MAPBOX_ACCESS_TOKEN: '',
      VITE_MAP_RUNTIME_PRESET: 'google_all',
    };
    vi.stubGlobal('Deno', { env: { get: (name: string) => edgeEnv[name] } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('input validation', () => {
    it('rejects requests without coords', async () => {
      const response = await callPreview('style=clean');
      expect(response.status).toBe(400);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('rejects malformed coords instead of silently filtering them', async () => {
      const response = await callPreview('coords=35.68,139.65|garbage');
      expect(response.status).toBe(400);
    });

    it('rejects out-of-range coordinates', async () => {
      const response = await callPreview('coords=95.0,139.65');
      expect(response.status).toBe(400);
    });

    it('rejects more coordinates than the product supports (regression: unbounded coords)', async () => {
      const coords = Array.from({ length: 31 }, (_, index) => `${index % 80}.5,${index % 170}.5`).join('|');
      const response = await callPreview(`coords=${coords}`);
      expect(response.status).toBe(400);
      expect(await response.text()).toContain('30');
    });
  });

  describe('caching', () => {
    it('serves valid requests as CDN-cacheable redirects', async () => {
      const response = await callPreview('coords=35.68,139.65|34.69,135.50&style=clean');
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('maps.googleapis.com/maps/api/staticmap');
      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('s-maxage');
      expect(response.headers.get('Netlify-CDN-Cache-Control')).toContain('durable');
      expect(response.headers.get('Netlify-Vary')).toContain('query=');
      expect(response.headers.get('Netlify-Vary')).toContain('coords');
    });

    it('does not mark rate-limit or validation errors as cacheable', async () => {
      const invalid = await callPreview('coords=nope');
      expect(invalid.headers.get('Cache-Control')).toBe('no-store');
    });
  });

  describe('rate limiting', () => {
    it('returns 429 with Retry-After once a single IP exhausts its budget', async () => {
      const ip = nextIp();
      let lastStatus = 0;
      let rejected: Response | null = null;
      for (let index = 0; index < 60; index += 1) {
        const response = await callPreview('coords=35.68,139.65|34.69,135.50', { ip });
        lastStatus = response.status;
        if (response.status === 429) {
          rejected = response;
          break;
        }
        expect(response.status).toBe(302);
      }
      expect(lastStatus).toBe(429);
      expect(Number(rejected?.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
      expect(rejected?.headers.get('Cache-Control')).toBe('no-store');
    });

    it('does not throttle other client IPs', async () => {
      const throttledIp = nextIp();
      for (let index = 0; index < 60; index += 1) {
        await callPreview('coords=35.68,139.65|34.69,135.50', { ip: throttledIp });
      }
      const other = await callPreview('coords=35.68,139.65|34.69,135.50');
      expect(other.status).toBe(302);
    });

    it('charges realistic-route requests a higher cost (regression: Directions fan-out abuse)', async () => {
      const simpleIp = nextIp();
      const realisticIp = nextIp();

      let simpleAllowed = 0;
      for (let index = 0; index < 60; index += 1) {
        const response = await callPreview('coords=35.68,139.65|34.69,135.50', { ip: simpleIp });
        if (response.status !== 302) break;
        simpleAllowed += 1;
      }

      let realisticAllowed = 0;
      for (let index = 0; index < 60; index += 1) {
        const response = await callPreview(
          'coords=35.68,139.65|34.69,135.50&routeMode=realistic',
          { ip: realisticIp },
        );
        if (response.status !== 302) break;
        realisticAllowed += 1;
      }

      expect(realisticAllowed).toBeGreaterThan(0);
      expect(realisticAllowed).toBeLessThan(simpleAllowed);
    });
  });
});
