import type { TransportMode } from './transportModes';

export const MAP_PRESENTATION_VERSION = 1 as const;

export const MAP_PRESENTATION_MARKER_KIND_VALUES = [
  'city',
  'activity',
  'poi',
  'port',
  'campground',
  'custom',
] as const;

export type MapPresentationMarkerKind = (typeof MAP_PRESENTATION_MARKER_KIND_VALUES)[number];
export type MapPresentationRouteGeometryStatus = 'unresolved' | 'computed' | 'fallback' | 'failed';

export interface MapPresentationCoordinate {
  lat: number;
  lng: number;
}

export interface MapPresentationMarker {
  id: string;
  kind: MapPresentationMarkerKind;
  position: MapPresentationCoordinate;
  label: string;
  secondaryLabel?: string;
  order?: number;
  color?: string;
  imageUrl?: string;
  categoryKeys: string[];
  sourceItemId?: string;
  entityId?: string;
  canonicalSlug?: string;
  metadata: Record<string, unknown>;
}

export interface MapPresentationRouteLeg {
  id: string;
  fromMarkerId: string;
  toMarkerId: string;
  mode: TransportMode;
  geometryStatus: MapPresentationRouteGeometryStatus;
  path?: MapPresentationCoordinate[];
  distanceMeters?: number;
  durationSeconds?: number;
  color?: string;
  sourceItemId?: string;
  metadata: Record<string, unknown>;
}

export interface MapPresentationSelection {
  markerId?: string;
  routeLegId?: string;
}

export interface MapPresentationViewport {
  fitMarkerIds: string[];
  focusMarkerId?: string;
  padding?: {
    blockStart: number;
    inlineEnd: number;
    blockEnd: number;
    inlineStart: number;
  };
}

export interface MapPresentationContext {
  source: string;
  datasetVersion?: string;
  templateKey?: string;
  metadata: Record<string, unknown>;
}

export interface MapPresentationModel {
  version: typeof MAP_PRESENTATION_VERSION;
  markers: MapPresentationMarker[];
  routeLegs: MapPresentationRouteLeg[];
  selection: MapPresentationSelection;
  viewport: MapPresentationViewport;
  context: MapPresentationContext;
}

export interface MapPresentationValidationResult {
  valid: boolean;
  errors: string[];
}

const markerKindSet = new Set<string>(MAP_PRESENTATION_MARKER_KIND_VALUES);

export const isMapPresentationCoordinate = (value: unknown): value is MapPresentationCoordinate => {
  if (!value || typeof value !== 'object') return false;
  const coordinate = value as Partial<MapPresentationCoordinate>;
  return Number.isFinite(coordinate.lat)
    && Number.isFinite(coordinate.lng)
    && Math.abs(coordinate.lat!) <= 90
    && Math.abs(coordinate.lng!) <= 180;
};

export const validateMapPresentation = (value: MapPresentationModel): MapPresentationValidationResult => {
  const errors: string[] = [];
  if (value.version !== MAP_PRESENTATION_VERSION) errors.push('Map presentation version must be 1.');

  const markerIds = new Set<string>();
  value.markers.forEach((marker, index) => {
    if (!marker.id.trim()) errors.push(`Marker ${index} requires an id.`);
    if (markerIds.has(marker.id)) errors.push(`Marker id ${marker.id} is duplicated.`);
    markerIds.add(marker.id);
    if (!markerKindSet.has(marker.kind)) errors.push(`Marker ${marker.id} has an invalid kind.`);
    if (!isMapPresentationCoordinate(marker.position)) errors.push(`Marker ${marker.id} has invalid coordinates.`);
    if (!marker.label.trim()) errors.push(`Marker ${marker.id} requires a label.`);
  });

  const routeIds = new Set<string>();
  value.routeLegs.forEach((route, index) => {
    if (!route.id.trim()) errors.push(`Route leg ${index} requires an id.`);
    if (routeIds.has(route.id)) errors.push(`Route leg id ${route.id} is duplicated.`);
    routeIds.add(route.id);
    if (!markerIds.has(route.fromMarkerId)) errors.push(`Route leg ${route.id} references an unknown start marker.`);
    if (!markerIds.has(route.toMarkerId)) errors.push(`Route leg ${route.id} references an unknown end marker.`);
    if (route.fromMarkerId === route.toMarkerId) errors.push(`Route leg ${route.id} must connect two markers.`);
    if (route.path?.some((coordinate) => !isMapPresentationCoordinate(coordinate))) {
      errors.push(`Route leg ${route.id} has an invalid path coordinate.`);
    }
  });

  if (value.selection.markerId && !markerIds.has(value.selection.markerId)) {
    errors.push('The selected marker does not exist.');
  }
  if (value.selection.routeLegId && !routeIds.has(value.selection.routeLegId)) {
    errors.push('The selected route leg does not exist.');
  }
  for (const markerId of value.viewport.fitMarkerIds) {
    if (!markerIds.has(markerId)) errors.push(`Viewport references unknown marker ${markerId}.`);
  }
  if (value.viewport.focusMarkerId && !markerIds.has(value.viewport.focusMarkerId)) {
    errors.push('The viewport focus marker does not exist.');
  }

  return { valid: errors.length === 0, errors };
};
