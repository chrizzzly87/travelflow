import React, { forwardRef } from 'react';

import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { cn } from '../../lib/utils';

interface CopyTripButtonProps {
    onCopyTrip: () => void;
    /** Which view-only surface the click came from, for analytics. */
    surface: 'share_strip' | 'view_only_card';
    className?: string;
}

/**
 * The one "Copy trip" action on a view-only shared trip. Both the top share
 * strip and the floating view-only card render this, so the two can no longer
 * drift apart — they did, and both ended up with amber text on an amber fill
 * in dark mode. A real forwardRef because the app runs on preact/compat.
 */
export const CopyTripButton = forwardRef<HTMLButtonElement, CopyTripButtonProps>(
    ({ onCopyTrip, surface, className }, ref) => (
        <button
            ref={ref}
            type="button"
            onClick={() => {
                trackEvent('trip_view__copy_trip--click', { surface });
                onCopyTrip();
            }}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                'bg-amber-200 text-amber-900 hover:bg-amber-300',
                'dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
                className,
            )}
            {...getAnalyticsDebugAttributes('trip_view__copy_trip--click', { surface })}
        >
            Copy trip
        </button>
    ),
);

CopyTripButton.displayName = 'CopyTripButton';
