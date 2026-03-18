// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  areMapboxCameraTargetsNearlyEqual,
  getMapboxBasemapErrorStatus,
  isMeaningfulMapboxIntroTarget,
  isMapboxBasemapFatalError,
  isMapboxStyleReadyForRuntimeMutations,
  resolveMapboxEffectiveProjection,
  resolveMapboxViewportSize,
  shouldRunMapboxGlobeIntro,
  stretchMapboxViewport,
} from '../../components/maps/MapboxBasemapSync';

describe('components/maps/MapboxBasemapSync', () => {
  it('detects fatal auth and restriction errors from Mapbox tile requests', () => {
    expect(isMapboxBasemapFatalError({ status: 403, message: '' })).toBe(true);
    expect(isMapboxBasemapFatalError({ error: { status: 401, message: 'Unauthorized' } })).toBe(true);
    expect(isMapboxBasemapFatalError({ error: { status: 404, message: 'Not Found' } })).toBe(true);
  });

  it('ignores non-fatal runtime events and extracts statuses when present', () => {
    expect(getMapboxBasemapErrorStatus({ status: 429 })).toBe(429);
    expect(isMapboxBasemapFatalError({ status: 0, message: '' })).toBe(false);
    expect(isMapboxBasemapFatalError({ error: { message: 'Transient warning' } })).toBe(false);
  });

  it('stretches the Mapbox viewport elements to fill the shared map surface', () => {
    const container = document.createElement('div');
    const canvasContainer = document.createElement('div');
    const canvas = document.createElement('canvas');

    stretchMapboxViewport({
      getContainer: () => container,
      getCanvasContainer: () => canvasContainer,
      getCanvas: () => canvas,
    });

    expect(container.style.width).toBe('100%');
    expect(container.style.height).toBe('100%');
    expect(canvasContainer.style.width).toBe('100%');
    expect(canvasContainer.style.height).toBe('100%');
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
  });

  it('falls back to the live container geometry when the trip page has not published viewport dimensions yet', () => {
    const container = {
      getBoundingClientRect: () => ({ width: 822.4, height: 468.6 }),
    } as unknown as HTMLElement;

    expect(resolveMapboxViewportSize({
      mapViewportSize: null,
      fallbackViewportSize: null,
      container,
    })).toEqual({
      width: 822,
      height: 469,
    });
  });

  it('treats style mutations as unavailable until Mapbox reports the style as loaded', () => {
    expect(isMapboxStyleReadyForRuntimeMutations(null)).toBe(false);
    expect(isMapboxStyleReadyForRuntimeMutations({
      isStyleLoaded: () => false,
    } as any)).toBe(false);
    expect(isMapboxStyleReadyForRuntimeMutations({
      isStyleLoaded: () => true,
    } as any)).toBe(true);
  });

  it('triggers the globe intro as soon as a finite synced trip camera target exists', () => {
    expect(shouldRunMapboxGlobeIntro(null)).toBe(false);
    expect(shouldRunMapboxGlobeIntro(2.05)).toBe(true);
    expect(shouldRunMapboxGlobeIntro(2.3)).toBe(true);
  });

  it('waits to animate until the synced target is meaningfully away from the initial globe view', () => {
    expect(isMeaningfulMapboxIntroTarget({ center: [2.6, 20.1], zoom: 2.2 })).toBe(false);
    expect(isMeaningfulMapboxIntroTarget({ center: [105.85, 21.03], zoom: 4.8 })).toBe(true);
  });

  it('treats nearly identical Google and Mapbox cameras as equivalent after a gesture-driven sync', () => {
    expect(areMapboxCameraTargetsNearlyEqual(
      { center: [13.405, 52.52], zoom: 9.4 },
      { center: [13.40506, 52.52005], zoom: 9.43 },
    )).toBe(true);

    expect(areMapboxCameraTargetsNearlyEqual(
      { center: [13.405, 52.52], zoom: 9.4 },
      { center: [13.412, 52.53], zoom: 9.65 },
    )).toBe(false);
  });

  it('uses globe only for the intro pass and keeps the mixed trip view flat afterward', () => {
    expect(resolveMapboxEffectiveProjection({
      mapDockMode: 'docked',
      mapViewportSize: { width: 960, height: 600 },
      introActive: true,
    })).toBe('globe');

    expect(resolveMapboxEffectiveProjection({
      mapDockMode: 'docked',
      mapViewportSize: { width: 960, height: 600 },
      introActive: false,
    })).toBe('mercator');

    expect(resolveMapboxEffectiveProjection({
      mapDockMode: 'floating',
      mapViewportSize: { width: 320, height: 220 },
      introActive: true,
    })).toBe('mercator');
  });
});
