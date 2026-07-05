import { useEffect } from 'react';
import {
    buildPathFromLocationParts,
    isLoginPathname,
    rememberAuthReturnPath,
} from '../../services/authNavigationService';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';

export const useAuthNavigationBootstrap = (): void => {
    const location = useSafeRouteLocation();

    useEffect(() => {
        if (isLoginPathname(location.pathname)) return;
        const currentPath = buildPathFromLocationParts({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
        });
        rememberAuthReturnPath(currentPath);
    }, [location.hash, location.pathname, location.search]);
};
