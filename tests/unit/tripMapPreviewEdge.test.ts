import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler, { resolvePreviewUpstreamUrl } from '../../netlify/edge-functions/trip-map-preview.ts';

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

/** Resolves the provider URL a request would render, without the image fetch. */
const upstreamUrlFor = async (query: string): Promise<string> => {
  const resolution = await resolvePreviewUpstreamUrl(
    new Request(`https://travelflow.example/api/trip-map-preview?${query}`),
  );
  return resolution.ok ? resolution.url : '';
};

const PREVIEW_IMAGE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/**
 * Stubs the provider: static image requests succeed, everything else (the
 * Directions lookups) fails the way an unconfigured upstream would.
 */
const stubImageUpstream = (
  onOther: (url: string) => Response = () => new Response('{}', { status: 500 }),
): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = typeof input === 'string' ? input : input.toString();
    if (requestUrl.includes('/staticmap') || requestUrl.includes('api.mapbox.com/styles/')) {
      return new Response(PREVIEW_IMAGE_BYTES, {
        status: 200,
        headers: { 'Content-Type': 'image/webp' },
      });
    }
    return onOther(requestUrl);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
    it('serves the rendered image itself so the CDN can cache the bytes', async () => {
      stubImageUpstream();

      const response = await callPreview('coords=35.68,139.65|34.69,135.50&style=clean');

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('image/');
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(PREVIEW_IMAGE_BYTES);
      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Netlify-CDN-Cache-Control')).toContain('durable');
      expect(response.headers.get('Netlify-CDN-Cache-Control')).toContain('s-maxage');
      expect(response.headers.get('Netlify-Vary')).toContain('query=');
      expect(response.headers.get('Netlify-Vary')).toContain('coords');
    });

    it('keeps the provider key out of the response (regression: the redirect published it)', async () => {
      stubImageUpstream();

      const response = await callPreview('coords=35.68,139.65|34.69,135.50&style=clean');

      expect(response.headers.get('Location')).toBeNull();
      expect(JSON.stringify([...response.headers])).not.toContain('test-google-key');
    });

    it('falls back to an uncacheable redirect when the render cannot be fetched', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        throw new Error('upstream timeout');
      }));

      const response = await callPreview('coords=35.68,139.65|34.69,135.50&style=clean');

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('maps.googleapis.com/maps/api/staticmap');
      // A degraded render must never become the cached copy of the trip.
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Netlify-CDN-Cache-Control')).toBeNull();
    });

    it('does not cache a provider error as the trip picture', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

      const response = await callPreview('coords=35.68,139.65|34.69,135.50&style=clean');

      expect(response.status).toBe(302);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('does not mark rate-limit or validation errors as cacheable', async () => {
      const invalid = await callPreview('coords=nope');
      expect(invalid.headers.get('Cache-Control')).toBe('no-store');
    });
  });

  describe('rate limiting', () => {
    it('returns 429 with Retry-After once a single IP exhausts its budget', async () => {
      stubImageUpstream();
      const ip = nextIp();
      let lastStatus = 0;
      let rejected: Response | null = null;
      for (let index = 0; index < 200; index += 1) {
        const response = await callPreview('coords=35.68,139.65|34.69,135.50', { ip });
        lastStatus = response.status;
        if (response.status === 429) {
          rejected = response;
          break;
        }
        expect(response.status).toBe(200);
      }
      expect(lastStatus).toBe(429);
      expect(Number(rejected?.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
      expect(rejected?.headers.get('Cache-Control')).toBe('no-store');
    });

    it('does not throttle other client IPs', async () => {
      stubImageUpstream();
      const throttledIp = nextIp();
      for (let index = 0; index < 200; index += 1) {
        await callPreview('coords=35.68,139.65|34.69,135.50', { ip: throttledIp });
      }
      const other = await callPreview('coords=35.68,139.65|34.69,135.50');
      expect(other.status).toBe(200);
    });

    it('charges realistic-route requests a higher cost (regression: Directions fan-out abuse)', async () => {
      stubImageUpstream();
      const simpleIp = nextIp();
      const realisticIp = nextIp();

      let simpleAllowed = 0;
      for (let index = 0; index < 200; index += 1) {
        const response = await callPreview('coords=35.68,139.65|34.69,135.50', { ip: simpleIp });
        if (response.status !== 200) break;
        simpleAllowed += 1;
      }

      let realisticAllowed = 0;
      for (let index = 0; index < 200; index += 1) {
        const response = await callPreview(
          'coords=35.68,139.65|34.69,135.50&routeMode=realistic',
          { ip: realisticIp },
        );
        if (response.status !== 200) break;
        realisticAllowed += 1;
      }

      expect(realisticAllowed).toBeGreaterThan(0);
      expect(realisticAllowed).toBeLessThan(simpleAllowed);
    });
  });

  describe('flight legs', () => {
    it('draws a curved arc for a plane leg instead of a straight line', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));

      const straight = await upstreamUrlFor('coords=-12.046,-77.043|-13.532,-71.967&routeMode=realistic');
      const flight = await upstreamUrlFor(
        'coords=-12.046,-77.043|-13.532,-71.967&routeMode=realistic&legModes=plane',
      );

      expect(decodeURIComponent(flight)).toContain('path=color:');
      expect(decodeURIComponent(flight)).toContain('|enc:');
      expect(flight).not.toBe(straight);
    });

    it('does not spend a Directions call on a plane leg (regression: flights fell back to straight lines)', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
      vi.stubGlobal('fetch', fetchMock);

      await upstreamUrlFor('coords=-12.046,-77.043|-13.532,-71.967&routeMode=realistic&legModes=plane');

      const directionsCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('/maps/api/directions'));
      expect(directionsCalls.length).toBe(0);
    });

    it('still routes non-plane legs while curving the plane leg', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
      vi.stubGlobal('fetch', fetchMock);

      await upstreamUrlFor(
        'coords=-12.046,-77.043|-13.532,-71.967|-13.163,-72.545&routeMode=realistic&legModes=plane|car',
      );

      const directionsCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('/maps/api/directions'));
      expect(directionsCalls.length).toBe(1);
    });

    it('curves plane legs on the Mapbox branch too', async () => {
      const edgeEnv: Record<string, string> = {
        VITE_GOOGLE_MAPS_API_KEY: '',
        VITE_MAPBOX_ACCESS_TOKEN: 'test-mapbox-token',
        VITE_MAP_RUNTIME_PRESET: 'mapbox_all',
      };
      vi.stubGlobal('Deno', { env: { get: (name: string) => edgeEnv[name] } });
      const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
      vi.stubGlobal('fetch', fetchMock);

      const straight = await upstreamUrlFor('coords=-12.046,-77.043|-13.532,-71.967&routeMode=realistic');
      fetchMock.mockClear();
      const flight = await upstreamUrlFor(
        'coords=-12.046,-77.043|-13.532,-71.967&routeMode=realistic&legModes=plane',
      );

      expect(decodeURIComponent(flight)).toContain('path-4+');
      expect(flight).not.toBe(straight);
      expect(fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('api.mapbox.com/directions')).length).toBe(0);
    });
  });

  describe('mapbox realistic routes', () => {
    const MAPBOX_DIRECTIONS_POLYLINE = 'yxk|Fyi~uOtCaB';

    beforeEach(() => {
      const edgeEnv: Record<string, string> = {
        // No Google key: the Mapbox branch used to fall back to straight lines here.
        VITE_GOOGLE_MAPS_API_KEY: '',
        VITE_MAPBOX_ACCESS_TOKEN: 'test-mapbox-token',
        VITE_MAP_RUNTIME_PRESET: 'mapbox_all',
      };
      vi.stubGlobal('Deno', { env: { get: (name: string) => edgeEnv[name] } });
    });

    it('draws Mapbox Directions geometry when no Google key is configured', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const requestUrl = typeof input === 'string' ? input : input.toString();
        if (requestUrl.includes('api.mapbox.com/directions')) {
          return new Response(
            JSON.stringify({ routes: [{ geometry: MAPBOX_DIRECTIONS_POLYLINE }] }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 500 });
      });
      vi.stubGlobal('fetch', fetchMock);

      const location = await upstreamUrlFor('coords=35.68,139.65|34.69,135.50&routeMode=realistic');

      expect(location).toContain('api.mapbox.com/styles/v1/');
      expect(decodeURIComponent(location)).toContain(MAPBOX_DIRECTIONS_POLYLINE);

      const directionsCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('api.mapbox.com/directions'));
      expect(directionsCalls.length).toBe(1);
      expect(String(directionsCalls[0][0])).toContain('access_token=test-mapbox-token');
    });

    it('falls back to the straight-line overlay when Mapbox has no route for a leg', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));

      const location = decodeURIComponent(
        await upstreamUrlFor('coords=35.68,139.65|34.69,135.50&routeMode=realistic'),
      );
      expect(location).toContain('api.mapbox.com/styles/v1/');
      expect(location).toContain('path-4+');
      expect(location).not.toContain(MAPBOX_DIRECTIONS_POLYLINE);
    });

    it('fans out Directions in parallel (regression: a cold five-stop card waited for four round trips)', async () => {
      let inFlight = 0;
      let peakInFlight = 0;

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const requestUrl = typeof input === 'string' ? input : input.toString();
        if (!requestUrl.includes('api.mapbox.com/directions')) {
          return new Response('{}', { status: 500 });
        }
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        // Yield so a sequential implementation would resolve each call before
        // starting the next, leaving the peak at 1.
        await new Promise((resolve) => setTimeout(resolve, 0));
        inFlight -= 1;
        return new Response(JSON.stringify({ routes: [{ geometry: MAPBOX_DIRECTIONS_POLYLINE }] }), { status: 200 });
      });
      vi.stubGlobal('fetch', fetchMock);

      await upstreamUrlFor(
        'coords=35.68,139.65|34.69,135.50|33.59,130.40|43.06,141.35|35.01,135.76&routeMode=realistic',
      );

      expect(fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('api.mapbox.com/directions')).length).toBe(4);
      expect(peakInFlight).toBe(4);
    });

    it('keeps the Directions budget capped once the fan-out is parallel', async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const requestUrl = typeof input === 'string' ? input : input.toString();
        if (!requestUrl.includes('api.mapbox.com/directions')) {
          return new Response('{}', { status: 500 });
        }
        return new Response(JSON.stringify({ routes: [{ geometry: MAPBOX_DIRECTIONS_POLYLINE }] }), { status: 200 });
      });
      vi.stubGlobal('fetch', fetchMock);

      // 12 stops = 11 legs, but only MAX_REALISTIC_DIRECTION_LEGS may be routed.
      const coords = Array.from({ length: 12 }, (_, index) => `${35 + index * 0.4},${139 - index * 0.4}`).join('|');
      await upstreamUrlFor(`coords=${coords}&routeMode=realistic`);

      expect(fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('api.mapbox.com/directions')).length).toBe(8);
    });

    it('asks Mapbox for WebP so the cached card image is not a 256 KB PNG', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));

      const location = await upstreamUrlFor('coords=35.68,139.65|34.69,135.50&w=640&h=360&scale=2');

      expect(location).toContain('/640x360@2x.webp');
    });
  });
});
