import React, { useMemo, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { useDirectionsChooser } from '../maps/useDirectionsChooser';
import { buildRecommendationMapUrl, buildRecommendationPhotoUrl } from './recommendationCardMedia';
import { formatCostBandLabel, type Recommendation } from '../../shared/recommendations';

export const formatRecommendationDuration = (minutes: number | null): string | null => {
    if (!minutes || minutes <= 0) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
};

export const RecommendationCardMedia: React.FC<{
    recommendation: Recommendation;
    className?: string;
}> = ({ recommendation, className }) => {
    const [photoFailed, setPhotoFailed] = useState(false);
    const [mapFailed, setMapFailed] = useState(false);
    const photoUrl = photoFailed ? null : buildRecommendationPhotoUrl(recommendation);
    const mapUrl = mapFailed ? null : buildRecommendationMapUrl(recommendation);

    return (
        <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 ${className ?? 'h-56'}`}>
            {photoUrl ? (
                <img
                    src={photoUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onError={() => setPhotoFailed(true)}
                    className="size-full object-cover"
                />
            ) : mapUrl ? (
                <img
                    src={mapUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onError={() => setMapFailed(true)}
                    className="size-full object-cover"
                />
            ) : (
                <div className="flex size-full items-center justify-center text-slate-300">
                    <MapPin size={28} />
                </div>
            )}

            {/* The map is always present: as the hero when there is no photo,
              * and as an inset alongside one, so every card places itself. */}
            {photoUrl && mapUrl && (
                <img
                    src={mapUrl}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    data-testid="recommendation-card-map"
                    onError={() => setMapFailed(true)}
                    className="absolute bottom-2 end-2 size-20 rounded-xl border-2 border-white object-cover shadow-md"
                />
            )}

            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />

            {recommendation.cityName && (
                <p className="absolute bottom-2 start-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white drop-shadow">
                    {recommendation.cityName}
                </p>
            )}

            {recommendation.image?.attribution && (
                <p className="absolute top-2 start-3 max-w-[60%] truncate text-[10px] font-medium text-white/85 drop-shadow">
                    Photo: {recommendation.image.attribution}
                </p>
            )}
        </div>
    );
};

export const RecommendationCardBody: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
    const durationLabel = formatRecommendationDuration(recommendation.typicalDurationMinutes);
    const costLabel = formatCostBandLabel(recommendation.costBand);
    const highlights = recommendation.highlights ?? [];

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-4 pt-3.5">
            <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-foreground">
                {recommendation.title}
            </h2>

            <div className="flex flex-wrap items-center gap-1">
                {recommendation.activityTypes.slice(0, 3).map((type) => (
                    <span
                        key={type}
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getActivityTypePaletteClass(type)}`}
                    >
                        <ActivityTypeIcon type={type} size={11} />
                        {formatActivityTypeLabel(type)}
                    </span>
                ))}
                {costLabel && (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {costLabel}
                    </span>
                )}
                {durationLabel && (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {durationLabel}
                    </span>
                )}
            </div>

            {recommendation.description && (
                <p className="whitespace-pre-line text-[13.5px] leading-[1.5] text-muted-foreground">
                    {recommendation.description}
                </p>
            )}

            {highlights.length > 0 && (
                <div data-testid="recommendation-highlights" className="rounded-2xl bg-secondary px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Recommendations
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                        {highlights.map((highlight) => (
                            <li key={highlight} className="flex gap-1.5 text-[12.5px] leading-[1.45] text-foreground">
                                <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-accent-500" />
                                <span>{highlight}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

/**
 * Who recommended this, with a link out.
 *
 * It used to sit at the foot of every swipe card, where it competed with the
 * address for the one line that matters while deciding. It belongs on the
 * full card, which is where somebody is actually reading.
 */
export const RecommendationSources: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
    if (recommendation.sources.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">via</span>
            {recommendation.sources.slice(0, 3).map((source, index) => {
                const label = source.handle ?? 'source';
                const key = `${source.url ?? label}-${index}`;
                if (!source.url) {
                    return <span key={key} className="text-[11px] text-muted-foreground">{label}</span>;
                }
                return (
                    <a
                        key={key}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-[11px] font-medium text-accent-700 underline decoration-accent-300 underline-offset-2"
                    >
                        {label}
                    </a>
                );
            })}
        </div>
    );
};

/**
 * The address, pinned to the bottom of the card and tappable.
 *
 * It sits in the footer rather than in the scrolling body so a long
 * description never pushes "where is this" out of sight, and it opens the
 * traveller's own map app through the same chooser the itinerary uses.
 */
export const RecommendationLocationFooter: React.FC<{
    recommendation: Recommendation;
    tripId: string;
}> = ({ recommendation, tripId }) => {
    const address = recommendation.location.formattedAddress
        || recommendation.location.address
        || recommendation.cityName;
    const target = useMemo(() => ({
        label: [recommendation.title, recommendation.cityName].filter(Boolean).join(', '),
        coordinates: typeof recommendation.location.lat === 'number' && typeof recommendation.location.lng === 'number'
            ? { lat: recommendation.location.lat, lng: recommendation.location.lng }
            : null,
    }), [recommendation.cityName, recommendation.location.lat, recommendation.location.lng, recommendation.title]);

    const { links, isChooserOpen, setIsChooserOpen, openDirections, chooseApp } = useDirectionsChooser(
        target,
        { tripId, itemId: recommendation.id },
    );

    if (!address && !links) return null;

    return (
        <>
            <button
                type="button"
                // The card is dragged by a pointer capture on its container, so
                // the tap has to be claimed here or it never reaches this button.
                onPointerDown={(event) => event.stopPropagation()}
                onClick={openDirections}
                disabled={!links}
                data-testid="recommendation-card-address"
                className="flex w-full shrink-0 items-center gap-2 border-t border-border bg-card/95 px-4 py-3 text-start backdrop-blur transition-colors hover:bg-secondary disabled:cursor-default disabled:hover:bg-card/95"
                aria-label={links ? `Open ${recommendation.title} in Maps` : undefined}
            >
                <MapPin size={14} className="shrink-0 text-accent-600" />
                <span className="min-w-0 flex-1 truncate text-[12px] leading-4 text-muted-foreground">
                    {address}
                </span>
                {links && <Navigation size={14} className="shrink-0 text-muted-foreground" />}
            </button>

            <Dialog open={isChooserOpen} onOpenChange={setIsChooserOpen}>
                <DialogContent size="sm">
                    <div className="p-4">
                        <DialogTitle className="text-base font-semibold text-foreground">Open in</DialogTitle>
                        <p className="truncate text-sm text-muted-foreground">{recommendation.title}</p>
                        <div className="mt-4 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => chooseApp('apple')}
                                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                            >
                                Apple Maps
                            </button>
                            <button
                                type="button"
                                onClick={() => chooseApp('google')}
                                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                            >
                                Google Maps
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

/**
 * Everything inside a card, with no positioning or gesture of its own.
 *
 * The deck renders this for the top card and for the cards behind it, and the
 * kept pool renders it in a modal. Drawing the cards behind with their real
 * content is what stops the text appearing only after a swipe lands.
 */
export const RecommendationCardFace: React.FC<{
    recommendation: Recommendation;
    tripId: string;
    interactive?: boolean;
    /** Slotted between the body and the pinned footer, which stays last. */
    beforeFooter?: React.ReactNode;
}> = ({ recommendation, tripId, interactive = true, beforeFooter }) => (
    <>
        <RecommendationCardMedia recommendation={recommendation} />
        <RecommendationCardBody recommendation={recommendation} />
        {beforeFooter}
        {interactive
            ? <RecommendationLocationFooter recommendation={recommendation} tripId={tripId} />
            : <StaticLocationFooter recommendation={recommendation} />}
    </>
);

/** The same footer without a target: the cards behind must not be tappable. */
const StaticLocationFooter: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
    const address = recommendation.location.formattedAddress
        || recommendation.location.address
        || recommendation.cityName;
    if (!address) return null;
    return (
        <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card/95 px-4 py-3">
            <MapPin size={14} className="shrink-0 text-accent-600" />
            <span className="min-w-0 flex-1 truncate text-[12px] leading-4 text-muted-foreground">{address}</span>
        </div>
    );
};
