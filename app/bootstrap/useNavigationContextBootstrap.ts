import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { rememberNavigationPath } from '../../services/navigationContextService';

export const useNavigationContextBootstrap = (): void => {
  const location = useLocation();

  useEffect(() => {
    rememberNavigationPath(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
};
