import React, { useEffect, useReducer, useRef } from 'react';
import { FeaturesAirportBentoVisual } from './FeaturesAirportBentoVisual';

/**
 * Fraction of the band on screen before the split-flap boards start turning. Kept
 * high on purpose: the flip is the payoff, and it should not happen off the edge
 * of the screen where nobody sees it.
 */
const VISIBLE_AREA_RATIO = 0.72;
/** A much smaller fraction, plus this margin, is enough to start the airport lookup. */
const PREFETCH_AREA_RATIO = 0.14;
const PREFETCH_MARGIN_PX = 180;

interface AirportVisibilityState {
    lookupPrimed: boolean;
    visualActive: boolean;
}

type AirportVisibilityAction = 'lookup' | 'visual' | 'all';

const airportVisibilityReducer = (
    state: AirportVisibilityState,
    action: AirportVisibilityAction,
): AirportVisibilityState => {
    switch (action) {
        case 'all':
            return { lookupPrimed: true, visualActive: true };
        case 'lookup':
            return { ...state, lookupPrimed: true };
        case 'visual':
            return { ...state, visualActive: true };
        default:
            return state;
    }
};

interface FeaturesAirportBandProps {
    title: string;
    description: string;
    originLabel: string;
    destinationLabel: string;
}

export const FeaturesAirportBand: React.FC<FeaturesAirportBandProps> = ({
    title,
    description,
    originLabel,
    destinationLabel,
}) => {
    const bandRef = useRef<HTMLDivElement | null>(null);
    const [visibility, dispatchVisibility] = useReducer(airportVisibilityReducer, {
        lookupPrimed: false,
        visualActive: false,
    });
    const { lookupPrimed, visualActive } = visibility;

    // Synchronising with the viewport is exactly what an effect is for: the
    // observer is an external subscription this component owns and tears down.
    useEffect(() => {
        if (lookupPrimed && visualActive) return;

        const node = bandRef.current;
        if (!node || typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
            dispatchVisibility('all');
            return;
        }

        const observer = new window.IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                if (entry.intersectionRatio >= PREFETCH_AREA_RATIO) dispatchVisibility('lookup');
                if (entry.intersectionRatio >= VISIBLE_AREA_RATIO) dispatchVisibility('visual');
            }
        }, {
            rootMargin: `${PREFETCH_MARGIN_PX}px 0px`,
            threshold: [PREFETCH_AREA_RATIO, VISIBLE_AREA_RATIO, 1],
        });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [lookupPrimed, visualActive]);

    return (
        <div
            ref={bandRef}
            data-testid="features-airport-card"
            className="animate-scroll-fade-up overflow-hidden rounded-2xl border border-border bg-secondary px-6 py-10 md:px-12 md:py-14"
        >
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,auto)] lg:items-center lg:gap-16">
                <div className="min-w-0">
                    <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        {title}
                    </h2>
                    <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                        {description}
                    </p>
                </div>

                <div className="min-w-0">
                    <FeaturesAirportBentoVisual shouldPrefetch={lookupPrimed} isActive={visualActive} />
                    {/* Pinned to ltr to stay under the boards, which are pinned too. */}
                    <div
                        dir="ltr"
                        className="mt-4 flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground lg:justify-end lg:gap-16"
                    >
                        <span>{originLabel}</span>
                        <span>{destinationLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
