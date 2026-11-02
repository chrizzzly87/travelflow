import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;
/** False for SSR and the hydration render; true once browser rendering can diverge. */
export const useHydrated = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
