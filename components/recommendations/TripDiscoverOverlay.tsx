import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Sparkles, Trash2, X } from 'lucide-react';

import { Drawer, DrawerContent } from '../ui/drawer';
import { RecommendationSwipeDeck, type SwipeDecision } from './RecommendationSwipeDeck';
import { buildRecommendationDeck, loadRecommendationDataset } from '../../services/recommendationsService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    buildActivityFromSavedRecommendation,
    formatCostBandLabel,
    toSavedRecommendation,
    type Recommendation,
    type SavedRecommendation,
} from '../../shared/recommendations';
import type { ITimelineItem, ITrip, ITripRecommendationState } from '../../types';
import type { MobileDayPlanDay } from '../tripview/mobileDayPlanModel';

interface TripDiscoverOverlayProps {
    open: boolean;
    onClose: () => void;
    trip: ITrip;
    countryCodes: string[];
    days: MobileDayPlanDay[];
    canEdit: boolean;
    onRecommendationStateChange: (next: ITripRecommendationState) => void;
    onAddActivity: (item: Partial<ITimelineItem>) => void;
}

const EMPTY_STATE: ITripRecommendationState = { saved: [], dismissedIds: [] };

const readState = (trip: ITrip): ITripRecommendationState => ({
    saved: trip.recommendationState?.saved ?? [],
    dismissedIds: trip.recommendationState?.dismissedIds ?? [],
});

