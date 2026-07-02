import { describe, expect, it } from 'vitest';

import {
  MAX_PREVIEW_COORDS,
  MAX_PREVIEW_COORDS_PARAM_LENGTH,
  buildPreviewCacheKey,
  buildPreviewNetlifyVaryValue,
  createTokenBucketLimiter,
  parsePreviewCoords,
  resolvePreviewClientIp,
} from '../../netlify/edge-lib/trip-map-preview-guard.ts';

const buildCoordsParam = (count: number): string =>
  Array.from({ length: count }, (_, index) => `${(index % 80) + 0.5},${(index % 170) + 0.25}`).join('|');

describe('parsePreviewCoords', () => {
  it('accepts valid pipe-separated lat,lng pairs', () => {
    const result = parsePreviewCoords('35.68,139.65|34.69,135.50');
    expect(result).toEqual({
      ok: true,
      coords: [
        { lat: 35.68, lng: 139.65 },
        { lat: 34.69, lng: 135.5 },
      ],
    });
  });

  it('accepts negative coordinates and boundary values', () => {
    const result = parsePreviewCoords('-90,-180|90,180');
    expect(result.ok).toBe(true);
  });

  it('rejects more than the client-side stop cap', () => {
    const result = parsePreviewCoords(buildCoordsParam(MAX_PREVIEW_COORDS + 1));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain(`${MAX_PREVIEW_COORDS}`);
  });

  it('accepts exactly the cap', () => {
    expect(parsePreviewCoords(buildCoordsParam(MAX_PREVIEW_COORDS)).ok).toBe(true);
  });

  it('rejects malformed pairs instead of silently filtering them', () => {
    expect(parsePreviewCoords('35.68,139.65|junk').ok).toBe(false);
    expect(parsePreviewCoords('35.68').ok).toBe(false);
    expect(parsePreviewCoords('').ok).toBe(false);
    expect(parsePreviewCoords('1,2,3').ok).toBe(false);
    expect(parsePreviewCoords('1e10,20').ok).toBe(false);
  });

  it('rejects out-of-range latitude and longitude', () => {
    expect(parsePreviewCoords('91,0').ok).toBe(false);
    expect(parsePreviewCoords('-91,0').ok).toBe(false);
    expect(parsePreviewCoords('0,181').ok).toBe(false);
    expect(parsePreviewCoords('0,-181').ok).toBe(false);
  });

  it('rejects oversized coords parameters', () => {
    const oversized = '1,1|'.repeat(Math.ceil(MAX_PREVIEW_COORDS_PARAM_LENGTH / 4) + 1);
    expect(parsePreviewCoords(oversized).ok).toBe(false);
  });
});

describe('buildPreviewCacheKey', () => {
  it('is deterministic regardless of param order', () => {
    const a = new URLSearchParams('coords=1,2|3,4&style=clean&w=640&h=360');
    const b = new URLSearchParams('h=360&w=640&style=clean&coords=1,2|3,4');
    expect(buildPreviewCacheKey(a)).toBe(buildPreviewCacheKey(b));
  });

  it('ignores junk params that do not affect the image', () => {
    const clean = new URLSearchParams('coords=1,2|3,4&style=clean');
    const noisy = new URLSearchParams('coords=1,2|3,4&style=clean&cachebuster=123&utm_source=x');
    expect(buildPreviewCacheKey(noisy)).toBe(buildPreviewCacheKey(clean));
  });

  it('produces different keys for different coords', () => {
    const a = new URLSearchParams('coords=1,2|3,4');
    const b = new URLSearchParams('coords=1,2|3,5');
    expect(buildPreviewCacheKey(a)).not.toBe(buildPreviewCacheKey(b));
  });
});

describe('buildPreviewNetlifyVaryValue', () => {
  it('limits the CDN cache key to the allowlisted query params', () => {
    const value = buildPreviewNetlifyVaryValue();
    expect(value.startsWith('query=')).toBe(true);
    expect(value).toContain('coords');
    expect(value).toContain('mr');
    expect(value).not.toContain('cachebuster');
  });
});

describe('createTokenBucketLimiter', () => {
  it('allows a burst up to capacity, then blocks', () => {
    const limiter = createTokenBucketLimiter({ capacity: 3, refillPerSecond: 1 });
    const now = 1_000_000;
    expect(limiter.consume('ip', 1, now).allowed).toBe(true);
    expect(limiter.consume('ip', 1, now).allowed).toBe(true);
    expect(limiter.consume('ip', 1, now).allowed).toBe(true);
    const blocked = limiter.consume('ip', 1, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('refills tokens over time', () => {
    const limiter = createTokenBucketLimiter({ capacity: 2, refillPerSecond: 1 });
    const now = 1_000_000;
    limiter.consume('ip', 2, now);
    expect(limiter.consume('ip', 1, now).allowed).toBe(false);
    expect(limiter.consume('ip', 1, now + 1_100).allowed).toBe(true);
  });

  it('supports weighted costs for expensive requests', () => {
    const limiter = createTokenBucketLimiter({ capacity: 10, refillPerSecond: 0.5 });
    const now = 1_000_000;
    expect(limiter.consume('ip', 5, now).allowed).toBe(true);
    expect(limiter.consume('ip', 5, now).allowed).toBe(true);
    expect(limiter.consume('ip', 5, now).allowed).toBe(false);
  });

  it('tracks keys independently', () => {
    const limiter = createTokenBucketLimiter({ capacity: 1, refillPerSecond: 1 });
    const now = 1_000_000;
    expect(limiter.consume('a', 1, now).allowed).toBe(true);
    expect(limiter.consume('a', 1, now).allowed).toBe(false);
    expect(limiter.consume('b', 1, now).allowed).toBe(true);
  });

  it('caps token accumulation at capacity', () => {
    const limiter = createTokenBucketLimiter({ capacity: 2, refillPerSecond: 100 });
    const now = 1_000_000;
    limiter.consume('ip', 1, now);
    // A long idle period must not allow a burst above capacity.
    expect(limiter.consume('ip', 2, now + 60_000).allowed).toBe(true);
    expect(limiter.consume('ip', 1, now + 60_000).allowed).toBe(false);
  });
});

describe('resolvePreviewClientIp', () => {
  it('prefers the edge context ip', () => {
    const request = new Request('https://example.com/', {
      headers: { 'x-nf-client-connection-ip': '2.2.2.2' },
    });
    expect(resolvePreviewClientIp(request, { ip: '1.1.1.1' })).toBe('1.1.1.1');
  });

  it('falls back to the Netlify client connection header', () => {
    const request = new Request('https://example.com/', {
      headers: { 'x-nf-client-connection-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3, 4.4.4.4' },
    });
    expect(resolvePreviewClientIp(request)).toBe('2.2.2.2');
  });

  it('uses the first x-forwarded-for hop as a last resort', () => {
    const request = new Request('https://example.com/', {
      headers: { 'x-forwarded-for': '3.3.3.3, 4.4.4.4' },
    });
    expect(resolvePreviewClientIp(request)).toBe('3.3.3.3');
    expect(resolvePreviewClientIp(new Request('https://example.com/'))).toBe('unknown');
  });
});
