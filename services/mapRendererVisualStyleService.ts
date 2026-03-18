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

const MAPBOX_STANDARD_VISUAL_CONFIG: MapboxStyleConfigProperty[] = [
  { fragmentId: 'basemap', property: 'showPlaceLabels', value: true },
  { fragmentId: 'basemap', property: 'showPointOfInterestLabels', value: false },
  { fragmentId: 'basemap', property: 'showTransitLabels', value: false },
  { fragmentId: 'basemap', property: 'showRoadLabels', value: false },
  { fragmentId: 'basemap', property: 'showAdminBoundaries', value: true },
  { fragmentId: 'basemap', property: 'colorAdminBoundaries', value: '#ffffff' },
];

const MAPBOX_SATELLITE_VISUAL_CONFIG: MapboxStyleConfigProperty[] = [
  ...MAPBOX_STANDARD_VISUAL_CONFIG,
  { fragmentId: 'basemap', property: 'showRoadsAndTransit', value: false },
  { fragmentId: 'basemap', property: 'showPedestrianRoads', value: false },
];

const MAPBOX_TRIP_LABEL_HIDE_PATTERNS = [
  /settlement-subdivision-label/i,
  /settlement-minor-label/i,
  /state-label/i,
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

const MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS = [
  'admin-1-boundary-bg',
  'admin-1-boundary',
] as const;

const MAPBOX_TRIP_HIDDEN_BOUNDARY_PATTERNS = [
  /admin-1-boundary/i,
  /admin-2-boundary/i,
  /admin-3-boundary/i,
  /admin-4-boundary/i,
  /state-boundary/i,
  /region-boundary/i,
  /province-boundary/i,
  /district-boundary/i,
  /county-boundary/i,
  /municipality-boundary/i,
  /subdivision-boundary/i,
  /boundary-admin/i,
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

const isDarkMapStyle = (mapStyle: MapStyle): boolean => (
  mapStyle === 'dark' || mapStyle === 'cleanDark'
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
    lineColor: 'rgba(255, 255, 255, 0.95)',
    lineOpacity: 0.82,
    glowColor: 'rgba(255, 255, 255, 0.44)',
    glowOpacity: 0.16,
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
    ...MAPBOX_STANDARD_VISUAL_CONFIG,
  ]),
  satellite: buildMapboxStyleDescriptor('mapbox', 'standard-satellite', [
    { fragmentId: 'basemap', property: 'lightPreset', value: 'day' },
    ...MAPBOX_SATELLITE_VISUAL_CONFIG,
  ]),
  clean: buildMapboxStyleDescriptor('mapbox', 'standard', [
    { fragmentId: 'basemap', property: 'theme', value: 'faded' },
    { fragmentId: 'basemap', property: 'lightPreset', value: 'day' },
    ...MAPBOX_STANDARD_VISUAL_CONFIG,
  ]),
  cleanDark: buildMapboxStyleDescriptor('mapbox', 'standard', [
    { fragmentId: 'basemap', property: 'theme', value: 'monochrome' },
    { fragmentId: 'basemap', property: 'lightPreset', value: 'night' },
    ...MAPBOX_STANDARD_VISUAL_CONFIG,
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

export const shouldHideMapboxTripLabelLayer = (layerId: string): boolean => {
  if (!layerId) return false;
  if (MAPBOX_TRIP_LABEL_KEEP_PATTERNS.some((pattern) => pattern.test(layerId))) {
    return false;
  }
  return MAPBOX_TRIP_LABEL_HIDE_PATTERNS.some((pattern) => pattern.test(layerId));
};

const isMapboxTripCountryBoundaryLayer = (layerId: string): boolean => (
  MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS.includes(layerId as typeof MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS[number])
  || /admin-0-boundary/i.test(layerId)
  || /country-boundary/i.test(layerId)
);

const shouldHideMapboxTripBoundaryLayer = (layerId: string): boolean => {
  if (!layerId) return false;
  if (isMapboxTripCountryBoundaryLayer(layerId)) return false;
  if (MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS.includes(layerId as typeof MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS[number])) {
    return true;
  }
  return MAPBOX_TRIP_HIDDEN_BOUNDARY_PATTERNS.some((pattern) => pattern.test(layerId));
};

export const applyMapboxTripVisualPolish = (
  map: MapboxStyleLayerVisibilityMap,
  mapStyle: MapStyle,
): void => {
  const layers = map.getStyle()?.layers ?? [];
  const boundaryPaint = resolveMapboxCountryBoundaryPaint(mapStyle);
  layers.forEach((layer) => {
    if (!layer.id) return;
    if (shouldHideMapboxTripBoundaryLayer(layer.id)) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'none');
      return;
    }
    if (layer.id === 'settlement-major-label') {
      if (!map.getLayer(layer.id)) return;
      map.setFilter(layer.id, MAPBOX_MAJOR_CITY_FILTER as unknown as any[]);
      return;
    }
    if (isMapboxTripCountryBoundaryLayer(layer.id)) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'visible');
      const isGlowLayer = layer.id === 'admin-0-boundary-bg';
      map.setPaintProperty(layer.id, 'line-color', isGlowLayer ? boundaryPaint.glowColor : boundaryPaint.lineColor);
      map.setPaintProperty(layer.id, 'line-opacity', isGlowLayer ? boundaryPaint.glowOpacity : boundaryPaint.lineOpacity);
      return;
    }
    if (!shouldHideMapboxTripLabelLayer(layer.id)) return;
    if (!map.getLayer(layer.id)) return;
    map.setLayoutProperty(layer.id, 'visibility', 'none');
  });
};

export const applyMapboxTripLabelVisibilityPolish = (map: MapboxStyleLayerVisibilityMap): void => {
  applyMapboxTripVisualPolish(map, 'standard');
};
