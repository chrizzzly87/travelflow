import React from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { HouseLine } from '@phosphor-icons/react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ICoordinates } from '../../../types';
import type {
    TripWorkspaceCityGuide,
    TripWorkspaceCityMapLayer,
    TripWorkspaceCityNeighborhood,
    TripWorkspaceCityStay,
} from './tripWorkspaceDemoData';
import { buildTripWorkspacePlacesMapGeometry } from './tripWorkspacePlacesMapGeometry';

interface TripWorkspacePlacesMapNativeOverlayProps {
    city: TripWorkspaceCityGuide;
    cityCenter: ICoordinates | null;
    activeLayer: TripWorkspaceCityMapLayer | null;
    visibleNeighborhoods: TripWorkspaceCityNeighborhood[];
    visibleStays: TripWorkspaceCityStay[];
}

const createOverlayMarker = (
    map: google.maps.Map,
    position: ICoordinates,
    html: string,
    zIndex: number,
): google.maps.OverlayView => {
    const overlay = new window.google.maps.OverlayView();
    let element: HTMLDivElement | null = null;

    overlay.onAdd = () => {
        const panes = overlay.getPanes();
        if (!panes) return;

        element = document.createElement('div');
        element.style.position = 'absolute';
        element.style.transform = 'translate(-50%, -50%)';
        element.style.pointerEvents = 'none';
        element.style.zIndex = String(zIndex);
        element.innerHTML = html;
        (panes.floatPane ?? panes.overlayMouseTarget ?? panes.overlayLayer)?.appendChild(element);
    };

    overlay.draw = () => {
        if (!element) return;
        const projection = overlay.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(position.lat, position.lng));
        if (!point) return;
        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
    };

    overlay.onRemove = () => {
        element?.remove();
        element = null;
    };

    overlay.setMap(map);
    return overlay;
};

const buildNeighborhoodMarkerHtml = (index: number, tripSpecific: boolean) => renderToStaticMarkup(
    <div
        className={[
            'flex size-8 items-center justify-center rounded-full border text-xs font-semibold shadow-sm backdrop-blur-sm',
            tripSpecific
                ? 'border-amber-300/80 bg-amber-50 text-amber-700'
                : 'border-sky-300/80 bg-sky-50 text-sky-700',
        ].join(' ')}
    >
        {index + 1}
    </div>,
);

const buildStayMarkerHtml = () => renderToStaticMarkup(
    <div className="flex size-9 items-center justify-center rounded-full border border-white/80 bg-background/95 text-foreground shadow-sm backdrop-blur-sm">
        <HouseLine weight="duotone" />
    </div>,
);

const buildCalloutHtml = (label: string, tripSpecific: boolean) => renderToStaticMarkup(
    <div
        className={[
            'rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm backdrop-blur-sm',
            tripSpecific
                ? 'border-amber-300/80 bg-amber-50/95 text-amber-700'
                : 'border-sky-300/80 bg-sky-50/95 text-sky-700',
        ].join(' ')}
    >
        {label}
    </div>,
);

export const TripWorkspacePlacesMapNativeOverlay: React.FC<TripWorkspacePlacesMapNativeOverlayProps> = ({
    city,
    cityCenter,
    activeLayer,
    visibleNeighborhoods,
    visibleStays,
}) => {
    const map = useMap();

    React.useEffect(() => {
        if (!map || !cityCenter || !window.google?.maps?.Circle || !window.google?.maps?.Polyline || !window.google?.maps?.OverlayView) {
            return;
        }

        const geometry = buildTripWorkspacePlacesMapGeometry({
            origin: cityCenter,
            visibleNeighborhoods,
            visibleStays,
            activeLayer,
        });
        const isTripSpecific = activeLayer?.scope === 'Trip-specific';
        const strokeColor = activeLayer
            ? isTripSpecific
                ? '#d97706'
                : '#0284c7'
            : '#94a3b8';
        const fillColor = activeLayer
            ? isTripSpecific
                ? '#f59e0b'
                : '#38bdf8'
            : '#cbd5e1';
        const circles = geometry.neighborhoods.map((neighborhood) => new window.google.maps.Circle({
            map,
            center: neighborhood.center,
            radius: neighborhood.radiusMeters,
            strokeColor,
            strokeOpacity: activeLayer ? 0.5 : 0.28,
            strokeWeight: activeLayer ? 1.8 : 1.4,
            fillColor,
            fillOpacity: activeLayer ? 0.14 : 0.08,
            clickable: false,
            zIndex: 20,
        }));

        const polylines = geometry.focusPath.length > 1
            ? [
                new window.google.maps.Polyline({
                    map,
                    path: geometry.focusPath,
                    strokeColor,
                    strokeOpacity: 0,
                    strokeWeight: 2.4,
                    clickable: false,
                    geodesic: false,
                    icons: [
                        {
                            icon: {
                                path: 'M 0,-1 0,1',
                                strokeOpacity: 0.9,
                                strokeColor,
                                scale: 3.2,
                            },
                            offset: '0',
                            repeat: '12px',
                        },
                    ],
                    zIndex: 24,
                }),
            ]
            : [];

        const neighborhoodMarkers = geometry.neighborhoods.map((neighborhood, index) => (
            createOverlayMarker(
                map,
                neighborhood.center,
                buildNeighborhoodMarkerHtml(index, Boolean(activeLayer && isTripSpecific)),
                42,
            )
        ));
        const stayMarkers = geometry.stays.map((stay) => (
            createOverlayMarker(map, stay.coordinate, buildStayMarkerHtml(), 43)
        ));
        const calloutMarker = geometry.calloutCoordinate && activeLayer
            ? createOverlayMarker(
                map,
                geometry.calloutCoordinate,
                buildCalloutHtml(activeLayer.callout.label, isTripSpecific),
                44,
            )
            : null;

        return () => {
            circles.forEach((circle) => circle.setMap(null));
            polylines.forEach((polyline) => polyline.setMap(null));
            neighborhoodMarkers.forEach((marker) => marker.setMap(null));
            stayMarkers.forEach((marker) => marker.setMap(null));
            calloutMarker?.setMap(null);
        };
    }, [activeLayer, city.id, cityCenter, map, visibleNeighborhoods, visibleStays]);

    return null;
};
