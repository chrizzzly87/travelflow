import React, { useCallback, useMemo, useState } from 'react';
import { Navigation } from 'lucide-react';

import { Drawer, DrawerContent } from '../ui/drawer';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    buildDirectionsLinks,
    resolveDirectionsPlatform,
    type DirectionsTarget,
} from '../../shared/mapDirectionsLinks';

interface TripDirectionsButtonProps {
    target: DirectionsTarget;
    tripId: string;
    itemId: string;
    className?: string;
}

const openExternally = (url: string): void => {
    if (typeof window === 'undefined') return;
    // `geo:` and `maps:` hand off to a native app, which a new tab would leave
    // behind as an empty window, so the app schemes navigate in place.
    if (url.startsWith('http')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }
    window.location.href = url;
};

export const TripDirectionsButton: React.FC<TripDirectionsButtonProps> = ({
    target,
    tripId,
    itemId,
    className,
}) => {
    const [isChooserOpen, setIsChooserOpen] = useState(false);
    const links = useMemo(() => buildDirectionsLinks(target), [target]);
    const platform = useMemo(
        () => resolveDirectionsPlatform(typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
        [],
    );

    const openDirections = useCallback(() => {
        if (!links) return;
        trackEvent('trip_view__directions--open', { trip_id: tripId, item_id: itemId, platform });

        // Android resolves `geo:` through its own app chooser, which is exactly
        // the native picker asked for. iOS has no such chooser for map links,
        // so the choice is offered in-app instead.
        if (platform === 'android') {
            openExternally(links.geoUri);
            return;
        }
        if (platform === 'ios') {
            setIsChooserOpen(true);
            return;
        }
        openExternally(links.googleMapsUrl);
    }, [itemId, links, platform, tripId]);

    const chooseApp = useCallback((app: 'apple' | 'google') => {
        if (!links) return;
        trackEvent('trip_view__directions--choose_app', { trip_id: tripId, item_id: itemId, app });
        setIsChooserOpen(false);
        openExternally(app === 'apple' ? links.appleMapsUrl : links.googleMapsUrl);
    }, [itemId, links, tripId]);

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
