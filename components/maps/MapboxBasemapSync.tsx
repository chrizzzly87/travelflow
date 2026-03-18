import React, { useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type mapboxgl from 'mapbox-gl';

import {
  applyMapboxTripLabelVisibilityPolish,
  buildMapboxStyleConfig,
  getMapboxStyleDescriptor,
} from '../../services/mapRendererVisualStyleService';
import type { MapStyle } from '../../types';

export interface MapboxBasemapLoadError {
  message: string;
  status: number | null;
}

interface MapboxBasemapSyncProps {
  accessToken: string;
  googleMap: google.maps.Map | null;
  mapStyle: MapStyle;
  interactive?: boolean;
  onLoadError?: (error: MapboxBasemapLoadError) => void;
  onMapReadyChange?: (map: mapboxgl.Map | null) => void;
  onModuleReadyChange?: (mapboxModule: typeof import('mapbox-gl').default | null) => void;
  onSurfaceReadyChange?: (isReady: boolean) => void;
  onStyleReload?: () => void;
}

const MAPBOX_FATAL_HTTP_STATUSES = new Set([401, 403, 404, 429]);
const MAPBOX_GLOBE_INTRO_CAMERA = {
  center: [2, 20] as [number, number],
  zoom: 0.58,
  bearing: -32,
  pitch: 0,
};
const MAPBOX_MIN_TILE_CACHE_SIZE = 512;
const MAPBOX_MAX_TILE_CACHE_SIZE = 1536;
const MAPBOX_SYNC_COOLDOWN_MS = 260;

const getMapboxErrorMessage = (value: unknown): string => {
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

const syncMapboxToGoogleCamera = (
  mapboxMap: mapboxgl.Map,
  googleMap: google.maps.Map,
): void => {
  const center = googleMap.getCenter?.();
  const zoom = googleMap.getZoom?.();
  if (!center || !Number.isFinite(zoom)) return;

  mapboxMap.jumpTo({
    center: [center.lng(), center.lat()],
    zoom: Number(zoom),
    bearing: 0,
    pitch: 0,
  });
};

const readGoogleCameraTarget = (
  googleMap: google.maps.Map | null,
): { center: [number, number]; zoom: number } | null => {
  const center = googleMap?.getCenter?.();
  const zoom = googleMap?.getZoom?.();
  if (!center || !Number.isFinite(zoom)) return null;
  return {
    center: [center.lng(), center.lat()],
    zoom: Number(zoom),
  };
};

export const shouldRunMapboxGlobeIntro = (zoom: number | null | undefined): boolean => {
  return Number.isFinite(zoom);
};

export const isMeaningfulMapboxIntroTarget = (
  target: { center: [number, number]; zoom: number } | null | undefined,
): boolean => {
  if (!target || !Number.isFinite(target.zoom)) return false;
  const [lng, lat] = target.center;
  const centerOffset = Math.hypot(lng - MAPBOX_GLOBE_INTRO_CAMERA.center[0], lat - MAPBOX_GLOBE_INTRO_CAMERA.center[1]);
  return target.zoom >= 3.15 || centerOffset >= 12;
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
    element.style.width = '100%';
    element.style.height = '100%';
  });
};

const buildMapboxStyleKey = (mapStyle: MapStyle): string => {
  const descriptor = getMapboxStyleDescriptor(mapStyle);
  return `${descriptor.styleUrl}::${JSON.stringify(buildMapboxStyleConfig(mapStyle) ?? {})}`;
};

