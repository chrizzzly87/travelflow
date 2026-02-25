import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initializeAnalytics, trackPageView } from '../../services/analyticsService';

export const useAnalyticsBootstrap = (): void => {
    const location = useLocation();

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
