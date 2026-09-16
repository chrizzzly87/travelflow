import React, { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, LazyMotion, domMax, m, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Check, MapPin, RotateCcw, X } from 'lucide-react';

import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildRecommendationMapUrl, buildRecommendationPhotoUrl } from './recommendationCardMedia';
import { formatCostBandLabel, type Recommendation } from '../../shared/recommendations';

/**
 * Distance past which a release commits, and the flick speed that commits
 * regardless of distance. Without the velocity test a quick flick that barely
 * travels springs back, which is what makes a deck feel unresponsive.
 */
const COMMIT_DISTANCE_PX = 110;
const COMMIT_VELOCITY = 500;
const MAX_ROTATION_DEG = 14;
/** Cards drawn behind the top one, so the stack reads as a stack. */
const VISIBLE_STACK = 3;

export type SwipeDecision = 'save' | 'dismiss';

interface RecommendationSwipeDeckProps {
    tripId: string;
    recommendations: Recommendation[];
    onDecide: (recommendation: Recommendation, decision: SwipeDecision) => void;
    onUndo?: () => void;
    canUndo?: boolean;
    emptyState?: React.ReactNode;
}

const formatDuration = (minutes: number | null): string | null => {
    if (!minutes || minutes <= 0) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
};

const CardMedia: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
    const [photoFailed, setPhotoFailed] = useState(false);
    const [mapFailed, setMapFailed] = useState(false);
    const photoUrl = photoFailed ? null : buildRecommendationPhotoUrl(recommendation);
    const mapUrl = mapFailed ? null : buildRecommendationMapUrl(recommendation);

    return (
        <div className="relative h-40 shrink-0 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
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
                    className="absolute bottom-2 end-2 size-16 rounded-xl border-2 border-white object-cover shadow-md"
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

const CardBody: React.FC<{ recommendation: Recommendation }> = ({ recommendation }) => {
    const durationLabel = formatDuration(recommendation.typicalDurationMinutes);
    const costLabel = formatCostBandLabel(recommendation.costBand);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-3 pt-3">
            <h2 className="text-[19px] font-semibold leading-tight tracking-tight text-slate-900">
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
                    <span className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {costLabel}
                    </span>
                )}
                {durationLabel && (
                    <span className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {durationLabel}
                    </span>
                )}
            </div>

            {recommendation.description && (
                <p className="text-[13px] leading-5 text-slate-600">{recommendation.description}</p>
            )}

            {(recommendation.location.formattedAddress || recommendation.location.address) && (
                <p className="flex items-start gap-1 text-[11px] leading-4 text-slate-400">
                    <MapPin size={11} className="mt-0.5 shrink-0" />
                    <span className="line-clamp-2">
                        {recommendation.location.formattedAddress || recommendation.location.address}
                    </span>
                </p>
            )}

            {recommendation.sources.length > 0 && (
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">via</span>
                    {recommendation.sources.slice(0, 3).map((source, index) => {
                        const label = source.handle ?? 'source';
                        const key = `${source.url ?? label}-${index}`;
                        if (!source.url) {
                            return <span key={key} className="text-[11px] text-slate-500">{label}</span>;
                        }
                        return (
                            <a
                                key={key}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                onPointerDown={(event) => event.stopPropagation()}
                                className="text-[11px] font-medium text-accent-700 underline decoration-accent-300 underline-offset-2"
                            >
                                {label}
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const RecommendationSwipeDeck: React.FC<RecommendationSwipeDeckProps> = ({
    tripId,
    recommendations,
    onDecide,
    onUndo,
    canUndo = false,
    emptyState,
}) => {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-240, 0, 240], [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG]);
    const keepOpacity = useTransform(x, [30, 130], [0, 1]);
    const skipOpacity = useTransform(x, [-130, -30], [1, 0]);
    const [exitDirection, setExitDirection] = useState<SwipeDecision | null>(null);

    const stack = useMemo(() => recommendations.slice(0, VISIBLE_STACK), [recommendations]);
    const top = stack[0] ?? null;

    const commit = useCallback((recommendation: Recommendation, decision: SwipeDecision) => {
        trackEvent('trip_view__recommendation--decide', {
            trip_id: tripId,
            recommendation_id: recommendation.id,
            decision,
        });
        setExitDirection(decision);
        onDecide(recommendation, decision);
        // The next card starts centred, not wherever the last one was released.
        x.set(0);
    }, [onDecide, tripId, x]);

    const handleDragEnd = useCallback((_event: unknown, info: PanInfo) => {
        if (!top) return;
        const travelled = info.offset.x;
        const flicked = Math.abs(info.velocity.x) > COMMIT_VELOCITY;
        if (Math.abs(travelled) < COMMIT_DISTANCE_PX && !flicked) {
            x.set(0);
            return;
        }
        commit(top, travelled > 0 || info.velocity.x > 0 ? 'save' : 'dismiss');
    }, [commit, top, x]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!top) return;
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            commit(top, 'save');
            return;
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            commit(top, 'dismiss');
        }
    }, [commit, top]);

    if (!top) {
        return (
            <div data-testid="recommendation-deck-empty" className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                {emptyState ?? (
                    <>
                        <p className="text-base font-semibold text-slate-900">That is everything for now</p>
                        <p className="mt-1 text-sm text-slate-500">
                            You have been through every idea we have for this trip.
                        </p>
                    </>
                )}
                {canUndo && onUndo && (
                    <button
                        type="button"
                        onClick={onUndo}
                        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <RotateCcw size={15} />
                        Undo last
                    </button>
                )}
            </div>
        );
    }

    return (
        <LazyMotion features={domMax} strict>
            <div className="flex flex-1 flex-col" onKeyDown={handleKeyDown}>
                <div className="flex flex-1 items-center justify-center px-5 py-2">
                  <div className="relative h-[min(27rem,100%)] w-full max-w-sm">
                    {/* Drawn back to front so the top card paints last. */}
                    {stack.map((recommendation, index) => {
                        const isTop = index === 0;

                        if (!isTop) {
                            return (
                                <m.div
                                    key={recommendation.id}
                                    aria-hidden="true"
                                    data-testid="recommendation-card-behind"
                                    initial={false}
                                    animate={{
                                        scale: 1 - index * 0.04,
                                        y: index * 10,
                                        opacity: 1,
                                    }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                                    className="absolute inset-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md"
                                    style={{ zIndex: VISIBLE_STACK - index }}
                                >
                                    <CardMedia recommendation={recommendation} />
                                </m.div>
                            );
                        }

                        return (
                            <AnimatePresence key={recommendation.id} initial={false} mode="popLayout">
                                <m.div
                                    data-testid="recommendation-card"
                                    data-recommendation-id={recommendation.id}
                                    aria-label={`${recommendation.title}. Swipe, or use the left and right arrow keys.`}
                                    drag="x"
                                    dragSnapToOrigin
                                    dragElastic={0.7}
                                    dragConstraints={{ left: 0, right: 0 }}
                                    onDragEnd={handleDragEnd}
                                    style={{ x, rotate, zIndex: VISIBLE_STACK + 1 }}
                                    initial={{ scale: 0.96, y: 10, opacity: 0 }}
                                    animate={{ scale: 1, y: 0, opacity: 1 }}
                                    exit={{
                                        x: exitDirection === 'dismiss' ? -520 : 520,
                                        rotate: exitDirection === 'dismiss' ? -18 : 18,
                                        opacity: 0,
                                        transition: { duration: 0.22, ease: 'easeOut' },
                                    }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                                    className="absolute inset-0 flex cursor-grab touch-pan-y select-none flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl active:cursor-grabbing"
                                >
                                    <m.span
                                        aria-hidden="true"
                                        style={{ opacity: keepOpacity }}
                                        className="absolute top-4 start-4 z-10 rounded-lg border-[3px] border-emerald-500 px-2.5 py-0.5 text-sm font-black uppercase tracking-wider text-emerald-600"
                                    >
                                        Keep
                                    </m.span>
                                    <m.span
                                        aria-hidden="true"
                                        style={{ opacity: skipOpacity }}
                                        className="absolute top-4 end-4 z-10 rounded-lg border-[3px] border-rose-500 px-2.5 py-0.5 text-sm font-black uppercase tracking-wider text-rose-600"
                                    >
                                        Skip
                                    </m.span>

                                    <CardMedia recommendation={recommendation} />
                                    <CardBody recommendation={recommendation} />
                                </m.div>
                            </AnimatePresence>
                        );
                    })}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-center gap-5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                    <button
                        type="button"
                        onClick={() => commit(top, 'dismiss')}
                        data-testid="recommendation-dismiss"
                        className="inline-flex size-14 items-center justify-center rounded-full border-2 border-rose-200 bg-white text-rose-500 shadow-sm transition-transform hover:scale-105 active:scale-95"
                        aria-label={`Skip ${top.title}`}
                        {...getAnalyticsDebugAttributes('trip_view__recommendation--decide', { trip_id: tripId, decision: 'dismiss' })}
                    >
                        <X size={22} />
                    </button>

                    <button
                        type="button"
                        onClick={onUndo}
                        disabled={!canUndo || !onUndo}
                        data-testid="recommendation-undo"
                        className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        aria-label="Undo last decision"
                    >
                        <RotateCcw size={16} />
                    </button>

                    <button
                        type="button"
                        onClick={() => commit(top, 'save')}
                        data-testid="recommendation-save"
                        className="inline-flex size-14 items-center justify-center rounded-full border-2 border-emerald-200 bg-white text-emerald-600 shadow-sm transition-transform hover:scale-105 active:scale-95"
                        aria-label={`Keep ${top.title}`}
                        {...getAnalyticsDebugAttributes('trip_view__recommendation--decide', { trip_id: tripId, decision: 'save' })}
                    >
                        <Check size={22} />
                    </button>
                </div>
            </div>
        </LazyMotion>
    );
};
