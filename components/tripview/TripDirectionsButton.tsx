import React, { useMemo } from 'react';
import { Navigation } from 'lucide-react';

import { Drawer, DrawerContent } from '../ui/drawer';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import { useDirectionsChooser } from '../maps/useDirectionsChooser';
import type { DirectionsTarget } from '../../shared/mapDirectionsLinks';

interface TripDirectionsButtonProps {
    target: DirectionsTarget;
    tripId: string;
    itemId: string;
    className?: string;
}

export const TripDirectionsButton: React.FC<TripDirectionsButtonProps> = ({
    target,
    tripId,
    itemId,
    className,
}) => {
    const stableTarget = useMemo(
        () => target,
        [target.label, target.coordinates?.lat, target.coordinates?.lng],
    );
    const { links, isChooserOpen, setIsChooserOpen, openDirections, chooseApp } = useDirectionsChooser(
        stableTarget,
        { tripId, itemId },
    );

    if (!links) return null;

    return (
        <>
            <button
                type="button"
                onClick={openDirections}
                data-testid="trip-directions-button"
                className={className ?? 'inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-600'}
                aria-label={`Directions to ${target.label}`}
                title={`Directions to ${target.label}`}
                {...getAnalyticsDebugAttributes('trip_view__directions--open', { trip_id: tripId, item_id: itemId })}
            >
                <Navigation size={15} />
            </button>

            <Drawer open={isChooserOpen} onOpenChange={setIsChooserOpen}>
                <DrawerContent
                    accessibleTitle="Open directions"
                    accessibleDescription={`Choose which app opens directions to ${target.label}.`}
                    className="pb-[max(1rem,env(safe-area-inset-bottom))]"
                >
                    <div className="px-4 pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Directions
                        </p>
                        <p className="mt-1 truncate text-base font-semibold text-slate-900">{target.label}</p>
                        <div className="mt-4 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => chooseApp('apple')}
                                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
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
                            <button
                                type="button"
                                onClick={() => setIsChooserOpen(false)}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
};
