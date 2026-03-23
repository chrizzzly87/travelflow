import React from 'react';
import { GlobeHemisphereWest, MapPinArea, Path } from '@phosphor-icons/react';

import type { ICoordinates, ITimelineItem, MapStyle, RouteMode } from '../../../types';
import { useGoogleMaps } from '../../GoogleMapsLoader';
import { ItineraryMap } from '../../ItineraryMap';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

const EMPTY_BADGES: string[] = [];

interface TripWorkspaceMapCardProps {
    eyebrow: string;
    title: string;
    description: string;
    badges?: string[];
    items: ITimelineItem[];
    mapStyle?: MapStyle;
    routeMode?: RouteMode;
    showCityNames?: boolean;
    footer?: React.ReactNode;
    mapOverlay?: React.ReactNode;
    mapNativeOverlay?: React.ReactNode;
    fitBoundsCoordinates?: ICoordinates[];
    heightClassName?: string;
}

export const TripWorkspaceMapCard: React.FC<TripWorkspaceMapCardProps> = ({
    eyebrow,
    title,
    description,
    badges = EMPTY_BADGES,
    items,
    mapStyle = 'clean',
    routeMode = 'simple',
    showCityNames = true,
    footer = null,
    mapOverlay = null,
    mapNativeOverlay = null,
    fitBoundsCoordinates = [],
    heightClassName = 'h-[320px] md:h-[360px]',
}) => {
    const { isLoaded, loadError } = useGoogleMaps();
    const cityItems = React.useMemo(
        () => items.filter((item) => item.type === 'city'),
        [items],
    );

    return (
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardDescription>{eyebrow}</CardDescription>
                        <CardTitle>{title}</CardTitle>
                    </div>
                    {badges.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {badges.map((badge) => (
                                <Badge key={badge} variant="outline">{badge}</Badge>
                            ))}
                        </div>
                    ) : null}
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className={`relative overflow-hidden rounded-[2rem] border border-border/70 bg-slate-100 ${heightClassName}`}>
                    {cityItems.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                            <MapPinArea size={28} weight="duotone" className="text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">No mapped stops yet</p>
                            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                                This map will light up once the trip has destination stops to anchor.
                            </p>
                        </div>
                    ) : loadError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                            <GlobeHemisphereWest size={28} weight="duotone" className="text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">Map preview unavailable</p>
                            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                                The route card falls back to written trip context here until Google Maps is available.
                            </p>
                        </div>
                    ) : isLoaded ? (
                        <ItineraryMap
                            items={cityItems}
                            activeStyle={mapStyle}
                            routeMode={routeMode}
                            showCityNames={showCityNames}
                            showControls={false}
                            mapNativeOverlay={mapNativeOverlay}
                            fitBoundsCoordinates={fitBoundsCoordinates}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                            <Path size={28} weight="duotone" className="text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">Loading route map</p>
                            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                                This lighter workspace map reuses the same trip map engine as Planner, just with calmer controls.
                            </p>
                        </div>
                    )}
                    {cityItems.length > 0 && !loadError ? mapOverlay : null}
                </div>
                {footer}
            </CardContent>
        </Card>
    );
};
