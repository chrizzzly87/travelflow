import type { MapStyle } from '../types';

export interface MapboxStyleConfigProperty {
  fragmentId: string;
  property: string;
  value: boolean | string | number;
}

export interface MapboxStyleDescriptor {
  owner: string;
  styleId: string;
  styleUrl: string;
  configProperties?: MapboxStyleConfigProperty[];
}

export type MapboxStyleConfigMap = Record<string, Record<string, boolean | string | number>>;

interface MapboxStyleLayerLike {
  id?: string;
  type?: string;
  source?: string;
  'source-layer'?: string;
  metadata?: Record<string, unknown>;
  filter?: unknown;
}

type MapboxStyleLayerVisibilityMap = Pick<
  import('mapbox-gl').Map,
  'addLayer' | 'addSource' | 'getLayer' | 'getSource' | 'getStyle' | 'setFilter' | 'setLayoutProperty' | 'setPaintProperty'
>;

const buildMapboxStyleDescriptor = (
  owner: string,
  styleId: string,
  configProperties?: MapboxStyleConfigProperty[],
): MapboxStyleDescriptor => ({
  owner,
  styleId,
  styleUrl: `mapbox://styles/${owner}/${styleId}`,
  configProperties,
});

const MAPBOX_LIGHT_BOUNDARY_COLOR = '#1f2937';
const MAPBOX_CLEAN_LIGHT_BOUNDARY_COLOR = '#64748b';
const MAPBOX_DARK_BOUNDARY_COLOR = '#ffffff';

const buildMapboxStandardVisualConfig = ({
  boundaryColor,
  showPlaceLabels = true,
  showAdminBoundaries = true,
  showRoadsAndTransit,
  showPedestrianRoads,
}: {
  boundaryColor: string;
  showPlaceLabels?: boolean;
  showAdminBoundaries?: boolean;
  showRoadsAndTransit?: boolean;
  showPedestrianRoads?: boolean;
}): MapboxStyleConfigProperty[] => {
  const config: MapboxStyleConfigProperty[] = [
    { fragmentId: 'basemap', property: 'showPlaceLabels', value: showPlaceLabels },
    { fragmentId: 'basemap', property: 'showPointOfInterestLabels', value: false },
    { fragmentId: 'basemap', property: 'showTransitLabels', value: false },
    { fragmentId: 'basemap', property: 'showRoadLabels', value: false },
    { fragmentId: 'basemap', property: 'showAdminBoundaries', value: showAdminBoundaries },
    { fragmentId: 'basemap', property: 'colorAdminBoundaries', value: boundaryColor },
  ];

  if (typeof showRoadsAndTransit === 'boolean') {
    config.push({ fragmentId: 'basemap', property: 'showRoadsAndTransit', value: showRoadsAndTransit });
  }
  if (typeof showPedestrianRoads === 'boolean') {
    config.push({ fragmentId: 'basemap', property: 'showPedestrianRoads', value: showPedestrianRoads });
  }

  return config;
};

const MAPBOX_STANDARD_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_LIGHT_BOUNDARY_COLOR,
  showAdminBoundaries: false,
});

const MAPBOX_DARK_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_DARK_BOUNDARY_COLOR,
  showAdminBoundaries: false,
});

const MAPBOX_CLEAN_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_CLEAN_LIGHT_BOUNDARY_COLOR,
  showPlaceLabels: true,
  showAdminBoundaries: false,
  showRoadsAndTransit: false,
  showPedestrianRoads: false,
});

const MAPBOX_CLEAN_DARK_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_DARK_BOUNDARY_COLOR,
  showPlaceLabels: true,
  showAdminBoundaries: false,
  showRoadsAndTransit: false,
  showPedestrianRoads: false,
});

const MAPBOX_SATELLITE_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_DARK_BOUNDARY_COLOR,
  showAdminBoundaries: false,
  showRoadsAndTransit: false,
  showPedestrianRoads: false,
});

const MAPBOX_TRIP_LABEL_HIDE_PATTERNS = [
  /settlement-subdivision-label/i,
  /settlement-minor-label/i,
  /settlement-village-label/i,
  /settlement-hamlet-label/i,
  /settlement-other-label/i,
  /state-label/i,
  /state-label-lg/i,
  /province-label/i,
  /province_label/i,
  /region-label/i,
  /region_label/i,
  /district-label/i,
  /district_label/i,
  /county-label/i,
  /county_label/i,
  /locality-label/i,
  /locality_label/i,
  /place-label/i,
  /place_label/i,
  /city-label/i,
  /city_label/i,
  /town-label/i,
  /town_label/i,
  /village-label/i,
  /village_label/i,
  /hamlet-label/i,
  /hamlet_label/i,
  /airport-label/i,
  /poi-label/i,
  /transit-label/i,
  /road-label/i,
  /path-pedestrian-label/i,
  /ferry-aerialway-label/i,
  /gate-label/i,
  /building-number-label/i,
  /block-number-label/i,
  /continent-label/i,
];

