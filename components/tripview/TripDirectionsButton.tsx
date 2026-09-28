import React, { useMemo } from 'react';
import { Navigation } from 'lucide-react';

import { Button } from '../ui/button';
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
            <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={openDirections}
                data-testid="trip-directions-button"
                className={className ?? 'rounded-full bg-card text-muted-foreground shadow-none hover:border-accent-300 hover:bg-card hover:text-accent-600 dark:bg-card dark:hover:border-accent-400/30 dark:hover:bg-card dark:hover:text-accent-300'}
                aria-label={`Directions to ${target.label}`}
                title={`Directions to ${target.label}`}
                {...getAnalyticsDebugAttributes('trip_view__directions--open', { trip_id: tripId, item_id: itemId })}
            >
                <Navigation size={15} />
            </Button>

            <Drawer open={isChooserOpen} onOpenChange={setIsChooserOpen}>
                <DrawerContent
                    accessibleTitle="Open directions"
                    accessibleDescription={`Choose which app opens directions to ${target.label}.`}
                    className="pb-[max(1rem,env(safe-area-inset-bottom))]"
                >
                    <div className="px-4 pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Directions
                        </p>
                        <p className="mt-1 truncate text-base font-semibold text-foreground">{target.label}</p>
                        <div className="mt-4 flex flex-col gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={() => chooseApp('apple')}
                                className="min-h-12 rounded-xl bg-card px-4 font-semibold text-foreground shadow-none hover:bg-secondary dark:bg-card dark:hover:bg-secondary"
                            >
                                Apple Maps
                            </Button>
                            <Button
                                type="button"
                                variant="default"
                                size="lg"
                                onClick={() => chooseApp('google')}
                                className="min-h-12 rounded-xl px-4 font-semibold"
                            >
                                Google Maps
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="lg"
                                onClick={() => setIsChooserOpen(false)}
                                className="min-h-11 rounded-xl px-4 font-semibold text-muted-foreground hover:bg-secondary dark:hover:bg-secondary"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
};
