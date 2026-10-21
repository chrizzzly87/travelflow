import React, { useCallback, useMemo, useState } from 'react';
import {
    AnimatePresence,
    LazyMotion,
    domMax,
    m,
    useMotionValue,
    useTransform,
    type PanInfo,
    type Variants,
} from 'framer-motion';
import { Check, RotateCcw, X } from 'lucide-react';

import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { RecommendationCardFace } from './RecommendationCardContent';
import type { Recommendation } from '../../shared/recommendations';

/**
 * Distance past which a release commits, and the flick speed that commits
 * regardless of distance. Without the velocity test a quick flick that barely
 * travels springs back, which is what makes a deck feel unresponsive.
 */
const COMMIT_DISTANCE_PX = 110;
const COMMIT_VELOCITY = 500;
const MAX_ROTATION_DEG = 14;
/** Cards drawn at once: the top one plus the two staggered behind it. */
const VISIBLE_STACK = 3;

/**
 * How far back each card sits.
 *
 * Scaling alone hides the cards behind, because a card shrinks around its own
 * centre and its bottom edge moves *up*. The downward offset has to outrun
 * that to leave a visible sliver, which is what makes the deck read as a deck.
 */
const STACK_SCALE_STEP = 0.05;
const STACK_OFFSET_PX = 26;

const stackScale = (depth: number): number => Math.max(0.8, 1 - depth * STACK_SCALE_STEP);
const stackOffset = (depth: number): number => depth * STACK_OFFSET_PX;

/** One spring for the whole stack, so promotion looks like a single motion. */
const STACK_TRANSITION = { type: 'spring', stiffness: 260, damping: 30, mass: 0.7 } as const;

export type SwipeDecision = 'save' | 'dismiss';

/**
 * `exit` reads the direction through `custom` rather than a closure: the
 * decision and the new list land in the same render, so a closed-over value
 * would still hold the previous card's direction when the exit runs.
 */
const CARD_VARIANTS: Variants = {
    exit: (direction: SwipeDecision | null) => ({
        x: direction === 'dismiss' ? -560 : 560,
        rotate: direction === 'dismiss' ? -22 : 22,
        opacity: 0,
        transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
    }),
};

/**
 * One card in the stack.
 *
 * The same component covers every depth, and only its `depth` prop changes as
 * the deck advances. That is deliberate: React keeps the element, so framer
 * animates the promoted card from where it stood to the front instead of it
 * popping into place. It also means every card — not only the front one —
 * renders its real content, so nothing appears for the first time mid-swipe.
 */
const StackCard: React.FC<{
    recommendation: Recommendation;
    tripId: string;
    depth: number;
    exitDirection: SwipeDecision | null;
    onCommit: (recommendation: Recommendation, decision: SwipeDecision) => void;
}> = ({ recommendation, tripId, depth, exitDirection, onCommit }) => {
    const isTop = depth === 0;
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-240, 0, 240], [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG]);
    const keepOpacity = useTransform(x, [30, 130], [0, 1]);
    const skipOpacity = useTransform(x, [-130, -30], [1, 0]);

    const handleDragEnd = useCallback((_event: unknown, info: PanInfo) => {
        const travelled = info.offset.x;
        const flicked = Math.abs(info.velocity.x) > COMMIT_VELOCITY;
        if (Math.abs(travelled) < COMMIT_DISTANCE_PX && !flicked) return;
        onCommit(recommendation, travelled > 0 || info.velocity.x > 0 ? 'save' : 'dismiss');
    }, [onCommit, recommendation]);

    return (
        <m.div
            data-testid={isTop ? 'recommendation-card' : 'recommendation-card-behind'}
            data-recommendation-id={recommendation.id}
            aria-hidden={isTop ? undefined : 'true'}
            aria-label={isTop ? `${recommendation.title}. Swipe, or use the left and right arrow keys.` : undefined}
            drag={isTop ? 'x' : false}
            dragSnapToOrigin
            dragElastic={0.65}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            style={{ x, rotate, zIndex: VISIBLE_STACK - depth }}
            custom={exitDirection}
            variants={CARD_VARIANTS}
            initial={{ scale: stackScale(depth + 1), y: stackOffset(depth + 1), opacity: 0 }}
            animate={{ scale: stackScale(depth), y: stackOffset(depth), opacity: 1 }}
            transition={STACK_TRANSITION}
            exit="exit"
            className={`absolute inset-0 flex select-none flex-col overflow-hidden rounded-3xl border border-border bg-card ${
                isTop
                    ? 'cursor-grab touch-pan-y shadow-xl active:cursor-grabbing'
                    : 'pointer-events-none shadow-md'
            }`}
        >
            {isTop && (
                <>
                    <m.span
                        aria-hidden="true"
                        style={{ opacity: keepOpacity }}
                        className="absolute top-4 start-4 z-10 rounded-lg border-[3px] border-emerald-500 bg-card/80 px-2.5 py-0.5 text-sm font-black uppercase tracking-wider text-emerald-600"
                    >
                        Keep
                    </m.span>
                    <m.span
                        aria-hidden="true"
                        style={{ opacity: skipOpacity }}
                        className="absolute top-4 end-4 z-10 rounded-lg border-[3px] border-rose-500 bg-card/80 px-2.5 py-0.5 text-sm font-black uppercase tracking-wider text-rose-600"
                    >
                        Skip
                    </m.span>
                </>
            )}

            <RecommendationCardFace recommendation={recommendation} tripId={tripId} interactive={isTop} />
        </m.div>
    );
};