const MAPBOX_TRIP_LABEL_KEEP_PATTERNS = [
  /country-label/i,
  /settlement-major-label/i,
];

const MAPBOX_TRIP_CLEAN_LABEL_HIDE_PATTERNS = [
  /settlement-major-label/i,
  /place-label/i,
  /place_label/i,
  /city-label/i,
  /city_label/i,
  /town-label/i,
  /town_label/i,
  /settlement/i,
  /locality/i,
];

const MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS = [
  'admin-1-boundary-bg',
  'admin-1-boundary',
] as const;

const MAPBOX_TRIP_HIDDEN_BOUNDARY_PATTERNS = [
  /admin-1-boundary/i,
  /admin_1_boundary/i,
  /admin-2-boundary/i,
  /admin_2_boundary/i,
  /admin-3-boundary/i,
  /admin_3_boundary/i,
  /admin-4-boundary/i,
  /admin_4_boundary/i,
  /state-boundary/i,
  /state_boundary/i,
  /region-boundary/i,
  /region_boundary/i,
  /province-boundary/i,
  /province_boundary/i,
  /district-boundary/i,
  /district_boundary/i,
  /county-boundary/i,
  /county_boundary/i,
  /municipality-boundary/i,
  /municipality_boundary/i,
  /subdivision-boundary/i,
  /subdivision_boundary/i,
  /boundary-admin/i,
  /boundary_admin/i,
];

const MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS = [
  'admin-0-boundary-bg',
  'admin-0-boundary',
  'admin-0-boundary-disputed',
] as const;

const MAPBOX_MAJOR_CITY_FILTER = [
  'any',
  ['<=', ['coalesce', ['get', 'symbolrank'], 999], 5],
  ['>=', ['coalesce', ['get', 'capital'], 0], 1],
] as const;

const MAPBOX_CLEAN_MAJOR_CITY_FILTER = [
  'any',
  ['<=', ['coalesce', ['get', 'symbolrank'], 999], 2],
  ['>=', ['coalesce', ['get', 'capital'], 0], 1],
] as const;

const MAPBOX_COUNTRIES_TILESET_SOURCE_ID = 'tf-country-boundaries-source';
const MAPBOX_COUNTRIES_TILESET_MAIN_LAYER_ID = 'tf-country-boundaries-main';
const MAPBOX_COUNTRIES_TILESET_GLOW_LAYER_ID = 'tf-country-boundaries-glow';
const MAPBOX_COUNTRIES_TILESET_SOURCE_LAYER = 'country_boundaries';
const MAPBOX_COUNTRIES_TILESET_FILTER = [
  'all',
  ['==', ['get', 'disputed'], 'false'],
  [
    'any',
    ['==', 'all', ['get', 'worldview']],
    ['in', 'US', ['get', 'worldview']],
  ],
] as const;

const isMapboxMajorSettlementLayer = (layer: MapboxStyleLayerLike): boolean => (
  /settlement[-_]major[-_]label/i.test(layer.id ?? '')
);

const isDarkMapStyle = (mapStyle: MapStyle): boolean => (
  mapStyle === 'dark' || mapStyle === 'cleanDark'
);

const isCleanMapStyle = (mapStyle: MapStyle): boolean => (
  mapStyle === 'clean' || mapStyle === 'cleanDark'
);

const resolveMapboxCountryBoundaryPaint = (mapStyle: MapStyle): {
  lineColor: string;
  lineOpacity: number;
  glowColor: string;
  glowOpacity: number;
} => {
  if (mapStyle === 'satellite') {
    return {
      lineColor: 'rgba(255, 255, 255, 0.99)',
      lineOpacity: 0.98,
      glowColor: 'rgba(255, 255, 255, 0.72)',
      glowOpacity: 0.34,
    };
  }
  if (mapStyle === 'clean') {
    return {
      lineColor: 'rgba(100, 116, 139, 0.78)',
      lineOpacity: 0.58,
      glowColor: 'rgba(148, 163, 184, 0.28)',
      glowOpacity: 0.1,
    };
  }
  if (isDarkMapStyle(mapStyle)) {
    return {
      lineColor: 'rgba(255, 255, 255, 0.96)',
      lineOpacity: 0.88,
      glowColor: 'rgba(255, 255, 255, 0.5)',
      glowOpacity: 0.18,
    };
  }
  return {
    lineColor: 'rgba(17, 24, 39, 0.88)',
    lineOpacity: 0.72,
    glowColor: 'rgba(15, 23, 42, 0.22)',
    glowOpacity: 0.12,
  };
};

