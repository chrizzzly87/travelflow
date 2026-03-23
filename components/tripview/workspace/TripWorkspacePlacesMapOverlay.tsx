import React from 'react';
import { Sparkle } from '@phosphor-icons/react';

import type {
    TripWorkspaceCityGuide,
    TripWorkspaceCityMapLayer,
    TripWorkspaceCityNeighborhood,
    TripWorkspaceCityStay,
} from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';

interface TripWorkspacePlacesMapOverlayProps {
    city: TripWorkspaceCityGuide;
    activeLayer: TripWorkspaceCityMapLayer | null;
    visibleNeighborhoods: TripWorkspaceCityNeighborhood[];
    visibleStays: TripWorkspaceCityStay[];
}

export const TripWorkspacePlacesMapOverlay: React.FC<TripWorkspacePlacesMapOverlayProps> = ({
    city,
    activeLayer,
    visibleNeighborhoods,
    visibleStays,
}) => {
    const displayedNeighborhoods = activeLayer ? visibleNeighborhoods : city.neighborhoods;
    const displayedStays = activeLayer ? visibleStays : city.savedStays;
    const summaryLabel = activeLayer
        ? `${displayedNeighborhoods.length} focus zones`
        : `${displayedNeighborhoods.length} neighborhood anchors`;
    const summaryDetail = activeLayer
        ? `${displayedStays.length} stay anchor${displayedStays.length === 1 ? '' : 's'} active in this layer`
        : 'Neighborhoods stay visible here while deeper trip details stay in the guide cards below.';

    const isTripSpecific = activeLayer?.scope === 'Trip-specific';
    const markerToneClassName = activeLayer
        ? isTripSpecific
            ? 'border-amber-300/70 bg-amber-50 text-amber-700'
            : 'border-sky-300/70 bg-sky-50 text-sky-700'
        : 'border-slate-300/70 bg-background text-slate-700';
    const layerLabel = activeLayer?.label ?? 'Districts on map';
    const layerDescription = activeLayer?.detail ?? 'Use the layer toggles below the map to spotlight a planning lens without drowning the basemap in labels.';

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[2rem]">
            <div className="absolute start-4 top-4 w-[16.5rem] max-w-[calc(100%-7rem)]">
                <div className="rounded-[1.35rem] border border-white/65 bg-background/92 px-3.5 py-3 shadow-sm backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={activeLayer ? 'secondary' : 'outline'}>{summaryLabel}</Badge>
                        {activeLayer ? <Badge variant="outline">{activeLayer.scope}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">
                        {layerLabel}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {layerDescription}
                    </p>
                    <Separator className="my-3 bg-border/70" />
                    <div className="grid gap-2.5">
                        {displayedNeighborhoods.map((neighborhood, index) => (
                            <div key={neighborhood.name} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2.5">
                                <div className={`mt-0.5 flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm ${markerToneClassName}`}>
                                    {index + 1}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-foreground">{neighborhood.name}</p>
                                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{neighborhood.fit}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Separator className="my-3 bg-border/70" />
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Stay anchors</p>
                            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{summaryDetail}</p>
                        </div>
                        <Badge variant="outline">{displayedStays.length}</Badge>
                    </div>
                    {activeLayer ? (
                        <>
                            <Separator className="my-3 bg-border/70" />
                            <div className="rounded-[1rem] border border-border/70 bg-background/70 px-3 py-2">
                                <p className="text-xs font-medium text-foreground">{activeLayer.callout.label}</p>
                                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{activeLayer.callout.detail}</p>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
            {city.events[0] ? (
                <div className="absolute end-4 top-4 max-w-[11rem] rounded-[1.1rem] border border-white/65 bg-background/88 px-3 py-2 text-right shadow-sm backdrop-blur-md">
                    <div className="flex items-center justify-end gap-2 text-[11px] font-medium text-foreground">
                        <Sparkle weight="duotone" />
                        Route moment
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{city.events[0].title}</p>
                </div>
            ) : null}
        </div>
    );
};
