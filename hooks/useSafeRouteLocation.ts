import { useLocation, type Location } from 'react-router-dom';

const DEFAULT_ROUTE_LOCATION: Location = {
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: 'default',
};

export const getBrowserRouteLocation = (): Location => {
    if (typeof window === 'undefined') return DEFAULT_ROUTE_LOCATION;

    return {
        pathname: window.location.pathname || DEFAULT_ROUTE_LOCATION.pathname,
        search: window.location.search || '',
        hash: window.location.hash || '',
        state: window.history.state ?? null,
        key: DEFAULT_ROUTE_LOCATION.key,
    };
};

export const useSafeRouteLocation = (): Location => {
    const routeLocation = useLocation() as Location | null | undefined;
    return routeLocation ?? getBrowserRouteLocation();
};