export const MapboxBasemapSync: React.FC<MapboxBasemapSyncProps> = ({
  accessToken,
  googleMap,
  mapStyle,
  interactive = false,
  onLoadError,
  onMapReadyChange,
  onModuleReadyChange,
  onSurfaceReadyChange,
  onStyleReload,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapboxMapRef = useRef<mapboxgl.Map | null>(null);
  const mapStyleRef = useRef<MapStyle>(mapStyle);
  const syncFrameRef = useRef<number | null>(null);
  const mapboxToGoogleFrameRef = useRef<number | null>(null);
  const lastViewportSizeRef = useRef<{ width: number; height: number } | null>(null);
  const syncSourceRef = useRef<'google' | 'mapbox' | null>(null);
  const hasPlayedIntroRef = useRef(false);
  const introActiveRef = useRef(false);
  const gestureActiveRef = useRef(false);
  const appliedStyleKeyRef = useRef<string | null>(null);
  const ignoreGoogleSyncUntilRef = useRef(0);
  const lastMapboxDrivenCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  mapStyleRef.current = mapStyle;

  useEffect(() => {
    if (!containerRef.current || !googleMap || !accessToken.trim()) return;
    if (mapboxMapRef.current) return;

    let cancelled = false;
    let hasReportedFatalError = false;
    let hasReportedSurfaceReady = false;
    let listeners: Array<google.maps.MapsEventListener | undefined> = [];
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeoutId: number | null = null;
    let settleResizeTimeoutId: number | null = null;
    let introTimeoutId: number | null = null;
    let hasCompletedInitialLoad = false;

    const flushViewportSize = () => {
      const container = containerRef.current;
      const mapboxMap = mapboxMapRef.current;
      if (!container || !mapboxMap) return;

      const nextWidth = Math.round(container.getBoundingClientRect().width);
      const nextHeight = Math.round(container.getBoundingClientRect().height);
      if (nextWidth <= 0 || nextHeight <= 0) return;

      const lastViewportSize = lastViewportSizeRef.current;
      if (lastViewportSize?.width === nextWidth && lastViewportSize.height === nextHeight) return;

      stretchMapboxViewport(mapboxMap);
      mapboxMap.resize();
      lastViewportSizeRef.current = { width: nextWidth, height: nextHeight };
    };

    const scheduleViewportResize = (immediate = false) => {
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
        resizeTimeoutId = null;
      }
      if (settleResizeTimeoutId !== null) {
        window.clearTimeout(settleResizeTimeoutId);
        settleResizeTimeoutId = null;
      }

      if (immediate) {
        window.requestAnimationFrame(() => {
          flushViewportSize();
        });
        settleResizeTimeoutId = window.setTimeout(() => {
          settleResizeTimeoutId = null;
          window.requestAnimationFrame(() => {
            flushViewportSize();
          });
        }, 180);
        return;
      }

      resizeTimeoutId = window.setTimeout(() => {
        resizeTimeoutId = null;
        window.requestAnimationFrame(() => {
          flushViewportSize();
        });
        settleResizeTimeoutId = window.setTimeout(() => {
          settleResizeTimeoutId = null;
          window.requestAnimationFrame(() => {
            flushViewportSize();
          });
        }, 180);
      }, 72);
    };

    const reportSurfaceReady = (isReady: boolean) => {
      if (isReady) {
        if (hasReportedSurfaceReady) return;
        hasReportedSurfaceReady = true;
        onSurfaceReadyChange?.(true);
        return;
      }
      if (!hasReportedSurfaceReady) return;
      hasReportedSurfaceReady = false;
      onSurfaceReadyChange?.(false);
    };

    const runGlobeIntro = () => {
      const mapboxMap = mapboxMapRef.current;
      const target = readGoogleCameraTarget(googleMap);
      if (
        !mapboxMap
        || !target
        || !shouldRunMapboxGlobeIntro(target.zoom)
        || !isMeaningfulMapboxIntroTarget(target)
      ) {
        return false;
      }
      if (typeof mapboxMap.isStyleLoaded === 'function' && !mapboxMap.isStyleLoaded()) return false;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;

      hasPlayedIntroRef.current = true;
      introActiveRef.current = true;
      syncSourceRef.current = 'google';

      if (typeof mapboxMap.setProjection === 'function') {
        mapboxMap.setProjection('globe');
      }
      if (typeof mapboxMap.setFog === 'function') {
        mapboxMap.setFog({});
      }

      introTimeoutId = window.setTimeout(() => {
        introTimeoutId = null;
        mapboxMap.flyTo({
          center: target.center,
          zoom: Math.max(target.zoom, 2.8),
          bearing: 0,
          pitch: 0,
          duration: 1350,
          essential: true,
          curve: 1.25,
          speed: 1.15,
        });

        window.setTimeout(() => {
          introActiveRef.current = false;
          if (syncSourceRef.current === 'google') {
            syncSourceRef.current = null;
          }
          syncMapboxToGoogleCamera(mapboxMap, googleMap);
        }, 1410);
      }, 40);

      return true;
    };

    const syncNow = () => {
      syncFrameRef.current = null;
      const mapboxMap = mapboxMapRef.current;
      if (!mapboxMap || !googleMap) return;
      if (syncSourceRef.current === 'mapbox' || introActiveRef.current || gestureActiveRef.current) return;
      if (typeof mapboxMap.isMoving === 'function' && mapboxMap.isMoving()) return;
      if (Date.now() < ignoreGoogleSyncUntilRef.current) return;
      const googleCameraTarget = readGoogleCameraTarget(googleMap);
      if (areMapboxCameraTargetsNearlyEqual(googleCameraTarget, lastMapboxDrivenCameraRef.current)) {
        return;
      }
      if (!hasPlayedIntroRef.current) {
        if (runGlobeIntro()) {
          return;
        }
        if (!isMeaningfulMapboxIntroTarget(googleCameraTarget)) {
          return;
        }
      }

      syncSourceRef.current = 'google';
      syncMapboxToGoogleCamera(mapboxMap, googleMap);
      window.requestAnimationFrame(() => {
        if (syncSourceRef.current === 'google') {
          syncSourceRef.current = null;
        }
      });
    };

    const scheduleSync = () => {
      if (syncFrameRef.current !== null) return;
      syncFrameRef.current = window.requestAnimationFrame(syncNow);
    };

    const reportFatalError = (error: unknown) => {
      if (hasReportedFatalError || !isMapboxBasemapFatalError(error)) return;
      hasReportedFatalError = true;
      const normalizedError = error && typeof error === 'object' && 'error' in error
        ? (error as { error?: unknown }).error
        : error;
      onLoadError?.({
        message: getMapboxErrorMessage(normalizedError),
        status: getMapboxBasemapErrorStatus(normalizedError),
      });
    };

    const syncMapboxToGoogle = () => {
      mapboxToGoogleFrameRef.current = null;
      if (syncSourceRef.current === 'google' || introActiveRef.current) return;
      const mapboxMap = mapboxMapRef.current;
      if (!mapboxMap || !googleMap) return;

      const center = mapboxMap.getCenter();
      const zoom = mapboxMap.getZoom();
      if (!center || !Number.isFinite(zoom)) return;
      lastMapboxDrivenCameraRef.current = {
        center: [center.lng, center.lat],
        zoom: Number(zoom),
      };
      ignoreGoogleSyncUntilRef.current = Date.now() + MAPBOX_SYNC_COOLDOWN_MS;

      syncSourceRef.current = 'mapbox';
      if (typeof googleMap.moveCamera === 'function') {
        googleMap.moveCamera({
          center: { lat: center.lat, lng: center.lng },
          zoom: Number(zoom),
        });
      } else {
        googleMap.setCenter({ lat: center.lat, lng: center.lng });
        googleMap.setZoom(Number(zoom));
      }
      window.requestAnimationFrame(() => {
        if (syncSourceRef.current === 'mapbox') {
          syncSourceRef.current = null;
        }
      });
    };

    const scheduleMapboxToGoogleSync = () => {
      if (mapboxToGoogleFrameRef.current !== null) return;
      mapboxToGoogleFrameRef.current = window.requestAnimationFrame(syncMapboxToGoogle);
    };

    const beginGestureSync = () => {
      if (syncSourceRef.current === 'google' || introActiveRef.current) return;
      gestureActiveRef.current = true;
    };

    const endGestureSync = () => {
      gestureActiveRef.current = false;
      scheduleMapboxToGoogleSync();
    };

    void import('mapbox-gl')
      .then((module) => {
        if (cancelled || !containerRef.current) return;

        const mapboxModule = module.default;
        mapboxModule.accessToken = accessToken;
        onModuleReadyChange?.(mapboxModule);

        const initialStyle = mapStyleRef.current;
        const descriptor = getMapboxStyleDescriptor(initialStyle);
        const styleConfig = buildMapboxStyleConfig(initialStyle);
        appliedStyleKeyRef.current = buildMapboxStyleKey(initialStyle);
        const mapboxMap = new mapboxModule.Map({
          container: containerRef.current,
          style: descriptor.styleUrl,
          config: styleConfig,
          center: MAPBOX_GLOBE_INTRO_CAMERA.center,
          zoom: MAPBOX_GLOBE_INTRO_CAMERA.zoom,
          bearing: MAPBOX_GLOBE_INTRO_CAMERA.bearing,
          pitch: MAPBOX_GLOBE_INTRO_CAMERA.pitch,
          projection: 'globe',
          interactive,
          attributionControl: true,
          logoPosition: 'bottom-left',
          fadeDuration: 0,
          minTileCacheSize: MAPBOX_MIN_TILE_CACHE_SIZE,
          maxTileCacheSize: MAPBOX_MAX_TILE_CACHE_SIZE,
          preserveDrawingBuffer: false,
        });

        mapboxMapRef.current = mapboxMap;
        onMapReadyChange?.(mapboxMap);
        stretchMapboxViewport(mapboxMap);
        lastViewportSizeRef.current = null;

        mapboxMap.on('load', () => {
          if (cancelled || mapboxMapRef.current !== mapboxMap) return;
          hasCompletedInitialLoad = true;
          if (typeof mapboxMap.setProjection === 'function') {
            mapboxMap.setProjection('globe');
          }
          if (typeof mapboxMap.setFog === 'function') {
            mapboxMap.setFog({});
          }
          applyMapboxTripLabelVisibilityPolish(mapboxMap);
          scheduleViewportResize(true);
          reportSurfaceReady(true);
          scheduleSync();
        });
        mapboxMap.on('style.load', () => {
          if (cancelled || mapboxMapRef.current !== mapboxMap) return;
          if (typeof mapboxMap.setProjection === 'function') {
            mapboxMap.setProjection('globe');
          }
          if (typeof mapboxMap.setFog === 'function') {
            mapboxMap.setFog({});
          }
          applyMapboxTripLabelVisibilityPolish(mapboxMap);
          scheduleViewportResize(true);
          if (hasCompletedInitialLoad) {
            onStyleReload?.();
          }
        });
        mapboxMap.on('error', (error) => {
          if (cancelled || mapboxMapRef.current !== mapboxMap) return;
          reportFatalError(error);
        });

        if (interactive) {
          mapboxMap.on('movestart', beginGestureSync);
          mapboxMap.on('zoomstart', beginGestureSync);
          mapboxMap.on('rotatestart', beginGestureSync);
          mapboxMap.on('pitchstart', beginGestureSync);
          mapboxMap.on('moveend', endGestureSync);
          mapboxMap.on('zoomend', endGestureSync);
          mapboxMap.on('rotateend', endGestureSync);
          mapboxMap.on('pitchend', endGestureSync);
        }

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            scheduleViewportResize(false);
          });
          resizeObserver.observe(containerRef.current);
        }

        scheduleViewportResize(true);
        scheduleSync();

        listeners = [
          googleMap.addListener?.('idle', scheduleSync),
          googleMap.addListener?.('zoom_changed', scheduleSync),
        ];
      })
      .catch((error) => {
        onModuleReadyChange?.(null);
        console.warn('Failed to load Mapbox basemap runtime', error);
      });

    return () => {
      cancelled = true;
      listeners.forEach((listener) => listener?.remove?.());
      resizeObserver?.disconnect();
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }
      if (settleResizeTimeoutId !== null) {
        window.clearTimeout(settleResizeTimeoutId);
      }
      if (introTimeoutId !== null) {
        window.clearTimeout(introTimeoutId);
      }
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
        syncFrameRef.current = null;
      }
      if (mapboxToGoogleFrameRef.current !== null) {
        window.cancelAnimationFrame(mapboxToGoogleFrameRef.current);
        mapboxToGoogleFrameRef.current = null;
      }
      reportSurfaceReady(false);
      onMapReadyChange?.(null);
      onModuleReadyChange?.(null);
      mapboxMapRef.current?.remove();
      lastViewportSizeRef.current = null;
      mapboxMapRef.current = null;
      introActiveRef.current = false;
      gestureActiveRef.current = false;
      appliedStyleKeyRef.current = null;
      ignoreGoogleSyncUntilRef.current = 0;
      lastMapboxDrivenCameraRef.current = null;
    };
  }, [accessToken, googleMap, interactive, onLoadError, onMapReadyChange, onModuleReadyChange, onSurfaceReadyChange, onStyleReload]);

  useEffect(() => {
    const mapboxMap = mapboxMapRef.current;
    if (!mapboxMap) return;

    const descriptor = getMapboxStyleDescriptor(mapStyle);
    const config = buildMapboxStyleConfig(mapStyle);
    const styleKey = buildMapboxStyleKey(mapStyle);
    if (appliedStyleKeyRef.current === styleKey) return;

    appliedStyleKeyRef.current = styleKey;
    try {
      mapboxMap.setStyle(descriptor.styleUrl, config ? { config } : undefined);
    } catch (error) {
      console.warn('Failed to switch Mapbox basemap style', error);
    }
  }, [mapStyle]);

  return (
    <div
      ref={containerRef}
      className={interactive
        ? 'absolute inset-0 z-0 h-full w-full overflow-hidden'
        : 'pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden'}
      aria-hidden="true"
    />
  );
};