interface RecommendationSwipeDeckProps {
    tripId: string;
    recommendations: Recommendation[];
    onDecide: (recommendation: Recommendation, decision: SwipeDecision) => void;
    onUndo?: () => void;
    canUndo?: boolean;
    emptyState?: React.ReactNode;
}

export const RecommendationSwipeDeck: React.FC<RecommendationSwipeDeckProps> = ({
    tripId,
    recommendations,
    onDecide,
    onUndo,
    canUndo = false,
    emptyState,
}) => {
    const [exitDirection, setExitDirection] = useState<SwipeDecision | null>(null);

    const stack = useMemo(() => recommendations.slice(0, VISIBLE_STACK), [recommendations]);
    const top = stack[0] ?? null;
    // Counting what is still in front of the traveller, the current card
    // included: "1 left" on the last card is what makes the deck finite.
    const remaining = recommendations.length;
    const remainingLabel = remaining === 1 ? '1 idea left' : `${remaining} ideas left`;

    const commit = useCallback((recommendation: Recommendation, decision: SwipeDecision) => {
        trackEvent('trip_view__recommendation--decide', {
            trip_id: tripId,
            recommendation_id: recommendation.id,
            decision,
        });
        setExitDirection(decision);
        onDecide(recommendation, decision);
    }, [onDecide, tripId]);

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
                        <p className="text-base font-semibold text-foreground">That is everything for now</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            You have been through every idea we have for this trip.
                        </p>
                    </>
                )}
                {canUndo && onUndo && (
                    <button
                        type="button"
                        onClick={onUndo}
                        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
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
                <p
                    data-testid="recommendation-remaining"
                    className="shrink-0 pt-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                    {remainingLabel}
                </p>

                <div className="flex flex-1 items-center justify-center px-4 py-2">
                    {/* The box leaves room under the stack for the staggered
                      * cards, so the deepest one is not clipped by the frame. */}
                    <div
                        className="relative w-full max-w-[26rem]"
                        style={{ height: `min(36rem, 100% - ${stackOffset(VISIBLE_STACK - 1)}px)` }}
                    >
                        {/* One presence for the whole deck. Nesting it inside the
                          * loop meant it unmounted together with its own child,
                          * so the exit animation never ran.
                          *
                          * No `popLayout`: it wraps each child in a component
                          * that hands it a ref, and preact/compat drops refs on
                          * function components. The cards are absolutely
                          * positioned anyway, so a leaving card displaces
                          * nothing and there is no layout to pop out of. */}
                        <AnimatePresence initial={false} custom={exitDirection}>
                            {stack.map((recommendation, depth) => (
                                <StackCard
                                    key={recommendation.id}
                                    recommendation={recommendation}
                                    tripId={tripId}
                                    depth={depth}
                                    exitDirection={exitDirection}
                                    onCommit={commit}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-center gap-5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                    <button
                        type="button"
                        onClick={() => commit(top, 'dismiss')}
                        data-testid="recommendation-dismiss"
                        className="inline-flex size-14 items-center justify-center rounded-full border-2 border-rose-200 bg-card text-rose-500 shadow-sm transition-transform hover:scale-105 active:scale-95 dark:border-rose-400/30 dark:shadow-none"
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
                        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40 dark:text-foreground"
                        aria-label="Undo last decision"
                    >
                        <RotateCcw size={16} />
                    </button>

                    <button
                        type="button"
                        onClick={() => commit(top, 'save')}
                        data-testid="recommendation-save"
                        className="inline-flex size-14 items-center justify-center rounded-full border-2 border-emerald-200 bg-card text-emerald-600 shadow-sm transition-transform hover:scale-105 active:scale-95 dark:border-emerald-400/30 dark:shadow-none"
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
