import {
  validateMapPresentation,
  type MapPresentationContext,
  type MapPresentationMarker,
  type MapPresentationModel,
  type MapPresentationRouteLeg,
  type MapPresentationViewport,
} from './mapPresentation';

export interface MapPresentationSceneMarker {
  marker: MapPresentationMarker;
  selected: boolean;
  focused: boolean;
  includedInFit: boolean;
}

export interface MapPresentationSceneRouteLeg {
  routeLeg: MapPresentationRouteLeg;
  from: MapPresentationMarker;
  to: MapPresentationMarker;
  selected: boolean;
}

export interface MapPresentationSceneViewport extends MapPresentationViewport {
  fitMarkers: MapPresentationMarker[];
  focusMarker?: MapPresentationMarker;
}

export interface MapPresentationScene {
  markers: MapPresentationSceneMarker[];
  routeLegs: MapPresentationSceneRouteLeg[];
  viewport: MapPresentationSceneViewport;
  context: MapPresentationContext;
}

export const buildMapPresentationScene = (presentation: MapPresentationModel): MapPresentationScene => {
  const validation = validateMapPresentation(presentation);
  if (!validation.valid) {
    throw new Error(`Map presentation is invalid: ${validation.errors.join(' ')}`);
  }

  const markerById = new Map(presentation.markers.map((marker) => [marker.id, marker]));
  const fitMarkerIds = new Set(presentation.viewport.fitMarkerIds);

  return {
    markers: presentation.markers.map((marker) => ({
      marker,
      selected: marker.id === presentation.selection.markerId,
      focused: marker.id === presentation.viewport.focusMarkerId,
      includedInFit: fitMarkerIds.has(marker.id),
    })),
    routeLegs: presentation.routeLegs.map((routeLeg) => ({
      routeLeg,
      from: markerById.get(routeLeg.fromMarkerId)!,
      to: markerById.get(routeLeg.toMarkerId)!,
      selected: routeLeg.id === presentation.selection.routeLegId,
    })),
    viewport: {
      ...presentation.viewport,
      fitMarkers: presentation.viewport.fitMarkerIds.map((markerId) => markerById.get(markerId)!),
      focusMarker: presentation.viewport.focusMarkerId
        ? markerById.get(presentation.viewport.focusMarkerId)
        : undefined,
    },
    context: presentation.context,
  };
};
