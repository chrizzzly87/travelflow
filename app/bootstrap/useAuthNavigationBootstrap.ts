import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    buildPathFromLocationParts,
    isLoginPathname,
    rememberAuthReturnPath,
} from '../../services/authNavigationService';

export const useAuthNavigationBootstrap = (): void => {
    const location = useLocation();

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
