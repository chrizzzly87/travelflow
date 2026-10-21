import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseVideoRange, TRIP_VIDEO, normalizeTripVideoStyle, tripVideoLeaseExpired } from '../../shared/tripOgVideo';
import { buildTripVideoMetaTags, resolveReadyTripVideoMedia } from '../../netlify/edge-lib/trip-og-video-meta';
import { claimRenderBudget, claimVideo, videoRevision, tripVideoStoreName } from '../../netlify/lib/trip-video-store';
import { buildVideoFrameSvg, getVideoEncoderPath } from '../../netlify/lib/trip-video-renderer';
import { parseOgHeadMetadata } from '../../services/adminOgToolsService';

// In-memory CAS store exercises real claim decisions, including competing writers.
const makeStore = () => {
  const values = new Map<string, { data: any; etag: string }>();
  let writes = 0;
  return {
    values,
    getWithMetadata: vi.fn(async (key: string) => values.get(key) || null),
    setJSON: vi.fn(async (key: string, data: unknown, options?: any) => {
      const existing = values.get(key);
      if ((options?.onlyIfNew && existing) || (options?.onlyIfMatch && existing?.etag !== options.onlyIfMatch)) return { modified: false };
      values.set(key, { data, etag: String(++writes) });
      return { modified: true };
    }),
  };
};

describe('trip video bounds and byte ranges', () => {
  it('isolates preview deploys from each other and production without build env vars', () => {
    expect(tripVideoStoreName({ context: 'production', id: 'p1' })).toBe('trip-og-video-production');
    expect(tripVideoStoreName({ context: 'production', id: 'p2' })).toBe('trip-og-video-production');
    expect(tripVideoStoreName({ context: 'branch-deploy', id: 'b1' })).not.toBe(tripVideoStoreName({ context: 'deploy-preview', id: 'b2' }));
    expect(tripVideoStoreName({ context: 'branch-deploy', id: 'b1' })).not.toBe('trip-og-video-production');
  });
  it('lets stalled jobs become retryable without rendering during status reads', () => {
    expect(tripVideoLeaseExpired({ status: 'queued', requestedAt: 0 }, TRIP_VIDEO.leaseMs)).toBe(true);
    expect(tripVideoLeaseExpired({ status: 'rendering', requestedAt: 0 }, 1)).toBe(false);
    expect(tripVideoLeaseExpired({ status: 'ready', requestedAt: 0 }, TRIP_VIDEO.leaseMs)).toBe(false);
  });
  it('sets a small, even-dimension, browser-compatible budget', () => {
    expect(TRIP_VIDEO).toMatchObject({ width: 1200, height: 630, seconds: 6, fps: 12, maxBytes: 2097152 });
    expect(normalizeTripVideoStyle('satellite')).toBe('satellite');
  });
  it.each([
    ['bytes=0-99', { start: 0, end: 99 }], ['bytes=900-', { start: 900, end: 999 }],
    ['bytes=-50', { start: 950, end: 999 }], ['bytes=0-9999', { start: 0, end: 999 }],
    ['bytes=1000-', 'invalid'], ['bytes=10-1', 'invalid'], ['bytes=-0', 'invalid'],
    ['bytes=0-1,4-5', 'invalid'], ['bytes=-', 'invalid'], ['bytes=9007199254740992-', 'invalid'],
  ])('parses %s safely', (header, expected) => expect(parseVideoRange(header as string, 1000)).toEqual(expected));
  it('supports a full response without Range', () => expect(parseVideoRange(null, 1000)).toBeNull());
});