const resolveMapboxCountryBoundaryLineWidth = ({
  mapStyle,
  isGlow,
}: {
  mapStyle: MapStyle;
  isGlow: boolean;
}): any[] => {
  if (mapStyle === 'satellite') {
    return isGlow
      ? ['interpolate', ['linear'], ['zoom'], 1, 0.28, 3, 0.52, 5, 0.95, 8, 1.7]
      : ['interpolate', ['linear'], ['zoom'], 1, 0.16, 3, 0.32, 5, 0.62, 8, 1.15];
  }
  if (mapStyle === 'clean') {
    return isGlow
      ? ['interpolate', ['linear'], ['zoom'], 1, 0.18, 3, 0.34, 5, 0.64, 8, 1.1]
      : ['interpolate', ['linear'], ['zoom'], 1, 0.1, 3, 0.2, 5, 0.4, 8, 0.76];
  }
  if (isDarkMapStyle(mapStyle)) {
    return isGlow
      ? ['interpolate', ['linear'], ['zoom'], 1, 0.22, 3, 0.42, 5, 0.8, 8, 1.36]
      : ['interpolate', ['linear'], ['zoom'], 1, 0.12, 3, 0.24, 5, 0.48, 8, 0.9];
  }
  return isGlow
    ? ['interpolate', ['linear'], ['zoom'], 1, 0.2, 3, 0.38, 5, 0.72, 8, 1.24]
    : ['interpolate', ['linear'], ['zoom'], 1, 0.11, 3, 0.22, 5, 0.44, 8, 0.82];
};

const ensureMapboxCountryBoundarySource = (map: MapboxStyleLayerVisibilityMap): void => {
  if (map.getSource(MAPBOX_COUNTRIES_TILESET_SOURCE_ID)) return;
  map.addSource(MAPBOX_COUNTRIES_TILESET_SOURCE_ID, {
    type: 'vector',
    url: 'mapbox://mapbox.country-boundaries-v1',
  } as any);
};

const resolveMapboxCountryBoundaryLayerInsertBeforeId = (
  layers: MapboxStyleLayerLike[],
): string | undefined => layers.find((layer) => layer.type === 'symbol' && typeof layer.id === 'string')?.id;

const upsertMapboxCountryBoundaryLayer = ({
  map,
  layerId,
  beforeId,
  color,
  opacity,
  lineWidth,
}: {
  map: MapboxStyleLayerVisibilityMap;
  layerId: string;
  beforeId?: string;
  color: string;
  opacity: number;
  lineWidth: number | any[];
}): void => {
  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: 'line',
      source: MAPBOX_COUNTRIES_TILESET_SOURCE_ID,
      'source-layer': MAPBOX_COUNTRIES_TILESET_SOURCE_LAYER,
      filter: MAPBOX_COUNTRIES_TILESET_FILTER as unknown as any[],
      layout: {
        visibility: 'visible',
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': color,
        'line-opacity': opacity,
        'line-width': lineWidth,
      },
    } as any, beforeId);
    return;
  }

  map.setLayoutProperty(layerId, 'visibility', 'visible');
  map.setFilter(layerId, MAPBOX_COUNTRIES_TILESET_FILTER as unknown as any[]);
  map.setPaintProperty(layerId, 'line-color', color);
  map.setPaintProperty(layerId, 'line-opacity', opacity);
  map.setPaintProperty(layerId, 'line-width', lineWidth);
};

