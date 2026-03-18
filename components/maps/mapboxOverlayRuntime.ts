import type mapboxgl from 'mapbox-gl';

export type MapCoordinates = {
  lat: number;
  lng: number;
};

export type RuntimeMarkerUpdate = {
  position?: MapCoordinates;
  html?: string;
  zIndex?: number;
};

export type RuntimeMarkerHandle = {
  setMap: (map: unknown | null) => void;
  update: (updates: RuntimeMarkerUpdate) => void;
};

export type RuntimeRemovableHandle = {
  setMap: (map: unknown | null) => void;
};

export type MapboxLineLayerConfig = {
  id: string;
  color: string;
  opacity: number;
  width: number;
  dasharray?: number[];
  emissiveStrength?: number;
};

type MapboxOverlayMarkerOptions = {
  map: mapboxgl.Map;
  mapboxModule: typeof import('mapbox-gl').default;
  position: MapCoordinates;
  html: string;
  zIndex: number;
  clickable?: boolean;
  centerAnchor?: boolean;
  onClick?: () => void;
  markerDomId?: string;
};

type MapboxLineHandleOptions = {
  map: mapboxgl.Map;
  sourceId: string;
  path: MapCoordinates[];
  layers: MapboxLineLayerConfig[];
};

const clearMapboxLayer = (map: mapboxgl.Map, layerId: string): void => {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
};

const clearMapboxSource = (map: mapboxgl.Map, sourceId: string): void => {
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
};

const toLngLat = (position: MapCoordinates): [number, number] => [position.lng, position.lat];

export const createMapboxOverlayMarker = ({
  map,
  mapboxModule,
  position,
  html,
  zIndex,
  clickable = false,
  centerAnchor = false,
  onClick,
  markerDomId,
}: MapboxOverlayMarkerOptions): RuntimeMarkerHandle => {
  const element = document.createElement('div');
  element.style.pointerEvents = clickable ? 'auto' : 'none';
  element.style.cursor = clickable ? 'pointer' : 'default';
  element.style.lineHeight = '1';
  element.style.userSelect = 'none';
  element.style.zIndex = `${zIndex}`;
  element.innerHTML = html;
  if (markerDomId) {
    element.dataset.tfMarkerId = markerDomId;
  }
  let tooltipNode = element.querySelector<HTMLElement>('[data-role="activity-marker-tooltip"]');

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    onClick?.();
  };
  const showTooltip = () => {
    if (!tooltipNode) return;
    tooltipNode.style.opacity = '1';
    tooltipNode.style.transform = 'translate(-50%, calc(-100% - 14px))';
  };
  const hideTooltip = () => {
    if (!tooltipNode) return;
    tooltipNode.style.opacity = '0';
    tooltipNode.style.transform = 'translate(-50%, calc(-100% - 8px))';
  };
  if (clickable) {
    element.addEventListener('click', handleClick);
  }
  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('mouseleave', hideTooltip);

  const marker = new mapboxModule.Marker({
    element,
    anchor: centerAnchor ? 'center' : 'bottom',
  })
    .setLngLat(toLngLat(position))
    .addTo(map);

  let isAttached = true;

  return {
    setMap(nextMap) {
      if (nextMap) {
        if (!isAttached) {
          marker.addTo(map);
          isAttached = true;
        }
        return;
      }
      if (isAttached) {
        marker.remove();
        isAttached = false;
      }
    },
    update(updates) {
      if (updates.position) {
        marker.setLngLat(toLngLat(updates.position));
      }
      if (updates.zIndex !== undefined) {
        element.style.zIndex = `${updates.zIndex}`;
      }
      if (updates.html !== undefined) {
        element.innerHTML = updates.html;
        if (markerDomId) {
          element.dataset.tfMarkerId = markerDomId;
        }
        tooltipNode = element.querySelector<HTMLElement>('[data-role="activity-marker-tooltip"]');
      }
    },
  };
};

export const createMapboxLineHandle = ({
  map,
  sourceId,
  path,
  layers,
}: MapboxLineHandleOptions): RuntimeRemovableHandle => {
  const layerIds = layers.map((layer) => layer.id);
  const feature = {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: path.map((point) => [point.lng, point.lat]),
    },
    properties: {},
  };

  map.addSource(sourceId, {
    type: 'geojson',
    data: feature,
  });

  layers.forEach((layer) => {
    map.addLayer({
      id: layer.id,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': layer.color,
        'line-opacity': layer.opacity,
        'line-width': layer.width,
        ...(typeof layer.emissiveStrength === 'number' ? { 'line-emissive-strength': layer.emissiveStrength } : {}),
        ...(layer.dasharray ? { 'line-dasharray': layer.dasharray } : {}),
      },
    });
  });

  let isAttached = true;

  return {
    setMap(nextMap) {
      if (nextMap) {
        return;
      }
      if (!isAttached) {
        return;
      }
      layerIds.forEach((layerId) => clearMapboxLayer(map, layerId));
      clearMapboxSource(map, sourceId);
      isAttached = false;
    },
  };
};

export const buildMapboxDashedRouteDasharray = (icons?: Array<{ repeat?: string }>): number[] | undefined => {
  const hasRepeatedDash = icons?.some((icon) => typeof icon.repeat === 'string' && icon.repeat.length > 0);
  return hasRepeatedDash ? [0.6, 1.9] : undefined;
};
