import { afterEach, describe, expect, it, vi } from 'vitest';
const id = '4fee56dd-a79a-4130-bef0-cc7ffb552ea5';
vi.mock('../../netlify/edge-lib/trip-og-data.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../../netlify/edge-lib/trip-og-data.ts')>(),
  fetchSharedTrip: async () => ({ trip: { id, title: 'Taiwan', items: [] } }),
  fetchSharedTripByTripId: async () => ({ token: 'share-token', sharedTrip: { trip: { id, title: 'Taiwan', items: [] } } }),
}));
import handler from '../../netlify/edge-functions/trip-og-meta';
import playground from '../../netlify/edge-functions/trip-og-playground';
afterEach(() => vi.unstubAllGlobals());
describe('trip preview cache tagging and playground settings', () => {
  it.each([`/trip/${id}`, '/s/share-token'])('tags %s with the underlying trip for targeted refresh', async path => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const result = await handler(new Request('https://feature.example.com' + path), {
      next: async () => new Response('<html><head></head><body></body></html>', { headers: { 'content-type': 'text/html', 'netlify-cdn-cache-control': 'public,max-age=31536000' } }),
    } as any);
    expect(result.headers.get('netlify-cache-tag')).toBe(`trip-og-${id}`);
    expect(result.headers.get('netlify-cdn-cache-control')).toBe(result.headers.get('cache-control'));
    expect(result.headers.get('netlify-cdn-cache-control')).not.toContain('31536000');
  });
  it('uses classic dimensions for both video and its attached poster', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'ready', revision: 'a'.repeat(24), format: 'classic', posterAsImage: true })));
    const response = await handler(new Request(`https://feature.example.com/trip/${id}`), { next: async () => new Response('<html><head></head><body></body></html>', { headers: { 'content-type': 'text/html' } }) } as any);
    const html = await response.text();
    for (const kind of ['image', 'video']) {
      expect(html).toContain(`og:${kind}:width" content="960"`);
      expect(html).toContain(`og:${kind}:height" content="720"`);
    }
  });
  it('keeps preview settings on admin links, defaults image maps to Mapbox, and avoids playing a mismatched cached video', async () => {
    const html = await (await playground(new Request(`https://feature.example.com/api/og/playground?trip=${id}`))).text();
    expect(html).toContain("params.set('mr', 'mmmm')");
    expect(html).not.toContain("'__t='");
    expect(html).not.toContain('Date.now()');
    expect(html).toContain('Image preview could not load.');
    expect(html).toContain("['trip', 'mapStyle', 'routeMode', 'format']");
    expect(html).toContain('state.settingsMatch !== false');
    expect(html).toContain("videoParams.set('format', format)");
    expect(html).not.toContain("params.set('format', format)");
  });
});
