import type mapboxgl from 'mapbox-gl';

import type { MapStyle } from '../../types';
import {
  getTripMapProviderTuning,
  resolveTripMapRestingProjection,
  shouldUseTripMapGlobeIntro,
  type TripMapDockMode,
} from './tripMapProviderTuning';

export interface MapboxBasemapLoadError {
  message: string;
  status: number | null;
}

const MAPBOX_FATAL_HTTP_STATUSES = new Set([401, 403, 404, 429]);
const MAPBOX_TRIP_TUNING = getTripMapProviderTuning('mapbox');
const MAPBOX_GLOBE_INTRO_CAMERA = MAPBOX_TRIP_TUNING.intro.camera;

export const getMapboxErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
};

export const getMapboxBasemapErrorStatus = (value: unknown): number | null => {
  const rawStatus = value && typeof value === 'object'
    ? (value as { status?: unknown }).status
    : null;
  return typeof rawStatus === 'number' && Number.isFinite(rawStatus) ? rawStatus : null;
};

export const isMapboxBasemapFatalError = (value: unknown): boolean => {
  const error = value && typeof value === 'object' && 'error' in value
    ? (value as { error?: unknown }).error
    : value;
  const status = getMapboxBasemapErrorStatus(error);
  if (status !== null && MAPBOX_FATAL_HTTP_STATUSES.has(status)) {
    return true;
  }

  const message = getMapboxErrorMessage(error).toLowerCase();
  return message.includes('forbidden')
    || message.includes('unauthorized')
    || message.includes('access token')
    || message.includes('not authorized');
};

export const shouldRunMapboxGlobeIntro = (zoom: number | null | undefined): boolean => {
  return Number.isFinite(zoom);
};

export const shouldDeferMapboxCameraSyncUntilSurfaceLoad = ({
  hasCompletedInitialLoad,
  initialCameraResolved,
}: {
  hasCompletedInitialLoad: boolean;
  initialCameraResolved: boolean;
}): boolean => !hasCompletedInitialLoad && !initialCameraResolved;

export const isMeaningfulMapboxIntroTarget = (
  target: { center: [number, number]; zoom: number } | null | undefined,
): boolean => {
  if (!target || !Number.isFinite(target.zoom)) return false;
  const [lng, lat] = target.center;
  const centerOffset = Math.hypot(lng - MAPBOX_GLOBE_INTRO_CAMERA.center[0], lat - MAPBOX_GLOBE_INTRO_CAMERA.center[1]);
  return target.zoom >= MAPBOX_TRIP_TUNING.intro.minMeaningfulTargetZoom
    || centerOffset >= MAPBOX_TRIP_TUNING.intro.minMeaningfulCenterOffsetDegrees;
};

export const areMapboxCameraTargetsNearlyEqual = (
  a: { center: [number, number]; zoom: number } | null | undefined,
  b: { center: [number, number]; zoom: number } | null | undefined,
): boolean => {
  if (!a || !b) return false;
  return Math.abs(a.center[0] - b.center[0]) <= 0.00012
    && Math.abs(a.center[1] - b.center[1]) <= 0.00012
    && Math.abs(a.zoom - b.zoom) <= 0.045;
};

export const stretchMapboxViewport = (
  mapboxMap: Pick<mapboxgl.Map, 'getCanvas' | 'getCanvasContainer' | 'getContainer'>,
): void => {
  const container = mapboxMap.getContainer();
  const canvasContainer = mapboxMap.getCanvasContainer();
  const canvas = mapboxMap.getCanvas();

  [container, canvasContainer, canvas].forEach((element) => {
    element.style.cssText += '; width: 100%; height: 100%';
  });
};

export const resolveMapboxViewportSize = ({
  mapViewportSize,
  fallbackViewportSize,
  container,
}: {
  mapViewportSize: { width: number; height: number } | null | undefined;
  fallbackViewportSize?: { width: number; height: number } | null;
  container?: Pick<HTMLElement, 'getBoundingClientRect'> | null;
}): { width: number; height: number } | null => {
  const pickFiniteSize = (value: { width: number; height: number } | null | undefined) => {
    if (!value) return null;
    if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) return null;
    if (value.width <= 0 || value.height <= 0) return null;
    return {
      width: Math.round(value.width),
      height: Math.round(value.height),
    };
  };

  const resolvedViewportSize = pickFiniteSize(mapViewportSize);
  if (resolvedViewportSize) return resolvedViewportSize;

  const resolvedFallbackSize = pickFiniteSize(fallbackViewportSize);
  if (resolvedFallbackSize) return resolvedFallbackSize;

  if (!container) return null;
  const rect = container.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
};

export const resolveMapboxEffectiveProjection = ({
  mapDockMode,
  mapViewportSize,
  introActive,
}: {
  mapDockMode: TripMapDockMode;
  mapViewportSize: { width: number; height: number } | null;
  introActive: boolean;
}): 'globe' | 'mercator' => {
  if (introActive && shouldUseTripMapGlobeIntro({
    provider: 'mapbox',
    mapDockMode,
    mapViewportSize,
  })) {
    return 'globe';
  }
  return resolveTripMapRestingProjection({
    provider: 'mapbox',
    mapDockMode,
  }) ?? 'mercator';
};

export const isMapboxStyleReadyForRuntimeMutations = (
  mapboxMap: Pick<mapboxgl.Map, 'isStyleLoaded'> | null | undefined,
): boolean => {
  if (!mapboxMap || typeof mapboxMap.isStyleLoaded !== 'function') {
    return false;
  }
  try {
    return mapboxMap.isStyleLoaded();
  } catch {
    return false;
  }
};
