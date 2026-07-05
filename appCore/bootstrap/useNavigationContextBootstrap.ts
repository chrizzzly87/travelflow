import { useEffect } from 'react';
import { rememberNavigationPath } from '../../services/navigationContextService';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';

export const useNavigationContextBootstrap = (): void => {
  const location = useSafeRouteLocation();

  useEffect(() => {
    rememberNavigationPath(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
};