const applyMapboxCountryBoundaryOverlay = (
  map: MapboxStyleLayerVisibilityMap,
  mapStyle: MapStyle,
  layers: MapboxStyleLayerLike[],
): void => {
  const boundaryPaint = resolveMapboxCountryBoundaryPaint(mapStyle);
  const beforeId = resolveMapboxCountryBoundaryLayerInsertBeforeId(layers);

  ensureMapboxCountryBoundarySource(map);
  upsertMapboxCountryBoundaryLayer({
    map,
    layerId: MAPBOX_COUNTRIES_TILESET_GLOW_LAYER_ID,
    beforeId,
    color: boundaryPaint.glowColor,
    opacity: boundaryPaint.glowOpacity,
    lineWidth: resolveMapboxCountryBoundaryLineWidth({ mapStyle, isGlow: true }),
  });
  upsertMapboxCountryBoundaryLayer({
    map,
    layerId: MAPBOX_COUNTRIES_TILESET_MAIN_LAYER_ID,
    beforeId,
    color: boundaryPaint.lineColor,
    opacity: boundaryPaint.lineOpacity,
    lineWidth: resolveMapboxCountryBoundaryLineWidth({ mapStyle, isGlow: false }),
  });
};

export const getMapSurfaceBackgroundColor = (mapStyle: MapStyle): string => {
  if (mapStyle === 'satellite') return '#4d6972';
  if (isDarkMapStyle(mapStyle)) return '#0f172a';
  if (mapStyle === 'minimal') return '#edf2f7';
  return '#dbe5ee';
};

export const MAPBOX_STYLE_DESCRIPTORS: Record<MapStyle, MapboxStyleDescriptor> = {
  minimal: buildMapboxStyleDescriptor('mapbox', 'standard', [
    { fragmentId: 'basemap', property: 'theme', value: 'monochrome' },
    { fragmentId: 'basemap', property: 'lightPreset', value: 'day' },
    ...MAPBOX_STANDARD_VISUAL_CONFIG,
  ]),
  standard: buildMapboxStyleDescriptor('mapbox', 'standard', [
    { fragmentId: 'basemap', property: 'theme', value: 'default' },
    { fragmentId: 'basemap', property: 'lightPreset', value: 'day' },
    ...MAPBOX_STANDARD_VISUAL_CONFIG,
  ]),
  dark: buildMapboxStyleDescriptor('mapbox', 'standard', [
    { fragmentId: 'basemap', property: 'theme', value: 'default' },
    { fragmentId: 'basemap', property: 'lightPreset', value: 'dusk' },
    ...MAPBOX_DARK_VISUAL_CONFIG,
  ]),
  satellite: buildMapboxStyleDescriptor('mapbox', 'standard-satellite', [
    { fragmentId: 'basemap', property: 'lightPreset', value: 'day' },
    ...MAPBOX_SATELLITE_VISUAL_CONFIG,
  ]),
  clean: buildMapboxStyleDescriptor('mapbox', 'standard', [
    { fragmentId: 'basemap', property: 'theme', value: 'faded' },
    { fragmentId: 'basemap', property: 'lightPreset', value: 'day' },
    ...MAPBOX_CLEAN_VISUAL_CONFIG,
  ]),
  cleanDark: buildMapboxStyleDescriptor('mapbox', 'standard', [
    { fragmentId: 'basemap', property: 'theme', value: 'monochrome' },
    { fragmentId: 'basemap', property: 'lightPreset', value: 'night' },
    ...MAPBOX_CLEAN_DARK_VISUAL_CONFIG,
  ]),
};

export const GOOGLE_BASEMAP_HIDDEN_STYLES = [
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ visibility: 'off' }] },
] as const;

export const getMapboxStyleDescriptor = (mapStyle: MapStyle): MapboxStyleDescriptor => (
  MAPBOX_STYLE_DESCRIPTORS[mapStyle] ?? MAPBOX_STYLE_DESCRIPTORS.standard
);

export const buildMapboxStyleConfig = (mapStyle: MapStyle): MapboxStyleConfigMap | undefined => {
  const descriptor = getMapboxStyleDescriptor(mapStyle);
  if (!descriptor.configProperties?.length) return undefined;

  return descriptor.configProperties.reduce<MapboxStyleConfigMap>((config, entry) => {
    const fragmentConfig = config[entry.fragmentId] ?? {};
    fragmentConfig[entry.property] = entry.value;
    config[entry.fragmentId] = fragmentConfig;
    return config;
  }, {});
};

export const shouldHideMapboxTripLabelLayer = (
  layerId: string,
  mapStyle: MapStyle = 'standard',
): boolean => {
  if (!layerId) return false;
  if (/country-label/i.test(layerId)) {
    return false;
  }
  if (isCleanMapStyle(mapStyle) && MAPBOX_TRIP_CLEAN_LABEL_HIDE_PATTERNS.some((pattern) => pattern.test(layerId))) {
    return true;
  }
  if (!isCleanMapStyle(mapStyle) && MAPBOX_TRIP_LABEL_KEEP_PATTERNS.some((pattern) => pattern.test(layerId))) {
    return false;
  }
  return MAPBOX_TRIP_LABEL_HIDE_PATTERNS.some((pattern) => pattern.test(layerId));
};

