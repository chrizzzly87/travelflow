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

// Both adapters share this rule: nothing to frame is a no-op, a single point
// has no extent to fit so it becomes a pan at the provider's city zoom.
const fitPointsOrPan = (
  camera: TripMapCamera,
  provider: 'google' | 'mapbox',
  points: TripMapPoint[],
  fit: () => void,
  options?: { animate?: boolean },
) => {
  if (points.length === 0) return;
  if (points.length === 1) {
    camera.panTo(points[0], {
      zoom: getTripMapProviderTuning(provider).selection.cityFocusZoom,
      animate: options?.animate,
    });
    return;
  }
  fit();
};

// Only touch `google` inside methods: this module is imported on the Mapbox
// path, where no Google script is loaded.
export const createGoogleTripMapCamera = (map: google.maps.Map): TripMapCamera => {
  const camera: TripMapCamera = {
    fitBounds(points, padding, options) {
      fitPointsOrPan(camera, 'google', points, () => {
        const bounds = new window.google.maps.LatLngBounds();
        points.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, padding);
      }, options);
    },
    panTo(point, options) {
      map.panTo(point);
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
  return camera;
};

export const createMapboxTripMapCamera = (map: mapboxgl.Map): TripMapCamera => {
  const camera: TripMapCamera = {
    fitBounds(points, padding, options) {
      fitPointsOrPan(camera, 'mapbox', points, () => {
        let west = Infinity;
        let south = Infinity;
        let east = -Infinity;
        let north = -Infinity;
        points.forEach(({ lat, lng }) => {
          west = Math.min(west, lng);
          east = Math.max(east, lng);
          south = Math.min(south, lat);
          north = Math.max(north, lat);
        });
        map.fitBounds([[west, south], [east, north]], {
          padding,
          maxZoom: options?.maxZoom,
          animate: options?.animate,
        });
      }, options);
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
