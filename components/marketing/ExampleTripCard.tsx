import React from 'react';
import { Clock, MapPin, Repeat } from '@phosphor-icons/react';
import type { ExampleTripCard as ExampleTripCardType } from '../../data/exampleTripCards';
import type { ExampleTemplateMiniCalendar } from '../../data/exampleTripTemplates';
import { getExampleCityLaneViewTransitionName, getExampleMapViewTransitionName, getExampleTitleViewTransitionName } from '../../shared/viewTransitionNames';

interface ExampleTripCardProps {
    card: ExampleTripCardType;
    mapPreviewUrl?: string | null;
    miniCalendar?: ExampleTemplateMiniCalendar | null;
    enableSharedTransition?: boolean;
}

export const ExampleTripCard: React.FC<ExampleTripCardProps> = ({
    card,
    mapPreviewUrl,
    miniCalendar = null,
    enableSharedTransition = false,
}) => {
    const staticFallbackSrc = card.mapImagePath
        ? `${card.mapImagePath}?v=palette-20260210d`
        : null;
    const [mapImageSrc, setMapImageSrc] = React.useState<string | null>(mapPreviewUrl || staticFallbackSrc);
    const mapViewTransitionName = getExampleMapViewTransitionName(enableSharedTransition);
    const titleViewTransitionName = getExampleTitleViewTransitionName(enableSharedTransition);
    const cityLanes = miniCalendar?.cityLanes || [];
    const routeLanes = miniCalendar?.routeLanes || [];

    React.useEffect(() => {
        setMapImageSrc(mapPreviewUrl || staticFallbackSrc);
    }, [mapPreviewUrl, staticFallbackSrc]);

    const handleMapImageError = () => {
        if (mapImageSrc === mapPreviewUrl && staticFallbackSrc && staticFallbackSrc !== mapImageSrc) {
            setMapImageSrc(staticFallbackSrc);
            return;
        }
        setMapImageSrc(null);
    };

    return (
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg cursor-pointer">
            {/* Map area */}
            <div
                className={`relative h-36 rounded-t-2xl overflow-hidden ${mapImageSrc ? 'bg-slate-100' : card.mapColor}`}
                style={mapViewTransitionName ? ({ viewTransitionName: mapViewTransitionName } as React.CSSProperties) : undefined}
            >
                {mapImageSrc ? (
                    <img
                        src={mapImageSrc}
                        alt={`Route map for ${card.title}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={handleMapImageError}
                    />
                ) : (
                    <>
                        {/* Decorative route dots */}
                        <div className={`absolute left-[20%] top-[30%] h-2.5 w-2.5 rounded-full ${card.mapAccent}`} />
                        <div className={`absolute left-[40%] top-[55%] h-2 w-2 rounded-full ${card.mapAccent} opacity-70`} />
                        <div className={`absolute left-[60%] top-[35%] h-3 w-3 rounded-full ${card.mapAccent}`} />
                        <div className={`absolute left-[75%] top-[60%] h-2 w-2 rounded-full ${card.mapAccent} opacity-60`} />
                        {/* Decorative route line */}
                        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 340 144" fill="none" preserveAspectRatio="none">
                            <path
                                d="M68 43 L136 79 L204 50 L255 86"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                                className="text-slate-400/40"
                            />
                        </svg>
                    </>
                )}
            </div>

            {/* Body */}
            <div className="p-4">
                <h3
                    className="text-base font-bold text-slate-900"
                    style={titleViewTransitionName ? ({ viewTransitionName: titleViewTransitionName } as React.CSSProperties) : undefined}
                >
                    {card.title}
                </h3>

                {/* Country flags + names */}
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                    {card.countries.map((c) => (
                        <span key={c.name} className="inline-flex items-center gap-1">
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                        </span>
                    ))}
                </div>

                {/* Stats row */}
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                        <Clock size={14} weight="duotone" className="text-accent-500" />
                        {card.durationDays} days
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <MapPin size={14} weight="duotone" className="text-accent-500" />
                        {card.cityCount} cities
                    </span>
                    {card.isRoundTrip ? (
                        <span className="inline-flex items-center gap-1">
                            <Repeat size={14} weight="duotone" className="text-accent-500" />
                            Round-trip
                        </span>
                    ) : null}
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* Mini calendar lane */}
            {cityLanes.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-2.5">
                    <div className="flex items-center gap-[2px]">
                        {cityLanes.map((cityLane, index) => {
                            const routeLane = routeLanes[index];
                            const laneName = getExampleCityLaneViewTransitionName(enableSharedTransition, index);
                            return (
                                <React.Fragment key={cityLane.id}>
                                    <span
                                        className="block h-[6px] rounded-[1px]"
                                        title={`${cityLane.title}: ${cityLane.nights} nights`}
                                        style={{
                                            flexGrow: cityLane.nights,
                                            flexBasis: 0,
                                            backgroundColor: cityLane.color,
                                            ...(laneName ? ({ viewTransitionName: laneName } as React.CSSProperties) : {}),
                                        }}
                                    />
                                    {routeLane && (
                                        <span
                                            className="block h-[3px] self-center rounded-[1px]"
                                            title={`Route leg: ${routeLane.durationDays.toFixed(2)} days`}
                                            style={{
                                                flexGrow: routeLane.durationDays,
                                                flexBasis: 0,
                                                backgroundColor: routeLane.color,
                                                opacity: 0.45,
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className={`${cityLanes.length > 0 ? '' : 'border-t border-slate-100'} px-4 py-3 flex items-center gap-2`}>
                <div className={`h-6 w-6 rounded-full ${card.avatarColor} flex items-center justify-center text-white text-[10px] font-bold`}>
                    {card.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-slate-500">{card.username}</span>
            </div>
        </article>
    );
};
