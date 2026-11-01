import type mapboxgl from 'mapbox-gl';
import { getTripMapProviderTuning } from './tripMapProviderTuning';

export interface TripMapPoint {
  lat: number;
  lng: number;
}

export type TripMapCameraPadding = number | { top: number; right: number; bottom: number; left: number };

export interface TripMapCamera {
  fitBounds(points: TripMapPoint[], padding: TripMapCameraPadding, options?: { maxZoom?: number; animate?: boolean }): void;
  panTo(point: TripMapPoint, options?: { zoom?: number; animate?: boolean }): void;
  getZoom(): number | null;
  setZoom(zoom: number): void;
  containsPoint(point: TripMapPoint): boolean;
  onIdle(listener: () => void): () => void;
  onZoom(listener: (zoom: number) => void): () => void;
  resize(): void;
}

// Smallest longitude arc covering every point. A trip across the antimeridian
// (Fiji 178 to Samoa -172) is a 10 degree arc, not a 350 degree box: drop the
// largest gap between sorted longitudes and, when the arc wraps, express east
// as lng + 360.
const resolveLongitudeArc = (lngs: number[]): { west: number; east: number } => {
  const sorted = [...lngs].sort((a, b) => a - b);
  let largestGap = sorted[0] + 360 - sorted[sorted.length - 1];
  let startIndex = 0;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const gap = sorted[i + 1] - sorted[i];
    if (gap > largestGap) {
      largestGap = gap;
      startIndex = i + 1;
    }
  }
  if (startIndex === 0) return { west: sorted[0], east: sorted[sorted.length - 1] };
  return { west: sorted[startIndex], east: sorted[startIndex - 1] + 360 };
};

// Only touch `google` inside methods: this module is imported on the Mapbox
// path, where no Google script is loaded.
export const createGoogleTripMapCamera = (map: google.maps.Map): TripMapCamera => {
  return {
    // Google `fitBounds` has no maxZoom/animate option, so both are ignored here.
    fitBounds(points, padding) {
      if (points.length === 0) return;
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, padding);
    },
    panTo(point, options) {
      if (options?.animate === false) map.setCenter(point);
      else map.panTo(point);
      if (options?.zoom !== undefined) map.setZoom(options.zoom);
    },
    getZoom: () => map.getZoom() ?? null,
    setZoom: (zoom) => map.setZoom(zoom),
    containsPoint: (point) => map.getBounds()?.contains(point) ?? false,
    onIdle(listener) {
      const handle = map.addListener('idle', listener);
      return () => handle.remove();
    },
    onZoom(listener) {
      const handle = map.addListener('zoom_changed', () => {
        const zoom = map.getZoom();
        if (typeof zoom === 'number') listener(zoom);
      });
      return () => handle.remove();
    },
    resize() {
      window.google?.maps?.event?.trigger(map, 'resize');
    },
  };
};

export const createMapboxTripMapCamera = (map: mapboxgl.Map): TripMapCamera => {
  const camera: TripMapCamera = {
    fitBounds(points, padding, options) {
      if (points.length === 0) return;
      if (points.length === 1) {
        camera.panTo(points[0], {
          zoom: getTripMapProviderTuning('mapbox').selection.cityFocusZoom,
          animate: options?.animate,
        });
        return;
      }
      const { west, east } = resolveLongitudeArc(points.map((point) => point.lng));
      const lats = points.map((point) => point.lat);
      map.fitBounds([[west, Math.min(...lats)], [east, Math.max(...lats)]], {
        padding,
        maxZoom: options?.maxZoom,
        animate: options?.animate,
      });
    },
    panTo(point, options) {
      const target = {
        center: [point.lng, point.lat] as [number, number],
        ...(options?.zoom !== undefined ? { zoom: options.zoom } : {}),
      };
      if (options?.animate === false) map.jumpTo(target);
      else map.easeTo(target);
    },
    getZoom: () => map.getZoom() ?? null,
    setZoom: (zoom) => {
      map.setZoom(zoom);
    },
    containsPoint: (point) => map.getBounds()?.contains([point.lng, point.lat]) ?? false,
    onIdle(listener) {
      map.on('idle', listener);
      return () => {
        map.off('idle', listener);
      };
    },
    onZoom(listener) {
      const handler = () => listener(map.getZoom());
      map.on('zoom', handler);
      return () => {
        map.off('zoom', handler);
      };
    },
    resize() {
      map.resize();
    },
  };
  return camera;
};
