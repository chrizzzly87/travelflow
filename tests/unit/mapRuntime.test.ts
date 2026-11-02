import { describe, expect, it } from 'vitest';
import {
  buildMapRuntimeSelectionCacheKey,
  isRendererLockedByPreset,
  parseMapRuntimeOverrideCookie,
  parseMapRuntimeSelectionCacheKey,
  resolveMapRuntime,
  serializeMapRuntimeOverrideCookie,
  usesGoogle,
} from '../../shared/mapRuntime';

describe('shared/mapRuntime resolveMapRuntime', () => {
  it('falls back to google_all for invalid presets', () => {
    const resolved = resolveMapRuntime({
      defaultPreset: 'invalid' as never,
      availability: {
        googleMapsKeyAvailable: true,
        mapboxAccessTokenAvailable: true,
      },
    });

    expect(resolved.defaultPreset).toBe('google_all');
    expect(resolved.effectiveSelection).toEqual({
      renderer: 'google',
      routes: 'google',
      locationSearch: 'google',
      staticMaps: 'google',
    });
  });

  it('keeps the mixed safe preset when both providers are available', () => {
    const resolved = resolveMapRuntime({
      defaultPreset: 'mapbox_visual_google_services',
      availability: {
        googleMapsKeyAvailable: true,
        mapboxAccessTokenAvailable: true,
      },
    });

    expect(resolved.effectiveSelection).toEqual({
      renderer: 'mapbox',
      routes: 'google',
      locationSearch: 'google',
      staticMaps: 'mapbox',
    });
    expect(resolved.effectivePresetMatch).toBe('mapbox_visual_google_services');
  });

  it('falls back an explicit mapbox routes override to google', () => {
    const resolved = resolveMapRuntime({
      defaultPreset: 'mapbox_all',
      override: { selection: { routes: 'mapbox' } },
      overrideSource: 'cookie',
      availability: {
        googleMapsKeyAvailable: true,
        mapboxAccessTokenAvailable: true,
      },
    });

    expect(resolved.effectiveSelection.routes).toBe('google');
    expect(resolved.warnings).toEqual([
      expect.stringContaining('mapbox does not support routes'),
    ]);
  });

  it('falls back to google when mapbox is requested but unavailable', () => {
    const resolved = resolveMapRuntime({
      defaultPreset: 'mapbox_visual_google_services',
      availability: {
        googleMapsKeyAvailable: true,
        mapboxAccessTokenAvailable: false,
      },
    });

    expect(resolved.effectiveSelection).toEqual({
      renderer: 'google',
      routes: 'google',
      locationSearch: 'google',
      staticMaps: 'google',
    });
    expect(resolved.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Mapbox renderer is unavailable'),
      expect.stringContaining('Mapbox staticMaps is unavailable'),
    ]));
  });
});

describe('shared/mapRuntime cookie + cache helpers', () => {
  it('serializes and parses override cookies', () => {
    const raw = serializeMapRuntimeOverrideCookie({
      preset: 'default',
      selection: { renderer: 'mapbox', staticMaps: 'mapbox' },
    });

    expect(parseMapRuntimeOverrideCookie(raw)).toEqual({
      preset: 'default',
      selection: {
        renderer: 'mapbox',
        staticMaps: 'mapbox',
      },
    });
  });

  it('round-trips the compact runtime cache key', () => {
    const cacheKey = buildMapRuntimeSelectionCacheKey({
      renderer: 'mapbox',
      routes: 'google',
      locationSearch: 'google',
      staticMaps: 'mapbox',
    });

    expect(cacheKey).toBe('mggm');
    expect(parseMapRuntimeSelectionCacheKey(cacheKey)).toEqual({
      renderer: 'mapbox',
      routes: 'google',
      locationSearch: 'google',
      staticMaps: 'mapbox',
    });
  });
});

describe('shared/mapRuntime none service implementation', () => {
  it('mapbox_all needs no Google, with or without a Google key', () => {
    for (const googleMapsKeyAvailable of [true, false]) {
      const r = resolveMapRuntime({ defaultPreset: 'mapbox_all', availability: { googleMapsKeyAvailable, mapboxAccessTokenAvailable: true } });
      expect(r.effectiveSelection).toEqual({ renderer: 'mapbox', routes: 'none', locationSearch: 'mapbox', staticMaps: 'mapbox' });
      expect(usesGoogle(r.effectiveSelection)).toBe(false);
      expect(r.warnings).toEqual([]);
      expect(r.activeSelectionKey).toBe('mnmm');
    }
  });

  it('mapbox_all without a Mapbox token falls back to full Google', () => {
    const r = resolveMapRuntime({ defaultPreset: 'mapbox_all', availability: { googleMapsKeyAvailable: true, mapboxAccessTokenAvailable: false } });
    expect(r.effectiveSelection).toEqual({ renderer: 'google', routes: 'google', locationSearch: 'google', staticMaps: 'google' });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('usesGoogle is true for the other presets', () => {
    const a = { googleMapsKeyAvailable: true, mapboxAccessTokenAvailable: true };
    expect(usesGoogle(resolveMapRuntime({ defaultPreset: 'google_all', availability: a }).effectiveSelection)).toBe(true);
    expect(usesGoogle(resolveMapRuntime({ defaultPreset: 'mapbox_visual_google_services', availability: a }).effectiveSelection)).toBe(true);
  });

  it('round-trips the none cache code', () => {
    expect(parseMapRuntimeSelectionCacheKey('mnmm')).toEqual({ renderer: 'mapbox', routes: 'none', locationSearch: 'mapbox', staticMaps: 'mapbox' });
  });

  it('locks the renderer only for mapbox_all', () => {
    expect(isRendererLockedByPreset('mapbox_all')).toBe(true);
    expect(isRendererLockedByPreset('google_all')).toBe(false);
  });
});
