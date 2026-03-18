import type { MapImplementation } from '../../shared/mapRuntime';
import {
  getTripMapProviderTuning,
  shouldUseTripMapGlobeIntro,
  type TripMapDockMode,
} from './tripMapProviderTuning';

export interface TripMapCameraTarget {
  center: [number, number];
  zoom: number;
}

export interface TripMapCameraIntroPlan {
  startCamera: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
  flyToCamera: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
  delayMs: number;
  durationMs: number;
  settleMs: number;
  curve: number;
  speed: number;
}

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const resolveMapboxIntroBearing = (startCenter: [number, number], targetCenter: [number, number]): number => {
  const longitudeDelta = targetCenter[0] - startCenter[0];
  return clamp(longitudeDelta / 10, -14, 14);
};

export const buildTripMapCameraIntroPlan = ({
  provider,
  mapDockMode,
  mapViewportSize,
  target,
}: {
  provider: MapImplementation;
  mapDockMode: TripMapDockMode;
  mapViewportSize: { width: number; height: number } | null;
  target: TripMapCameraTarget | null;
}): TripMapCameraIntroPlan | null => {
  if (!target || !Number.isFinite(target.zoom)) return null;
  if (!shouldUseTripMapGlobeIntro({ provider, mapDockMode, mapViewportSize })) return null;

  const tuning = getTripMapProviderTuning(provider);
  const startCamera = tuning.intro.camera;
  return {
    startCamera,
    flyToCamera: {
      center: target.center,
      zoom: Math.max(target.zoom, tuning.intro.flyToMinZoom),
      bearing: resolveMapboxIntroBearing(startCamera.center, target.center),
      pitch: 0,
    },
    delayMs: tuning.intro.delayMs,
    durationMs: tuning.intro.durationMs,
    settleMs: tuning.intro.settleMs,
    curve: tuning.intro.curve,
    speed: tuning.intro.speed,
  };
};
