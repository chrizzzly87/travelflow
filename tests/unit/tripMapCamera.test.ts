import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleTripMapCamera,
  createMapboxTripMapCamera,
} from '../../components/maps/tripMapCamera';
import { getTripMapProviderTuning } from '../../components/maps/tripMapProviderTuning';

const makeMapboxMap = () => {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const map = {
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    jumpTo: vi.fn(),
    setZoom: vi.fn(),
    getZoom: vi.fn(() => 7.5),
    getBounds: vi.fn(() => ({ contains: vi.fn(() => true) })),
    resize: vi.fn(),
    on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    }),
    off: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(fn);
    }),
  };
  const emit = (event: string) => handlers.get(event)?.forEach((fn) => fn());
  return { map, emit, handlers };
};

const makeGoogleMap = () => {
  const handlers = new Map<string, Set<() => void>>();
  const map = {
    fitBounds: vi.fn(),
    panTo: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    getZoom: vi.fn(() => 9),
    getBounds: vi.fn(() => ({ contains: vi.fn(() => true) })),
    addListener: vi.fn((event: string, fn: () => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
      return { remove: () => handlers.get(event)?.delete(fn) };
    }),
  };
  return { map, handlers };
};

const installGoogleBounds = () => {
  const extend = vi.fn();
  class FakeBounds {
    extend = extend;
  }
  vi.stubGlobal('window', { google: { maps: { LatLngBounds: FakeBounds, event: { trigger: vi.fn() } } } });
  return { extend };
};

describe('tripMapCamera', () => {
  it('mapbox fitBounds builds LngLatBounds from points in lng,lat order and passes padding', () => {
    const { map } = makeMapboxMap();
    const camera = createMapboxTripMapCamera(map as never);
    const padding = { top: 1, right: 2, bottom: 3, left: 4 };
    camera.fitBounds(
      [{ lat: 48, lng: 11 }, { lat: 52, lng: 13 }, { lat: 50, lng: 9 }],
      padding,
      { maxZoom: 12, animate: false },
    );
    expect(map.fitBounds).toHaveBeenCalledWith(
      [[9, 48], [13, 52]],
      { padding, maxZoom: 12, animate: false },
    );
  });

  it('fitBounds with no points does nothing', () => {
    const mapbox = makeMapboxMap();
    createMapboxTripMapCamera(mapbox.map as never).fitBounds([], 10);
    expect(mapbox.map.fitBounds).not.toHaveBeenCalled();
    expect(mapbox.map.easeTo).not.toHaveBeenCalled();
    expect(mapbox.map.jumpTo).not.toHaveBeenCalled();

    installGoogleBounds();
    const google = makeGoogleMap();
    createGoogleTripMapCamera(google.map as never).fitBounds([], 10);
    expect(google.map.fitBounds).not.toHaveBeenCalled();
    expect(google.map.panTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('fitBounds with one point pans instead', () => {
    const mapbox = makeMapboxMap();
    createMapboxTripMapCamera(mapbox.map as never).fitBounds([{ lat: 48, lng: 11 }], 10, { animate: false });
    expect(mapbox.map.fitBounds).not.toHaveBeenCalled();
    expect(mapbox.map.jumpTo).toHaveBeenCalledWith({
      center: [11, 48],
      zoom: getTripMapProviderTuning('mapbox').selection.cityFocusZoom,
    });

    installGoogleBounds();
    const google = makeGoogleMap();
    createGoogleTripMapCamera(google.map as never).fitBounds([{ lat: 48, lng: 11 }], 10);
    expect(google.map.fitBounds).not.toHaveBeenCalled();
    expect(google.map.panTo).toHaveBeenCalledWith({ lat: 48, lng: 11 });
    expect(google.map.setZoom).toHaveBeenCalledWith(getTripMapProviderTuning('google').selection.cityFocusZoom);
    vi.unstubAllGlobals();
  });

  it('google fitBounds extends a LatLngBounds and passes padding', () => {
    const { extend } = installGoogleBounds();
    const google = makeGoogleMap();
    createGoogleTripMapCamera(google.map as never).fitBounds(
      [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }],
      { top: 1, right: 2, bottom: 3, left: 4 },
    );
    expect(extend).toHaveBeenCalledTimes(2);
    expect(google.map.fitBounds).toHaveBeenCalledWith(expect.anything(), { top: 1, right: 2, bottom: 3, left: 4 });
    vi.unstubAllGlobals();
  });

  it('mapbox onZoom reports map.getZoom() and unsubscribes', () => {
    const { map, emit } = makeMapboxMap();
    const camera = createMapboxTripMapCamera(map as never);
    const listener = vi.fn();
    const off = camera.onZoom(listener);
    emit('zoom');
    expect(listener).toHaveBeenCalledWith(7.5);
    off();
    emit('zoom');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('mapbox onIdle maps to idle and unsubscribes', () => {
    const { map, emit } = makeMapboxMap();
    const listener = vi.fn();
    const off = createMapboxTripMapCamera(map as never).onIdle(listener);
    emit('idle');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    emit('idle');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('google containsPoint reads getBounds().contains', () => {
    const contains = vi.fn(() => false);
    const { map } = makeGoogleMap();
    map.getBounds.mockReturnValue({ contains });
    const camera = createGoogleTripMapCamera(map as never);
    expect(camera.containsPoint({ lat: 1, lng: 2 })).toBe(false);
    expect(contains).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it('google onZoom uses zoom_changed and reports getZoom()', () => {
    const { map, handlers } = makeGoogleMap();
    const listener = vi.fn();
    const off = createGoogleTripMapCamera(map as never).onZoom(listener);
    handlers.get('zoom_changed')?.forEach((fn) => fn());
    expect(listener).toHaveBeenCalledWith(9);
    off();
    expect(handlers.get('zoom_changed')?.size).toBe(0);
  });

  it('mapbox containsPoint, getZoom, setZoom and resize delegate', () => {
    const { map } = makeMapboxMap();
    const camera = createMapboxTripMapCamera(map as never);
    expect(camera.containsPoint({ lat: 1, lng: 2 })).toBe(true);
    expect(camera.getZoom()).toBe(7.5);
    camera.setZoom(4);
    expect(map.setZoom).toHaveBeenCalledWith(4);
    camera.resize();
    expect(map.resize).toHaveBeenCalled();
  });
});
