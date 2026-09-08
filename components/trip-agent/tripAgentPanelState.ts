import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';

const TRIP_AGENT_OPEN_KEY = 'tf_trip_agent_open_v1';

/** Restores whether the planner chat was open, so a refresh does not close it. */
export const readTripAgentOpenState = (): boolean => {
    try {
        return readLocalStorageItem(TRIP_AGENT_OPEN_KEY) === '1';
    } catch {
        return false;
    }
};

export const writeTripAgentOpenState = (isOpen: boolean): void => {
    try {
        writeLocalStorageItem(TRIP_AGENT_OPEN_KEY, isOpen ? '1' : '0');
    } catch {
        // Storage can be unavailable (private mode, quota); the panel still works.
    }
};