export const TripDiscoverOverlay: React.FC<TripDiscoverOverlayProps> = ({
    open,
    onClose,
    trip,
    countryCodes,
    days,
    canEdit,
    onRecommendationStateChange,
    onAddActivity,
}) => {
    const [tab, setTab] = useState<'discover' | 'saved'>('discover');
    const [pool, setPool] = useState<Recommendation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [lastDecision, setLastDecision] = useState<{ recommendation: Recommendation; decision: SwipeDecision } | null>(null);
    // The session owns the decisions and the trip is written through when it
    // can be. A shared or example trip cannot persist, and the deck still has
    // to respond to a swipe rather than sitting on the same card.
    const [state, setState] = useState<ITripRecommendationState>(() => readState(trip));

    const commitState = useCallback((next: ITripRecommendationState) => {
        setState(next);
        onRecommendationStateChange(next);
    }, [onRecommendationStateChange]);
    const savedIds = useMemo(() => new Set(state.saved.map((entry) => entry.recommendationId)), [state.saved]);
    const dismissedIds = useMemo(() => new Set(state.dismissedIds), [state.dismissedIds]);

    const cityNames = useMemo(
        () => trip.items
            .filter((item) => item.type === 'city')
            .map((item) => (item.title || item.location || '').trim())
            .filter(Boolean),
        [trip.items],
    );

    // Loading the dataset is a network/module fetch, which is exactly what an
    // effect is for; everything derived from it is computed during render.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setIsLoading(true);

        Promise.all(countryCodes.map((code) => loadRecommendationDataset(code)))
            .then((datasets) => {
                if (cancelled) return;
                setPool(datasets.flatMap((dataset) => dataset?.recommendations ?? []));
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [countryCodes, open]);

    const deck = useMemo(() => buildRecommendationDeck(
        pool.length > 0
            ? { countryCode: '', countryName: '', generatedAt: '', sourceName: null, recommendations: pool }
            : null,
        {
            cityNames,
            excludeIds: [...savedIds, ...dismissedIds],
        },
    ), [cityNames, dismissedIds, pool, savedIds]);

    const applyDecision = useCallback((recommendation: Recommendation, decision: SwipeDecision) => {
        const current = state;
        const next: ITripRecommendationState = decision === 'save'
            ? {
                saved: [...current.saved, toSavedRecommendation(recommendation, new Date().toISOString())],
                dismissedIds: current.dismissedIds,
            }
            : {
                saved: current.saved,
                dismissedIds: [...current.dismissedIds, recommendation.id],
            };
        setLastDecision({ recommendation, decision });
        commitState(next);
    }, [commitState, state]);

    const undoLastDecision = useCallback(() => {
        if (!lastDecision) return;
        trackEvent('trip_view__recommendation--undo', {
            trip_id: trip.id,
            recommendation_id: lastDecision.recommendation.id,
        });
        commitState({
            saved: state.saved.filter((entry) => entry.recommendationId !== lastDecision.recommendation.id),
            dismissedIds: state.dismissedIds.filter((id) => id !== lastDecision.recommendation.id),
        });
        setLastDecision(null);
    }, [commitState, lastDecision, state, trip.id]);

    const removeSaved = useCallback((recommendationId: string) => {
        commitState({
            saved: state.saved.filter((entry) => entry.recommendationId !== recommendationId),
            dismissedIds: state.dismissedIds,
        });
    }, [commitState, state]);

    const assignToDay = useCallback((saved: SavedRecommendation, day: MobileDayPlanDay) => {
        trackEvent('trip_view__recommendation--assign', {
            trip_id: trip.id,
            recommendation_id: saved.recommendationId,
            day_offset: day.dayOffset,
        });
        onAddActivity(buildActivityFromSavedRecommendation(saved, day.dayOffset));
        removeSaved(saved.recommendationId);
        setAssigningId(null);
    }, [onAddActivity, removeSaved, trip.id]);

    const savedCount = state.saved.length;

    return (
        <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DrawerContent
                accessibleTitle="Discover things to do"
                accessibleDescription="Swipe through recommendations for this trip and keep the ones you want."
                className="flex h-[92dvh] flex-col"
            >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-2">
                    <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5">
                        <button
                            type="button"
                            onClick={() => setTab('discover')}
                            aria-pressed={tab === 'discover'}
                            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${tab === 'discover' ? 'bg-white text-accent-600 shadow-sm' : 'text-slate-500'}`}
                            {...getAnalyticsDebugAttributes('trip_view__recommendation_tab--discover', { trip_id: trip.id })}
                        >
                            <Sparkles size={15} />
                            Discover
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('saved')}
                            aria-pressed={tab === 'saved'}
                            data-testid="recommendation-saved-tab"
                            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${tab === 'saved' ? 'bg-white text-accent-600 shadow-sm' : 'text-slate-500'}`}
                            {...getAnalyticsDebugAttributes('trip_view__recommendation_tab--saved', { trip_id: trip.id })}
                        >
                            Kept
                            {savedCount > 0 && (
                                <span className="rounded-full bg-accent-600 px-1.5 text-[11px] font-bold text-white">{savedCount}</span>
                            )}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label="Close discover"
                    >
                        <X size={18} />
                    </button>
                </header>

                {tab === 'discover' ? (
                    isLoading ? (
                        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                            Loading ideas…
                        </div>
                    ) : (
                        <RecommendationSwipeDeck
                            tripId={trip.id}
                            recommendations={deck}
                            onDecide={applyDecision}
                            onUndo={undoLastDecision}
                            canUndo={Boolean(lastDecision)}
                            emptyState={pool.length === 0 ? (
                                <>
                                    <p className="text-base font-semibold text-slate-900">No ideas for this trip yet</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Recommendations are available for Taiwan so far.
                                    </p>
                                </>
                            ) : undefined}
                        />
                    )
                ) : (
                    <div data-testid="recommendation-saved-list" className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                        {savedCount === 0 ? (
                            <p className="py-10 text-center text-sm text-slate-500">
                                Nothing kept yet. Swipe right on an idea to park it here.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {state.saved.map((saved) => (
                                    <li key={saved.recommendationId} className="rounded-2xl border border-slate-200 bg-white p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-[15px] font-semibold text-slate-900">{saved.title}</p>
                                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                                    {[saved.cityName, formatCostBandLabel(saved.costBand)].filter(Boolean).join(' · ')}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeSaved(saved.recommendationId)}
                                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
                                                aria-label={`Remove ${saved.title}`}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>

                                        {canEdit && (
                                            assigningId === saved.recommendationId ? (
                                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                    {days.map((day) => (
                                                        <button
                                                            key={day.dayOffset}
                                                            type="button"
                                                            onClick={() => assignToDay(saved, day)}
                                                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-700"
                                                        >
                                                            {day.weekdayLabel} {day.dayOfMonthLabel}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setAssigningId(null)}
                                                        className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-500"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setAssigningId(saved.recommendationId)}
                                                    data-testid="recommendation-assign"
                                                    className="mt-2.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50 px-3 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-100"
                                                >
                                                    <CalendarPlus size={14} />
                                                    Add to a day
                                                </button>
                                            )
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    );
};

export const EMPTY_RECOMMENDATION_STATE = EMPTY_STATE;
