import { afterEach, describe, expect, it, vi } from 'vitest';
import siteOgMeta from '../../netlify/edge-functions/site-og-meta.ts';

const ORIGIN = 'https://travelflowapp.netlify.app';
const HTML_RESPONSE = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';

describe('site OG edge html cache headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds the longer Netlify CDN cache header for marketing routes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));

    const response = await siteOgMeta(new Request(`${ORIGIN}/pricing`), {
      next: async () => new Response(HTML_RESPONSE, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      }),
    });

    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(response.headers.get('netlify-cdn-cache-control')).toBe(
      'public, max-age=3600, stale-while-revalidate=86400',
    );
  });

  it('keeps strict tool routes on the short cache policy and removes any inherited CDN override', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));

    const response = await siteOgMeta(new Request(`${ORIGIN}/create-trip`), {
      next: async () => new Response(HTML_RESPONSE, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'netlify-cdn-cache-control': 'public, max-age=9999',
        },
      }),
    });

    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=60, stale-while-revalidate=60, must-revalidate',
    );
    expect(response.headers.get('netlify-cdn-cache-control')).toBeNull();
  });
});
