import React from 'react';
import { AdvancedMarker, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { GlobeHemisphereWest, MapPinArea, Path } from '@phosphor-icons/react';

import type { ICoordinates, ITimelineItem } from '../../types';
import { getHexFromColorClass } from '../../utils';
import { useGoogleMaps } from '../GoogleMapsLoader';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface TripWorkspaceOverviewMapProps {
    cityStops: ITimelineItem[];
}

type ResolvedOverviewMapStop = {
    id: string;
    title: string;
    coordinates: ICoordinates;
    colorHex: string;
    stayLabel: string;
};

type GoogleMapsRuntimeWindow = Window & typeof globalThis & {
    google?: {
        maps?: {
            Polyline: new (options: {
                map: unknown;
                path: Array<{ lat: number; lng: number }>;
                geodesic: boolean;
                strokeColor: string;
                strokeOpacity: number;
                strokeWeight: number;
            }) => {
                setMap: (map: unknown) => void;
            };
            LatLngBounds: new () => {
                extend: (coordinates: ICoordinates) => void;
            };
        };
    };
};

const DEMO_CITY_COORDINATES: Record<string, ICoordinates> = {
    bangkok: { lat: 13.7563, lng: 100.5018 },
    chiangmai: { lat: 18.7883, lng: 98.9853 },
    krabi: { lat: 8.0863, lng: 98.9063 },
    railay: { lat: 8.0054, lng: 98.8372 },
    aonang: { lat: 8.0321, lng: 98.8248 },
};

const normalizeLocationKey = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '');

const resolveFallbackCoordinates = (title: string): ICoordinates | null => {
    const normalizedTitle = normalizeLocationKey(title);
    const directMatch = DEMO_CITY_COORDINATES[normalizedTitle];
    if (directMatch) return directMatch;

    const partialMatch = Object.entries(DEMO_CITY_COORDINATES).find(([key]) => normalizedTitle.includes(key));
    return partialMatch?.[1] ?? null;
};

const resolveMapStops = (cityStops: ITimelineItem[]): ResolvedOverviewMapStop[] => cityStops
    .map((city) => {
        const coordinates = city.coordinates ?? resolveFallbackCoordinates(city.title);
        if (!coordinates) return null;

        return {
            id: city.id,
            title: city.title,
            coordinates,
            colorHex: getHexFromColorClass(city.color || ''),
            stayLabel: `${Math.max(1, Math.round(city.duration || 0))}d`,
        };
    })
    .filter((stop): stop is ResolvedOverviewMapStop => Boolean(stop));

const OverviewRoutePolyline: React.FC<{
    path: Array<{ lat: number; lng: number }>;
}> = ({ path }) => {
    const map = useMap();

    React.useEffect(() => {
        const mapsWindow = window as GoogleMapsRuntimeWindow;
        if (!map || !mapsWindow.google?.maps || path.length < 2) return undefined;

        const polyline = new mapsWindow.google.maps.Polyline({
            map,
            path,
            geodesic: true,
            strokeColor: '#0f766e',
            strokeOpacity: 0.85,
            strokeWeight: 3,
        });

        return () => {
            polyline.setMap(null);
        };
    }, [map, path]);

    return null;
};

const OverviewMapViewportController: React.FC<{
    stops: ResolvedOverviewMapStop[];
}> = ({ stops }) => {
    const map = useMap();

    React.useEffect(() => {
        const mapsWindow = window as GoogleMapsRuntimeWindow;
        if (!map || !mapsWindow.google?.maps || stops.length === 0) return;

        if (stops.length === 1) {
            map.setCenter(stops[0].coordinates);
            map.setZoom(7);
            return;
        }

        const bounds = new mapsWindow.google.maps.LatLngBounds();
        stops.forEach((stop) => bounds.extend(stop.coordinates));
        map.fitBounds(bounds, 72);
    }, [map, stops]);

    return null;
};

const OverviewMapCanvas: React.FC<{
    stops: ResolvedOverviewMapStop[];
}> = ({ stops }) => {
    const path = React.useMemo(
        () => stops.map((stop) => stop.coordinates),
        [stops],
    );
    const fallbackCenter = stops[0]?.coordinates ?? { lat: 13.7563, lng: 100.5018 };

    return (
        <GoogleMap
            defaultCenter={fallbackCenter}
            defaultZoom={5}
            disableDefaultUI
            reuseMaps
            gestureHandling="cooperative"
            className="h-full w-full"
        >
            <OverviewMapViewportController stops={stops} />
            <OverviewRoutePolyline path={path} />
            {stops.map((stop, index) => (
                <AdvancedMarker
                    key={stop.id}
                    position={stop.coordinates}
                    title={stop.title}
                >
                    <div className="flex min-w-[84px] flex-col items-center gap-2">
                        <div
                            className="inline-flex min-w-[84px] items-center justify-center rounded-full border border-white/80 px-3 py-1 text-xs font-semibold text-white shadow-lg"
                            style={{ backgroundColor: stop.colorHex }}
                        >
                            {index + 1}. {stop.title}
                        </div>
                        <div className="rounded-full border border-white/80 bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
                            {stop.stayLabel}
                        </div>
                    </div>
                </AdvancedMarker>
            ))}
        </GoogleMap>
    );
};

export const TripWorkspaceOverviewMap: React.FC<TripWorkspaceOverviewMapProps> = ({ cityStops }) => {
    const { isLoaded, loadError } = useGoogleMaps();
    const stops = React.useMemo(() => resolveMapStops(cityStops), [cityStops]);

    return (
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardDescription>Overview map</CardDescription>
                        <CardTitle>Follow the route across Thailand</CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Demo route markers</Badge>
                        <Badge variant="secondary">{stops.length} mapped stops</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-border/70 bg-muted">
                    {loadError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                            <GlobeHemisphereWest size={28} weight="duotone" className="text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">Map preview unavailable</p>
                            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                                Google Maps could not load here, so the route card falls back to the written stop summary.
                            </p>
                        </div>
                    ) : isLoaded ? (
                        <OverviewMapCanvas stops={stops} />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                            <MapPinArea size={28} weight="duotone" className="text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">Loading overview map</p>
                            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                                This compact route map stays separate from the planner and only shows the high-level trip path.
                            </p>
                        </div>
                    )}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                    {stops.map((stop, index) => (
                        <div key={stop.id} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                            <div className="flex items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className="size-2.5 rounded-full"
                                    style={{ backgroundColor: stop.colorHex }}
                                />
                                <p className="text-sm font-medium text-foreground">{index + 1}. {stop.title}</p>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                Demo coordinates fill gaps until live city geocoding is fully connected.
                            </p>
                        </div>
                    ))}
                </div>
                <div className="rounded-2xl border border-border/70 bg-accent/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                        <Path size={16} weight="duotone" />
                        Overview map scope
                    </div>
                    <p className="mt-2">
                        This page keeps the route visual simple on purpose: city anchors, order, and broad geography. Detailed map tooling stays inside the Planner and Places pages.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
