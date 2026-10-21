import { useCallback, useMemo, useState } from 'react';

import { trackEvent } from '../../services/analyticsService';
import {
    buildDirectionsLinks,
    resolveDirectionsPlatform,
    type DirectionsTarget,
} from '../../shared/mapDirectionsLinks';

export const openMapUrlExternally = (url: string): void => {
    if (typeof window === 'undefined') return;
    // `geo:` and `maps:` hand off to a native app, which a new tab would leave
    // behind as an empty window, so the app schemes navigate in place.
    if (url.startsWith('http')) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }
    window.location.href = url;
};

interface DirectionsChooserOptions {
    tripId: string;
    itemId: string;
}

/**
 * The one place that decides how a destination is opened.
 *
 * Android resolves `geo:` through its own "open with" chooser, which is the
 * native picker. iOS has no equivalent for map links, so the choice between
 * Apple Maps and Google Maps has to be offered in-app; a desktop browser just
 * gets a tab. Anything that lets a traveller tap a place shares this, so the
 * behaviour cannot drift between the itinerary and the idea cards.
 */
export const useDirectionsChooser = (
    target: DirectionsTarget,
    { tripId, itemId }: DirectionsChooserOptions,
) => {
    const [isChooserOpen, setIsChooserOpen] = useState(false);
    const links = useMemo(() => buildDirectionsLinks(target), [target]);
    const platform = useMemo(
        () => resolveDirectionsPlatform(typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
        [],
    );

    const openDirections = useCallback(() => {
        if (!links) return;
        trackEvent('trip_view__directions--open', { trip_id: tripId, item_id: itemId, platform });

        if (platform === 'android') {
            openMapUrlExternally(links.geoUri);
            return;
        }
        if (platform === 'ios') {
            setIsChooserOpen(true);
            return;
        }
        openMapUrlExternally(links.googleMapsUrl);
    }, [itemId, links, platform, tripId]);

    const chooseApp = useCallback((app: 'apple' | 'google') => {
        if (!links) return;
        trackEvent('trip_view__directions--choose_app', { trip_id: tripId, item_id: itemId, app });
        setIsChooserOpen(false);
        openMapUrlExternally(app === 'apple' ? links.appleMapsUrl : links.googleMapsUrl);
    }, [itemId, links, tripId]);

    return { links, platform, isChooserOpen, setIsChooserOpen, openDirections, chooseApp };
};
