import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Check, MapPin, RotateCcw, X } from 'lucide-react';

import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { formatCostBandLabel, type Recommendation } from '../../shared/recommendations';

/** Horizontal travel past which a release commits the swipe. */
const COMMIT_DISTANCE_PX = 96;
const MAX_ROTATION_DEG = 12;

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

export const RecommendationSwipeDeck: React.FC<RecommendationSwipeDeckProps> = ({
    tripId,
    recommendations,
    onDecide,
    onUndo,
    canUndo = false,
    emptyState,
}) => {
    const [drag, setDrag] = useState<{ pointerId: number; dx: number; committing: SwipeDecision | null } | null>(null);
    const dragStartRef = useRef<{ pointerId: number; x: number } | null>(null);

    const top = recommendations[0] ?? null;
    const next = recommendations[1] ?? null;

    const commit = useCallback((recommendation: Recommendation, decision: SwipeDecision) => {
        trackEvent('trip_view__recommendation--decide', {
            trip_id: tripId,
            recommendation_id: recommendation.id,
            decision,
        });
        setDrag(null);
        dragStartRef.current = null;
        onDecide(recommendation, decision);
    }, [onDecide, tripId]);

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!top) return;
        dragStartRef.current = { pointerId: event.pointerId, x: event.clientX };
        setDrag({ pointerId: event.pointerId, dx: 0, committing: null });
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }, [top]);

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const start = dragStartRef.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const dx = event.clientX - start.x;
        setDrag({ pointerId: event.pointerId, dx, committing: null });
    }, []);

    const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const start = dragStartRef.current;
        dragStartRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (!start || !top) {
            setDrag(null);
            return;
        }
        const dx = event.clientX - start.x;
        if (Math.abs(dx) < COMMIT_DISTANCE_PX) {
            setDrag(null);
            return;
        }
        commit(top, dx > 0 ? 'save' : 'dismiss');
    }, [commit, top]);

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

    const dx = drag?.dx ?? 0;
    const intent: SwipeDecision | null = Math.abs(dx) < 24 ? null : (dx > 0 ? 'save' : 'dismiss');
    const cardStyle: React.CSSProperties = drag
        ? {
            transform: `translateX(${dx}px) rotate(${Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, dx / 12))}deg)`,
            transition: 'none',
        }
        : { transform: 'translateX(0) rotate(0deg)' };

    const durationLabel = useMemo(() => formatDuration(top?.typicalDurationMinutes ?? null), [top]);
    const costLabel = formatCostBandLabel(top?.costBand ?? null);

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
        <div className="flex flex-1 flex-col" onKeyDown={handleKeyDown}>
            <div className="relative flex-1 px-4 pb-2 pt-1">
                {next && (
                    <article
                        aria-hidden="true"
                        className="absolute inset-x-4 inset-y-1 scale-[0.96] rounded-3xl border border-slate-200 bg-white opacity-60"
                    />
                )}

                <div
                    aria-label={`${top.title}. Swipe, or use the left and right arrow keys.`}
                    data-testid="recommendation-card"
                    data-recommendation-id={top.id}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={cardStyle}
                    className="relative flex h-full touch-pan-y select-none flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg transition-transform duration-200 ease-out motion-reduce:transition-none"
                >
                    {intent && (
                        <span
                            aria-hidden="true"
                            className={`absolute top-4 z-10 rounded-lg border-2 px-3 py-1 text-sm font-black uppercase tracking-wider ${
                                intent === 'save'
                                    ? 'start-4 -rotate-12 border-emerald-500 text-emerald-600'
                                    : 'end-4 rotate-12 border-rose-500 text-rose-600'
                            }`}
                        >
                            {intent === 'save' ? 'Keep' : 'Skip'}
                        </span>
                    )}

                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 pt-6">
                        {top.cityName && (
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {top.cityName}
                            </p>
                        )}
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                            {top.title}
                        </h2>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {top.activityTypes.map((type) => (
                                <span
                                    key={type}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getActivityTypePaletteClass(type)}`}
                                >
                                    <ActivityTypeIcon type={type} size={12} />
                                    {formatActivityTypeLabel(type)}
                                </span>
                            ))}
                            {costLabel && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {costLabel}
                                </span>
                            )}
                            {durationLabel && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {durationLabel}
                                </span>
                            )}
                        </div>

                        {top.description && (
                            <p className="mt-4 text-[15px] leading-6 text-slate-700">{top.description}</p>
                        )}

                        {top.location.formattedAddress && (
                            <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-500">
                                <MapPin size={13} className="mt-0.5 shrink-0" />
                                <span className="break-words">{top.location.formattedAddress}</span>
                            </p>
                        )}

                        {top.sources.length > 0 && (
                            <div className="mt-auto pt-5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    Saved from
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {top.sources.map((source, index) => {
                                        const label = source.handle ?? 'source';
                                        const key = `${source.url ?? label}-${index}`;
                                        if (!source.url) {
                                            return (
                                                <span key={key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                    {label}
                                                </span>
                                            );
                                        }
                                        return (
                                            <a
                                                key={key}
                                                href={source.url}
                                                target="_blank"
                                                rel="noopener noreferrer nofollow"
                                                onClick={(event) => event.stopPropagation()}
                                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-accent-700 underline decoration-accent-300 underline-offset-2"
                                            >
                                                {label}
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex shrink-0 items-center justify-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
                <button
                    type="button"
                    onClick={() => commit(top, 'dismiss')}
                    data-testid="recommendation-dismiss"
                    className="inline-flex size-14 items-center justify-center rounded-full border-2 border-rose-200 bg-white text-rose-500 shadow-sm transition-colors hover:bg-rose-50"
                    aria-label={`Skip ${top.title}`}
                    {...getAnalyticsDebugAttributes('trip_view__recommendation--decide', { trip_id: tripId, decision: 'dismiss' })}
                >
                    <X size={24} />
                </button>

                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo || !onUndo}
                    data-testid="recommendation-undo"
                    className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Undo last decision"
                >
                    <RotateCcw size={17} />
                </button>

                <button
                    type="button"
                    onClick={() => commit(top, 'save')}
                    data-testid="recommendation-save"
                    className="inline-flex size-14 items-center justify-center rounded-full border-2 border-emerald-200 bg-white text-emerald-600 shadow-sm transition-colors hover:bg-emerald-50"
                    aria-label={`Keep ${top.title}`}
                    {...getAnalyticsDebugAttributes('trip_view__recommendation--decide', { trip_id: tripId, decision: 'save' })}
                >
                    <Check size={24} />
                </button>
            </div>
        </div>
    );
};
