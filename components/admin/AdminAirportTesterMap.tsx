import 'mapbox-gl/dist/mapbox-gl.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import type mapboxgl from 'mapbox-gl';
import { X } from 'lucide-react';
import type { NearbyAirportsResponse } from '../../shared/airportReference';
import { buildMapboxStyleConfig, getMapboxStyleDescriptor } from '../../services/mapRendererVisualStyleService';
import { createMapboxLineHandle, createMapboxOverlayMarker, type RuntimeMarkerHandle, type RuntimeRemovableHandle } from '../maps/mapboxOverlayRuntime';
import { useGoogleMaps, useMapRuntime } from '../GoogleMapsLoader';
import {
  buildAirportTesterDetailRows,
  buildAirportTesterDetailTitle,
  buildAirportTesterPillHtml,
  buildAirportTesterPoints,
  resolveAirportTesterRenderer,
  type AirportTesterMapPoint,
  type AirportTesterOrigin,
} from './airportTesterMapModel';

const ADMIN_AIRPORT_MAP_ID = 'admin-airports-map';
const ADMIN_AIRPORT_MAP_STYLE = 'clean' as const;
const ADMIN_AIRPORT_MAP_MAX_ZOOM = 7;
const ADMIN_AIRPORT_MAP_FIT_PADDING = 56;
const ROUTE_LINE_COLOR = '#2563eb';

interface AdminAirportTesterMapProps {
  origin: AirportTesterOrigin | null;
  result: NearbyAirportsResponse | null;
}

const GoogleMapInstanceBridge: React.FC<{
  mapId: string;
  onMapInstanceChange: (map: google.maps.Map | null) => void;
}> = ({ mapId, onMapInstanceChange }) => {
  const map = useMap(mapId);

  useEffect(() => {
    onMapInstanceChange(map ?? null);
    return () => {
      onMapInstanceChange(null);
    };
  }, [map, onMapInstanceChange]);

  return null;
};

const GoogleTesterMapLayer: React.FC<{
  points: AirportTesterMapPoint[];
  selectedPointId: string | null;
  onSelectPoint: (pointId: string) => void;
}> = ({ points, selectedPointId, onSelectPoint }) => {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const originPoint = points.find((point) => point.kind === 'origin') ?? null;

  useEffect(() => {
    if (!mapInstance || !window.google?.maps?.OverlayView) return undefined;

    const overlays: google.maps.OverlayView[] = [];
    const lines: google.maps.Polyline[] = [];

    if (points.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
      mapInstance.fitBounds(bounds, ADMIN_AIRPORT_MAP_FIT_PADDING);
      window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
        const nextZoom = mapInstance.getZoom();
        if (typeof nextZoom === 'number' && nextZoom > ADMIN_AIRPORT_MAP_MAX_ZOOM) {
          mapInstance.setZoom(ADMIN_AIRPORT_MAP_MAX_ZOOM);
        }
      });
    }

    if (originPoint) {
      points
        .filter((point) => point.kind === 'airport')
        .forEach((point) => {
          lines.push(new window.google.maps.Polyline({
            path: [
              { lat: originPoint.lat, lng: originPoint.lng },
              { lat: point.lat, lng: point.lng },
            ],
            geodesic: true,
            strokeColor: ROUTE_LINE_COLOR,
            strokeOpacity: 0.35,
            strokeWeight: 2,
            map: mapInstance,
          }));
        });
    }

    points.forEach((point) => {
      const overlay = new window.google.maps.OverlayView();
      let markerNode: HTMLDivElement | null = null;

      const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
        onSelectPoint(point.id);
      };

      overlay.onAdd = function onAdd() {
        markerNode = document.createElement('div');
        markerNode.style.position = 'absolute';
        markerNode.style.transform = 'translate(-50%, -100%)';
        markerNode.style.cursor = 'pointer';
        markerNode.style.pointerEvents = 'auto';
        markerNode.style.zIndex = point.kind === 'origin' ? '30' : '20';
        markerNode.innerHTML = buildAirportTesterPillHtml({
          point,
          selected: point.id === selectedPointId,
        });
        markerNode.setAttribute('role', 'button');
        markerNode.setAttribute('tabindex', '0');
        markerNode.setAttribute('aria-label', `${buildAirportTesterDetailTitle(point)} — open details`);
        markerNode.addEventListener('click', handleClick);
        markerNode.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onSelectPoint(point.id);
        });

        overlay.getPanes()?.floatPane?.appendChild(markerNode);
      };

      overlay.draw = function draw() {
        if (!markerNode) return;
        const projection = overlay.getProjection();
        const position = projection?.fromLatLngToDivPixel(new window.google.maps.LatLng(point.lat, point.lng));
        if (!position) return;
        markerNode.style.left = `${position.x}px`;
        markerNode.style.top = `${position.y}px`;
      };

      overlay.onRemove = function onRemove() {
        markerNode?.removeEventListener('click', handleClick);
        markerNode?.remove();
        markerNode = null;
      };

      overlay.setMap(mapInstance);
      overlays.push(overlay);
    });

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null));
      lines.forEach((line) => line.setMap(null));
    };
  }, [mapInstance, onSelectPoint, originPoint, points, selectedPointId]);

  return (
    <GoogleMap
      id={ADMIN_AIRPORT_MAP_ID}
      defaultCenter={originPoint ? { lat: originPoint.lat, lng: originPoint.lng } : { lat: 20, lng: 0 }}
      defaultZoom={originPoint ? 5 : 2}
      disableDefaultUI
      gestureHandling="cooperative"
      clickableIcons={false}
      reuseMaps
      className="size-full"
    >
      <GoogleMapInstanceBridge mapId={ADMIN_AIRPORT_MAP_ID} onMapInstanceChange={setMapInstance} />
    </GoogleMap>
  );
};

