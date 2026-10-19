import React from 'react';
import { MarketingLayout } from '../marketing/MarketingLayout';

/** Native routing retains the current page before this slow-navigation boundary.
 * Reuse the real navigation when pending; fabricated controls are never interactive.
 * Its SSR-rendered chrome must be in the initial module graph, not a second
 * lazy boundary that ClientOnly can replace before it has hydrated. */
export const MarketingRouteLoadingShell: React.FC = () => (
    <MarketingLayout>
        <div data-testid="route-loading-shell" aria-busy="true" className="min-h-[40vh]">
            <div aria-hidden="true" className="h-0.5 overflow-hidden rounded-full bg-accent-100 dark:bg-accent-400/10">
                <div className="h-full w-1/3 rounded-full bg-accent-500 motion-safe:animate-pulse" />
            </div>
        </div>
    </MarketingLayout>
);