const getMapboxLayerSearchText = (layer: MapboxStyleLayerLike): string => (
  [
    layer.id,
    layer.type,
    layer.source,
    layer['source-layer'],
    JSON.stringify(layer.metadata ?? {}),
    JSON.stringify(layer.filter ?? []),
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase()
);

const containsAdminLevel = (layer: MapboxStyleLayerLike, level: number): boolean => {
  const filterText = JSON.stringify(layer.filter ?? []).toLowerCase();
  if (!filterText) return false;
  return filterText.includes(`"admin_level"],${level}`)
    || filterText.includes(`"admin_level","${level}"`)
    || filterText.includes(`"admin-level"],${level}`)
    || filterText.includes(`"admin-level","${level}"`);
};

const isMapboxTripBoundaryLayer = (layer: MapboxStyleLayerLike): boolean => {
  const searchText = getMapboxLayerSearchText(layer);
  return searchText.includes('boundary')
    || searchText.includes('admin-')
    || searchText.includes('admin_')
    || searchText.includes('country-boundary')
    || searchText.includes('country_boundary')
    || searchText.includes('"admin_level"')
    || searchText.includes('"admin-level"');
};

const isMapboxTripCountryBoundaryLayer = (layer: MapboxStyleLayerLike): boolean => {
  const layerId = layer.id ?? '';
  const searchText = getMapboxLayerSearchText(layer);
  return MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS.includes(layerId as typeof MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS[number])
    || /admin-0-boundary/i.test(layerId)
    || /admin_0_boundary/i.test(layerId)
    || /country-boundary/i.test(layerId)
    || /country_boundary/i.test(layerId)
    || searchText.includes('admin_0')
    || searchText.includes('admin-0')
    || searchText.includes('country-boundary')
    || searchText.includes('country_boundary')
    || containsAdminLevel(layer, 0);
};

const shouldHideMapboxTripBoundaryLayer = (layer: MapboxStyleLayerLike): boolean => {
  const layerId = layer.id ?? '';
  if (!layerId) return false;
  if (layer.source === MAPBOX_COUNTRIES_TILESET_SOURCE_ID) return false;
  if (MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS.includes(layerId as typeof MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS[number])) {
    return true;
  }
  if (layer['source-layer'] === 'admin') {
    return true;
  }
  const searchText = getMapboxLayerSearchText(layer);
  if (
    containsAdminLevel(layer, 1)
    || containsAdminLevel(layer, 2)
    || containsAdminLevel(layer, 3)
    || containsAdminLevel(layer, 4)
  ) {
    return true;
  }
  if (MAPBOX_TRIP_HIDDEN_BOUNDARY_PATTERNS.some((pattern) => pattern.test(layerId) || pattern.test(searchText))) {
    return true;
  }
  return isMapboxTripBoundaryLayer(layer);
};

const MAPBOX_TRIP_CLEAN_ROAD_HIDE_PATTERNS = [
  /^road[-_]/i,
  /^bridge[-_]/i,
  /^tunnel[-_]/i,
  /^path[-_]/i,
  /^ferry[-_]/i,
  /^rail[-_]/i,
  /transportation/i,
  /street/i,
  /street-network/i,
  /street_network/i,
  /traffic/i,
  /link/i,
  /primary/i,
  /secondary/i,
  /tertiary/i,
  /trunk/i,
  /service/i,
  /motorway/i,
  /highway/i,
] as const;

const shouldHideMapboxTripRoadGeometryLayer = (
  layer: MapboxStyleLayerLike,
  mapStyle: MapStyle,
): boolean => {
  if (!isCleanMapStyle(mapStyle)) return false;
  if (layer['source-layer'] === 'road' || layer['source-layer'] === 'motorway_junction') {
    return layer.type === 'line' || layer.type === 'fill';
  }
  const layerId = layer.id ?? '';
  const searchText = getMapboxLayerSearchText(layer);
  const isRoadLikeGeometry = layer.type === 'line' || layer.type === 'fill';
  return isRoadLikeGeometry
    && MAPBOX_TRIP_CLEAN_ROAD_HIDE_PATTERNS.some((pattern) => pattern.test(layerId) || pattern.test(searchText));
};

const shouldHideMapboxTripCleanSettlementMarkerLayer = (
  layer: MapboxStyleLayerLike,
  mapStyle: MapStyle,
): boolean => {
  if (!isCleanMapStyle(mapStyle)) return false;
  if (layer['source-layer'] === 'place_label') {
    return layer.type === 'circle' || layer.type === 'fill';
  }
  const searchText = getMapboxLayerSearchText(layer);
  return (layer.type === 'circle' || layer.type === 'fill')
    && (
      searchText.includes('settlement')
      || searchText.includes('place-label')
      || searchText.includes('city')
      || searchText.includes('town')
      || searchText.includes('locality')
    );
};

const MAPBOX_TRIP_CLEAN_SYMBOL_HIDE_PATTERNS = [
  /road/i,
  /street/i,
  /highway/i,
  /motorway/i,
  /place/i,
  /settlement/i,
  /city/i,
  /town/i,
  /locality/i,
  /airport/i,
  /poi/i,
  /transit/i,
  /ferry/i,
  /rail/i,
] as const;

const shouldHideMapboxTripCleanSymbolLayer = (
  layer: MapboxStyleLayerLike,
  mapStyle: MapStyle,
): boolean => {
  if (!isCleanMapStyle(mapStyle) || layer.type !== 'symbol') return false;
  if (layer['source-layer'] === 'road' || layer['source-layer'] === 'motorway_junction') {
    return true;
  }
  if (layer['source-layer'] === 'place_label') {
    const layerId = layer.id ?? '';
    if (/country-label/i.test(layerId)) return false;
    return !/settlement-major-label/i.test(layerId);
  }
  const searchText = getMapboxLayerSearchText(layer);
  if (searchText.includes('country-label')) return false;
  return MAPBOX_TRIP_CLEAN_SYMBOL_HIDE_PATTERNS.some((pattern) => pattern.test(searchText));
};

const hideMapboxLayer = (
  map: MapboxStyleLayerVisibilityMap,
  layer: MapboxStyleLayerLike,
): void => {
  if (!layer.id || !map.getLayer(layer.id)) return;
  map.setLayoutProperty(layer.id, 'visibility', 'none');

  switch (layer.type) {
    case 'line':
      map.setPaintProperty(layer.id, 'line-opacity', 0);
      break;
    case 'fill':
      map.setPaintProperty(layer.id, 'fill-opacity', 0);
      break;
    case 'circle':
      map.setPaintProperty(layer.id, 'circle-opacity', 0);
      map.setPaintProperty(layer.id, 'circle-stroke-opacity', 0);
      break;
    case 'symbol':
      map.setPaintProperty(layer.id, 'text-opacity', 0);
      map.setPaintProperty(layer.id, 'icon-opacity', 0);
      break;
    default:
      break;
  }
};

export const applyMapboxTripVisualPolish = (
  map: MapboxStyleLayerVisibilityMap,
  mapStyle: MapStyle,
): void => {
  const layers = (map.getStyle()?.layers ?? []) as MapboxStyleLayerLike[];
  applyMapboxCountryBoundaryOverlay(map, mapStyle, layers);
  layers.forEach((layer) => {
    if (!layer.id) return;
    if (shouldHideMapboxTripBoundaryLayer(layer)) {
      hideMapboxLayer(map, layer);
      return;
    }
    if (isMapboxMajorSettlementLayer(layer)) {
      if (!map.getLayer(layer.id)) return;
      map.setFilter(
        layer.id,
        (isCleanMapStyle(mapStyle) ? MAPBOX_CLEAN_MAJOR_CITY_FILTER : MAPBOX_MAJOR_CITY_FILTER) as unknown as any[],
      );
      return;
    }
    if (shouldHideMapboxTripRoadGeometryLayer(layer, mapStyle)) {
      hideMapboxLayer(map, layer);
      return;
    }
    if (shouldHideMapboxTripCleanSettlementMarkerLayer(layer, mapStyle)) {
      hideMapboxLayer(map, layer);
      return;
    }
    if (shouldHideMapboxTripCleanSymbolLayer(layer, mapStyle)) {
      hideMapboxLayer(map, layer);
      return;
    }
    if (!shouldHideMapboxTripLabelLayer(layer.id, mapStyle)) return;
    hideMapboxLayer(map, layer);
  });
};

export const applyMapboxTripLabelVisibilityPolish = (map: MapboxStyleLayerVisibilityMap): void => {
  applyMapboxTripVisualPolish(map, 'standard');
};
