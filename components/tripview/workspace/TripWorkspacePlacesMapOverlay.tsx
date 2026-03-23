import React from 'react';
import { HouseLine, Sparkle } from '@phosphor-icons/react';

import { cn } from '../../../lib/utils';
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

const RADIUS_CLASSNAME: Record<TripWorkspaceCityNeighborhood['mapRadius'], string> = {
    sm: 'size-20',
    md: 'size-28',
    lg: 'size-36',
};

const RADIUS_PX: Record<TripWorkspaceCityNeighborhood['mapRadius'], number> = {
    sm: 80,
    md: 112,
    lg: 144,
};

const LABEL_OFFSET_MULTIPLIERS = [
    { x: 0.34, y: -0.38 },
    { x: 0.42, y: 0.02 },
    { x: -0.34, y: -0.38 },
    { x: -0.4, y: 0.08 },
] as const;

export const TripWorkspacePlacesMapOverlay: React.FC<TripWorkspacePlacesMapOverlayProps> = ({
    city,
    activeLayer,
    visibleNeighborhoods,
    visibleStays,
}) => {
    const displayedNeighborhoods = activeLayer ? visibleNeighborhoods : city.neighborhoods;
    const displayedStays = activeLayer ? visibleStays : city.savedStays;
    const focusPath = activeLayer?.focusPath ?? [];
    const summaryLabel = activeLayer
        ? `${displayedNeighborhoods.length} focus zones`
        : `${displayedNeighborhoods.length} neighborhood anchors`;
    const summaryDetail = activeLayer
        ? `${displayedStays.length} stay anchor${displayedStays.length === 1 ? '' : 's'} active in this layer`
        : 'Neighborhoods stay visible here while deeper trip details stay in the guide cards below.';

    const isTripSpecific = activeLayer?.scope === 'Trip-specific';
    const zoneClassName = activeLayer
        ? isTripSpecific
            ? 'border-amber-400/60 bg-amber-300/18'
            : 'border-sky-400/60 bg-sky-300/18'
        : 'border-slate-300/55 bg-white/12';
    const glowClassName = activeLayer
        ? isTripSpecific
            ? 'bg-amber-300/20'
            : 'bg-sky-300/20'
        : 'bg-slate-200/20';
    const pathStroke = activeLayer
        ? isTripSpecific
            ? '#d97706'
            : '#0284c7'
        : '#64748b';
    const markerToneClassName = activeLayer
        ? isTripSpecific
            ? 'border-amber-300/70 bg-amber-50 text-amber-700'
            : 'border-sky-300/70 bg-sky-50 text-sky-700'
        : 'border-slate-300/70 bg-background text-slate-700';
    const layerLabel = activeLayer?.label ?? 'Districts on map';
    const layerDescription = activeLayer?.detail ?? 'Use the layer toggles below the map to spotlight a planning lens without drowning the basemap in labels.';

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[2rem]">
            <div className="absolute inset-0 bg-linear-to-br from-white/8 via-transparent to-slate-950/10" />
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
                                <div className={cn('mt-0.5 flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm', markerToneClassName)}>
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

            {activeLayer ? (
                <div
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                        left: `${activeLayer.callout.position.x}%`,
                        top: `${activeLayer.callout.position.y}%`,
                    }}
                >
                    <div className={cn(
                        'rounded-full border bg-background/92 px-3 py-1 text-[11px] font-medium shadow-sm backdrop-blur-md',
                        markerToneClassName,
                    )}
                    >
                        {activeLayer.callout.label}
                    </div>
                </div>
            ) : null}

            {focusPath.length > 1 ? (
                <svg
                    aria-hidden="true"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full"
                >
                    <polyline
                        points={focusPath.map((point) => `${point.x},${point.y}`).join(' ')}
                        fill="none"
                        stroke={pathStroke}
                        strokeOpacity={0.9}
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="3.2 3.2"
                    />
                    {focusPath.map((point) => (
                        <circle
                            key={`${point.x}-${point.y}`}
                            cx={point.x}
                            cy={point.y}
                            r="1.4"
                            fill={pathStroke}
                            fillOpacity="0.9"
                        />
                    ))}
                </svg>
            ) : null}

            {displayedNeighborhoods.map((neighborhood, index) => {
                const radiusPx = RADIUS_PX[neighborhood.mapRadius];
                const offset = LABEL_OFFSET_MULTIPLIERS[index % LABEL_OFFSET_MULTIPLIERS.length];

                return (
                    <div
                        key={neighborhood.name}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{
                            left: `${neighborhood.mapPosition.x}%`,
                            top: `${neighborhood.mapPosition.y}%`,
                        }}
                    >
                        <div className={cn('absolute inset-0 rounded-full blur-xl', glowClassName)} />
                        <div className={cn('relative rounded-full border backdrop-blur-[2px]', RADIUS_CLASSNAME[neighborhood.mapRadius], zoneClassName)} />
                        <div
                            className="absolute"
                            style={{
                                left: `calc(50% + ${Math.round(radiusPx * offset.x)}px)`,
                                top: `calc(50% + ${Math.round(radiusPx * offset.y)}px)`,
                            }}
                        >
                            <div
                                aria-label={`Neighborhood marker ${index + 1}: ${neighborhood.name}`}
                                className={cn(
                                    'flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm backdrop-blur-md',
                                    markerToneClassName,
                                )}
                            >
                                {index + 1}
                            </div>
                        </div>
                    </div>
                );
            })}

            {displayedStays.map((stay, index) => (
                <div
                    key={stay.area}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                        left: `${stay.mapPosition.x}%`,
                        top: `${stay.mapPosition.y}%`,
                    }}
                >
                    <div
                        aria-label={`Stay anchor ${index + 1}: ${stay.area}`}
                        className="flex size-8 items-center justify-center rounded-full border border-white/70 bg-background/94 text-foreground shadow-sm backdrop-blur-md"
                    >
                        <HouseLine weight="duotone" />
                    </div>
                </div>
            ))}
        </div>
    );
};