const MapboxTesterMapLayer: React.FC<{
  accessToken: string;
  points: AirportTesterMapPoint[];
  selectedPointId: string | null;
  onSelectPoint: (pointId: string) => void;
  onLoadErrorChange: (message: string | null) => void;
  onReadyChange: (ready: boolean) => void;
}> = ({ accessToken, points, selectedPointId, onSelectPoint, onLoadErrorChange, onReadyChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const moduleRef = useRef<typeof import('mapbox-gl').default | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    void import('mapbox-gl')
      .then((module) => {
        if (cancelled || !containerRef.current) return;
        const mapboxModule = module.default;
        mapboxModule.accessToken = accessToken;
        moduleRef.current = mapboxModule;

        const descriptor = getMapboxStyleDescriptor(ADMIN_AIRPORT_MAP_STYLE);
        const map = new mapboxModule.Map({
          container: containerRef.current,
          style: descriptor.styleUrl,
          config: buildMapboxStyleConfig(ADMIN_AIRPORT_MAP_STYLE),
          center: [0, 20],
          zoom: 1,
          attributionControl: true,
          logoPosition: 'bottom-left',
          projection: 'mercator',
        });
        mapRef.current = map;
        setMapReady(true);
        onReadyChange(true);
        onLoadErrorChange(null);

        // Markers work the moment the map exists; only the route layers need a
        // parsed style, and `load` never fires while the tab sits hidden.
        const syncStyleReady = () => {
          if (cancelled || !map.isStyleLoaded()) return;
          setStyleReady(true);
        };
        map.on('styledata', syncStyleReady);
        syncStyleReady();
        map.on('error', (event) => {
          if (cancelled) return;
          onLoadErrorChange(event?.error?.message || 'Mapbox could not load the tester basemap.');
        });
      })
      .catch(() => {
        if (cancelled) return;
        onLoadErrorChange('Mapbox could not be loaded for this admin tester.');
      });

    return () => {
      cancelled = true;
      setMapReady(false);
      setStyleReady(false);
      onReadyChange(false);
      mapRef.current?.remove();
      mapRef.current = null;
      moduleRef.current = null;
    };
  }, [accessToken, onLoadErrorChange, onReadyChange]);

  useEffect(() => {
    const map = mapRef.current;
    const mapboxModule = moduleRef.current;
    if (!map || !mapboxModule || !mapReady) return undefined;

    const markers: RuntimeMarkerHandle[] = [];

    if (points.length > 0) {
      const bounds = new mapboxModule.LngLatBounds();
      points.forEach((point) => bounds.extend([point.lng, point.lat]));
      map.fitBounds(bounds, {
        padding: ADMIN_AIRPORT_MAP_FIT_PADDING,
        maxZoom: ADMIN_AIRPORT_MAP_MAX_ZOOM,
        animate: false,
      });
    }

    points.forEach((point) => {
      markers.push(createMapboxOverlayMarker({
        map,
        mapboxModule,
        position: { lat: point.lat, lng: point.lng },
        html: buildAirportTesterPillHtml({ point, selected: point.id === selectedPointId }),
        zIndex: point.kind === 'origin' ? 30 : 20,
        clickable: true,
        onClick: () => onSelectPoint(point.id),
      }));
    });

    return () => {
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [mapReady, onSelectPoint, points, selectedPointId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return undefined;

    const originPoint = points.find((point) => point.kind === 'origin') ?? null;
    if (!originPoint) return undefined;

    const lines: RuntimeRemovableHandle[] = points
      .filter((point) => point.kind === 'airport')
      .map((point, index) => createMapboxLineHandle({
        map,
        sourceId: `admin-airport-tester-route-${index}`,
        path: [
          { lat: originPoint.lat, lng: originPoint.lng },
          { lat: point.lat, lng: point.lng },
        ],
        layers: [{
          id: `admin-airport-tester-route-${index}-line`,
          color: ROUTE_LINE_COLOR,
          opacity: 0.35,
          width: 2,
        }],
      }));

    return () => {
      lines.forEach((line) => line.setMap(null));
    };
  }, [points, styleReady]);

  return <div ref={containerRef} className="size-full" data-testid="admin-airport-tester-mapbox" />;
};

const AirportTesterDetailCard: React.FC<{
  point: AirportTesterMapPoint;
  onClose: () => void;
}> = ({ point, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const rows = buildAirportTesterDetailRows(point);

  // Non-modal panel: focus moves in so the card is reachable straight from the
  // pill, and goes back to the pill that opened it once the card closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [point.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={`${buildAirportTesterDetailTitle(point)} details`}
      className="absolute inset-x-3 bottom-3 z-20 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/97 p-3 shadow-xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{buildAirportTesterDetailTitle(point)}</div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close airport details"
          className="rounded-full border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X size={14} />
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1 last:border-b-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{row.label}</dt>
            <dd className="text-xs font-medium text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export const AdminAirportTesterMap: React.FC<AdminAirportTesterMapProps> = ({ origin, result }) => {
  const { runtime, mapboxAccessToken } = useMapRuntime();
  const { isLoaded: googleIsLoaded, loadError: googleLoadError } = useGoogleMaps();
  const [mapboxLoadError, setMapboxLoadError] = useState<string | null>(null);
  const [mapboxReady, setMapboxReady] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const renderer = useMemo(
    () => resolveAirportTesterRenderer({ runtime, mapboxAccessToken }),
    [mapboxAccessToken, runtime],
  );
  const points = useMemo(() => buildAirportTesterPoints({ origin, result }), [origin, result]);
  const selectedPoint = points.find((point) => point.id === selectedPointId) ?? null;

  const handleSelectPoint = useCallback((pointId: string) => {
    setSelectedPointId((current) => (current === pointId ? null : pointId));
  }, []);
  const handleCloseDetails = useCallback(() => setSelectedPointId(null), []);

  const loadError = renderer === 'mapbox' ? mapboxLoadError : googleLoadError?.message || null;
  const rendererReady = renderer === 'mapbox' ? mapboxReady : googleIsLoaded;
  const rendererLabel = renderer === 'mapbox' ? 'Mapbox' : 'Google Maps';

  return (
    <div className="relative h-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      {!loadError && renderer === 'mapbox' && (
        <MapboxTesterMapLayer
          accessToken={mapboxAccessToken}
          points={points}
          selectedPointId={selectedPointId}
          onSelectPoint={handleSelectPoint}
          onLoadErrorChange={setMapboxLoadError}
          onReadyChange={setMapboxReady}
        />
      )}
      {!loadError && renderer === 'google' && (
        <GoogleTesterMapLayer
          points={points}
          selectedPointId={selectedPointId}
          onSelectPoint={handleSelectPoint}
        />
      )}

      {!loadError && (!rendererReady || !origin) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 px-6 text-center text-sm text-slate-600">
          {!rendererReady
            ? `Loading ${rendererLabel} for airport testing…`
            : 'Pick a city or use manual coordinates to preview the nearest-airport map.'}
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 px-6 text-center text-sm text-slate-700">
          {rendererLabel} could not be loaded for this admin tester.
        </div>
      )}

      {!loadError && selectedPoint && (
        <AirportTesterDetailCard point={selectedPoint} onClose={handleCloseDetails} />
      )}
    </div>
  );
};

export default AdminAirportTesterMap;
