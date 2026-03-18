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
  { fragmentId: 'basemap', property: 'showPointOfInterestLabels', value: false },
  { fragmentId: 'basemap', property: 'showTransitLabels', value: false },
  { fragmentId: 'basemap', property: 'showRoadLabels', value: false },
  { fragmentId: 'basemap', property: 'showAdminBoundaries', value: false },
  { fragmentId: 'basemap', property: 'showPlaceLabels', value: false },
];

const MAPBOX_SATELLITE_VISUAL_CONFIG: MapboxStyleConfigProperty[] = [
  ...MAPBOX_STANDARD_VISUAL_CONFIG,
  { fragmentId: 'basemap', property: 'showRoadsAndTransit', value: false },
  { fragmentId: 'basemap', property: 'showPedestrianRoads', value: false },
];

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
