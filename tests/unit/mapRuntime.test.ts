import { describe, expect, it } from 'vitest';
import {
  buildMapRuntimeSelectionCacheKey,
  parseMapRuntimeOverrideCookie,
  parseMapRuntimeSelectionCacheKey,
  resolveMapRuntime,
  serializeMapRuntimeOverrideCookie,
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

  it('falls back unsupported mapbox_all subsystems to google in v1', () => {
    const resolved = resolveMapRuntime({
      defaultPreset: 'google_all',
      override: { preset: 'mapbox_all' },
      overrideSource: 'cookie',
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
    expect(resolved.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('mapbox does not support routes'),
      expect.stringContaining('mapbox does not support locationSearch'),
    ]));
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
