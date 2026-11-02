import {
    readLocalStorageItem,
    readSessionStorageItem,
    writeLocalStorageItem,
    writeSessionStorageItem,
} from '../../services/browserStorageService';

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

const TRIP_AGENT_SESSION_PREFIX = 'tf_trip_agent_session_v1:';
/** Marks a tab whose open chat is a draft nobody has written in yet. */
export const TRIP_AGENT_DRAFT_SESSION_VALUE = 'draft';

/**
 * The chat this browser tab last had open for a trip. Nothing stored means a
 * new session, which starts with a fresh chat instead of the last one.
 */
export const readTripAgentSessionThread = (tripId: string): string | null => {
    try {
        return readSessionStorageItem(`${TRIP_AGENT_SESSION_PREFIX}${tripId}`);
    } catch {
        return null;
    }
};

export const writeTripAgentSessionThread = (tripId: string, threadId: string): void => {
    try {
        writeSessionStorageItem(`${TRIP_AGENT_SESSION_PREFIX}${tripId}`, threadId);
    } catch {
        // Without session storage every open starts a fresh chat, which is safe.
    }
};