describe('video generation cost controls', () => {
  const now = 10 * TRIP_VIDEO.cooldownMs;
  it('deduplicates concurrent enqueue requests atomically', async () => {
    const store = makeStore();
    const results = await Promise.all([claimVideo(store as any, 'trip', 'r1', 'clean', false, now), claimVideo(store as any, 'trip', 'r1', 'clean', false, now)]);
    expect(results.filter(result => result.claimed)).toHaveLength(1);
  });
  it('never rerenders an identical ready revision unless explicitly requested', async () => {
    const store = makeStore();
    store.values.set('trip/state', { etag: 'old', data: { status: 'ready', revision: 'r1', requestedAt: 0 } });
    expect((await claimVideo(store as any, 'trip', 'r1', 'clean', false, now)).claimed).toBe(false);
    expect(store.setJSON).not.toHaveBeenCalled();
  });
  it('applies cooldown to failed jobs and forced renders', async () => {
    const store = makeStore();
    store.values.set('trip/state', { etag: 'old', data: { status: 'failed', revision: 'r1', requestedAt: now - 100 } });
    expect(await claimVideo(store as any, 'trip', 'r2', 'dark', true, now)).toMatchObject({ claimed: false, limited: true });
  });
  it('caps all heavy work at 20 per hour, reusing fixed slots next hour', async () => {
    const store = makeStore();
    for (let n = 0; n < TRIP_VIDEO.hourlyRenderLimit; n++) expect(await claimRenderBudget(store as any, now)).toBe(true);
    expect(await claimRenderBudget(store as any, now)).toBe(false);
    expect(await claimRenderBudget(store as any, now + 3_600_000)).toBe(true);
    expect(store.values.size).toBe(TRIP_VIDEO.hourlyRenderLimit);
  });
  it('revision follows map content and style, not irrelevant autosave timestamps', () => {
    const trip = { title: 'Taiwan', updatedAt: 1, items: [{ type: 'city', title: 'Taipei', coordinates: { lat: 25, lng: 121 } }] };
    expect(videoRevision(trip, 'clean')).toBe(videoRevision({ ...trip, updatedAt: 2 }, 'clean'));
    expect(videoRevision(trip, 'clean')).not.toBe(videoRevision(trip, 'dark'));
    expect(videoRevision(trip, 'clean')).not.toBe(videoRevision({ ...trip, title: 'New journey' }, 'clean'));
  });
});

describe('ready-only OG video metadata', () => {
  beforeEach(() => vi.unstubAllGlobals());
  it('does not advertise a video before rendering completes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'queued' })));
    const media = await resolveReadyTripVideoMedia('https://example.com', { tripId: 'trip', versionId: null });
    expect(media).toBeUndefined();
    expect(buildTripVideoMetaTags(media?.videoUrl)).toEqual([]);
  });
  it('publishes MP4 structured tags and optional poster without replacing the image fallback', async () => {
    const revision = 'a'.repeat(24);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'ready', revision, posterAsImage: true })));
    const media = await resolveReadyTripVideoMedia('https://example.com', { token: 'share', versionId: null });
    expect(media?.videoUrl).toContain('s=share&r=');
    expect(media?.posterUrl).toContain('asset=poster');
    const html = buildTripVideoMetaTags(media?.videoUrl).join('');
    expect(parseOgHeadMetadata(html)).toMatchObject({ ogVideo: media?.videoUrl, ogVideoType: 'video/mp4' });
    expect(html).toContain('og:video:width');
    expect(html).toContain('1200');
    expect(html).toContain('630');
  });
  it('publishes a new media URL on explicit refresh even with unchanged trip content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: 'ready', revision: 'a'.repeat(24), mediaRevision: 'b'.repeat(24) })));
    const media = await resolveReadyTripVideoMedia('https://example.com', { tripId: 'trip', versionId: null });
    expect(media?.videoUrl).toContain('r=' + 'b'.repeat(24));
  });
  it('leaves version links image-only and does not request current video', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect(await resolveReadyTripVideoMedia('https://example.com', { token: 's', versionId: 'past' })).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('omits stale, malformed, and failed video lookups', async () => {
    for (const payload of [{ status: 'ready', stale: true, revision: 'a'.repeat(24) }, { status: 'ready', revision: '<script>' }]) {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload)));
      expect(await resolveReadyTripVideoMedia('https://example.com', { tripId: 'trip', versionId: null })).toBeUndefined();
    }
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await resolveReadyTripVideoMedia('https://example.com', { tripId: 'trip', versionId: null })).toBeUndefined();
  });
});

describe('animated frame safety', () => {
  it('resolves the actual Linux executable rather than a nonexistent package entry point', () => {
    expect(getVideoEncoderPath('linux')).toMatch(/@ffmpeg-installer\/linux-x64\/ffmpeg$/);
  });
  it('escapes trip labels and progressively reveals map routes', () => {
    const data = { title: '<script>alert(1)</script>', description: 'October', badge: '2 weeks', style: 'clean' as const, mapDataUri: 'data:image/png;base64,AA==', color: '#4f46e5', points: [{ x: 0.2, y: 0.2, label: '<Taipei>' }, { x: 0.8, y: 0.8, label: 'Tainan' }] };
    const first = buildVideoFrameSvg(data, 0);
    const last = buildVideoFrameSvg(data, 1);
    expect(last).not.toContain('<script>');
    expect(last).toContain('&lt;Taipei&gt;');
    expect(first).toContain('stroke-dasharray="0.00');
    expect(last).not.toContain('stroke-dasharray="0.00');
    expect(last).toContain('width="1200" height="630"');
  });
});
