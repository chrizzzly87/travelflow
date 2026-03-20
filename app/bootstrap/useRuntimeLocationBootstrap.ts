import { useEffect } from 'react';
import { ensureRuntimeLocationLoaded } from '../../services/runtimeLocationService';

export const useRuntimeLocationBootstrap = (): void => {
  useEffect(() => {
    void ensureRuntimeLocationLoaded();
  }, []);
};
