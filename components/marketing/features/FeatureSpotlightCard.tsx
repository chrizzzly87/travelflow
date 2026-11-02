import React from 'react';
import { cn } from '../../../lib/utils';

interface FeatureSpotlightCardProps {
    className?: string;
    children: React.ReactNode;
}

/**
 * A surface with a highlight that follows the pointer, after React Bits'
 * Spotlight Card. The position is written straight to the element's custom
 * properties in the move handler: no state, no effect, no re-render per frame.
 */
export const FeatureSpotlightCard = React.forwardRef<HTMLDivElement, FeatureSpotlightCardProps>(
    ({ className, children }, ref) => {
        const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
            const node = event.currentTarget;
            const rect = node.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            node.style.setProperty('--tf-spot-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
            node.style.setProperty('--tf-spot-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
        };

        const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
            const node = event.currentTarget;
            node.style.removeProperty('--tf-spot-x');
            node.style.removeProperty('--tf-spot-y');
        };

        return (
            <div
                ref={ref}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                className={cn(
                    'tf-spotlight relative isolate overflow-hidden rounded-2xl border border-border bg-card',
                    'transition-[translate,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-accent-300/70',
                    'dark:hover:border-accent-400/40',
                    className,
                )}
            >
                {children}
            </div>
        );
    },
);

FeatureSpotlightCard.displayName = 'FeatureSpotlightCard';
