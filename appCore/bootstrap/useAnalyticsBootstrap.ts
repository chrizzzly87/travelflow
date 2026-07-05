import { useEffect } from 'react';
import { initializeAnalytics, trackPageView } from '../../services/analyticsService';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';

export const useAnalyticsBootstrap = (): void => {
    const location = useSafeRouteLocation();

    useEffect(() => {
        const disposeAnalytics = initializeAnalytics();
        return () => {
            disposeAnalytics();
        };
    }, []);

    useEffect(() => {
        trackPageView(`${location.pathname}${location.search}`);
    }, [location.pathname, location.search]);
};
