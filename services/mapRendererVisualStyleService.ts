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

const MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS = [
  'admin-0-boundary-bg',
  'admin-0-boundary',
  'admin-0-boundary-disputed',
] as const;

const MAPBOX_MAJOR_CITY_FILTER = [
  'any',
  ['<=', ['coalesce', ['get', 'symbolrank'], 999], 9],
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
      lineColor: 'rgba(255, 255, 255, 0.98)',
      lineOpacity: 0.92,
      glowColor: 'rgba(255, 255, 255, 0.58)',
      glowOpacity: 0.2,
    };
  }
  if (isDarkMapStyle(mapStyle)) {
    return {
      lineColor: 'rgba(255, 255, 255, 0.94)',
      lineOpacity: 0.84,
      glowColor: 'rgba(255, 255, 255, 0.42)',
      glowOpacity: 0.16,
    };
  }
  return {
    lineColor: 'rgba(255, 255, 255, 0.92)',
    lineOpacity: 0.76,
    glowColor: 'rgba(255, 255, 255, 0.38)',
    glowOpacity: 0.14,
  };
};

export const getMapSurfaceBackgroundColor = (mapStyle: MapStyle): string => {
  if (mapStyle === 'satellite') return '#102233';
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

export const applyMapboxTripVisualPolish = (
  map: MapboxStyleLayerVisibilityMap,
  mapStyle: MapStyle,
): void => {
  const layers = map.getStyle()?.layers ?? [];
  const boundaryPaint = resolveMapboxCountryBoundaryPaint(mapStyle);
  layers.forEach((layer) => {
    if (!layer.id) return;
    if (MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS.includes(layer.id as typeof MAPBOX_TRIP_HIDDEN_BOUNDARY_LAYERS[number])) {
      if (!map.getLayer(layer.id)) return;
      map.setLayoutProperty(layer.id, 'visibility', 'none');
      return;
    }
    if (layer.id === 'settlement-major-label') {
      if (!map.getLayer(layer.id)) return;
      map.setFilter(layer.id, MAPBOX_MAJOR_CITY_FILTER as unknown as any[]);
      return;
    }
    if (MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS.includes(layer.id as typeof MAPBOX_TRIP_COUNTRY_BOUNDARY_LAYERS[number])) {
      if (!map.getLayer(layer.id)) return;
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
