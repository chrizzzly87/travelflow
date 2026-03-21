import { readLocalStorageItem, writeLocalStorageItem } from '../../../services/browserStorageService';
import type { TripWorkspaceSidebarState } from '../../../types';

export const TRIP_WORKSPACE_SIDEBAR_STATE_STORAGE_KEY = 'tf_trip_workspace_sidebar_state_v1';

const isValidSidebarState = (value: unknown): value is TripWorkspaceSidebarState =>
    value === 'expanded' || value === 'collapsed';

export const readTripWorkspaceSidebarState = (): TripWorkspaceSidebarState => {
    const stored = readLocalStorageItem(TRIP_WORKSPACE_SIDEBAR_STATE_STORAGE_KEY);
    return isValidSidebarState(stored) ? stored : 'expanded';
};

export const writeTripWorkspaceSidebarState = (value: TripWorkspaceSidebarState): boolean =>
    writeLocalStorageItem(TRIP_WORKSPACE_SIDEBAR_STATE_STORAGE_KEY, value);
