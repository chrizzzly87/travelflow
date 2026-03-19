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
  'getStyle' | 'getLayer' | 'setFilter' | 'setLayoutProperty' | 'setPaintProperty'
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
const MAPBOX_DARK_BOUNDARY_COLOR = '#ffffff';

const buildMapboxStandardVisualConfig = ({
  boundaryColor,
  showPlaceLabels = true,
  showRoadsAndTransit,
  showPedestrianRoads,
}: {
  boundaryColor: string;
  showPlaceLabels?: boolean;
  showRoadsAndTransit?: boolean;
  showPedestrianRoads?: boolean;
}): MapboxStyleConfigProperty[] => {
  const config: MapboxStyleConfigProperty[] = [
    { fragmentId: 'basemap', property: 'showPlaceLabels', value: showPlaceLabels },
    { fragmentId: 'basemap', property: 'showPointOfInterestLabels', value: false },
    { fragmentId: 'basemap', property: 'showTransitLabels', value: false },
    { fragmentId: 'basemap', property: 'showRoadLabels', value: false },
    { fragmentId: 'basemap', property: 'showAdminBoundaries', value: true },
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
});

const MAPBOX_DARK_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_DARK_BOUNDARY_COLOR,
});

const MAPBOX_CLEAN_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_LIGHT_BOUNDARY_COLOR,
  showPlaceLabels: false,
  showRoadsAndTransit: false,
  showPedestrianRoads: false,
});

const MAPBOX_CLEAN_DARK_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_DARK_BOUNDARY_COLOR,
  showPlaceLabels: false,
  showRoadsAndTransit: false,
  showPedestrianRoads: false,
});

const MAPBOX_SATELLITE_VISUAL_CONFIG = buildMapboxStandardVisualConfig({
  boundaryColor: MAPBOX_DARK_BOUNDARY_COLOR,
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
  if (isMapboxTripCountryBoundaryLayer(layer)) return false;
  if (MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS.includes(layerId as typeof MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS[number])) {
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
  /motorway/i,
  /highway/i,
] as const;

const shouldHideMapboxTripRoadGeometryLayer = (
  layer: MapboxStyleLayerLike,
  mapStyle: MapStyle,
): boolean => {
  const layerId = layer.id ?? '';
  if (!isCleanMapStyle(mapStyle) || !layerId) return false;
  const searchText = getMapboxLayerSearchText(layer);
  return MAPBOX_TRIP_CLEAN_ROAD_HIDE_PATTERNS.some((pattern) => pattern.test(layerId) || pattern.test(searchText));
};

const shouldHideMapboxTripCleanSettlementMarkerLayer = (
  layer: MapboxStyleLayerLike,
  mapStyle: MapStyle,
): boolean => {
  if (!isCleanMapStyle(mapStyle)) return false;
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
  const searchText = getMapboxLayerSearchText(layer);
  if (searchText.includes('country-label')) return false;
  return MAPBOX_TRIP_CLEAN_SYMBOL_HIDE_PATTERNS.some((pattern) => pattern.test(searchText));
};

export const applyMapboxTripVisualPolish = (
  map: MapboxStyleLayerVisibilityMap,
  mapStyle: MapStyle,
): void => {
  const layers = (map.getStyle()?.layers ?? []) as MapboxStyleLayerLike[];
  const boundaryPaint = resolveMapboxCountryBoundaryPaint(mapStyle);
  layers.forEach((layer) => {
    if (!layer.id) return;
    if (shouldHideMapboxTripBoundaryLayer(layer)) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'none');
      return;
    }
    if (isMapboxMajorSettlementLayer(layer)) {
      if (isCleanMapStyle(mapStyle)) {
        if (!map.getLayer(layer.id)) return;
        map.setLayoutProperty(layer.id, 'visibility', 'none');
        return;
      }
      if (!map.getLayer(layer.id)) return;
      map.setFilter(layer.id, MAPBOX_MAJOR_CITY_FILTER as unknown as any[]);
      return;
    }
    if (shouldHideMapboxTripRoadGeometryLayer(layer, mapStyle)) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'none');
      return;
    }
    if (shouldHideMapboxTripCleanSettlementMarkerLayer(layer, mapStyle)) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'none');
      return;
    }
    if (shouldHideMapboxTripCleanSymbolLayer(layer, mapStyle)) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'none');
      return;
    }
    if (isMapboxTripCountryBoundaryLayer(layer)) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'visible');
      const isGlowLayer = layer.id === 'admin-0-boundary-bg';
      map.setPaintProperty(layer.id, 'line-color', isGlowLayer ? boundaryPaint.glowColor : boundaryPaint.lineColor);
      map.setPaintProperty(layer.id, 'line-opacity', isGlowLayer ? boundaryPaint.glowOpacity : boundaryPaint.lineOpacity);
      return;
    }
    if (!shouldHideMapboxTripLabelLayer(layer.id, mapStyle)) return;
    if (!map.getLayer(layer.id)) return;
    map.setLayoutProperty(layer.id, 'visibility', 'none');
  });
};

export const applyMapboxTripLabelVisibilityPolish = (map: MapboxStyleLayerVisibilityMap): void => {
  applyMapboxTripVisualPolish(map, 'standard');
};
