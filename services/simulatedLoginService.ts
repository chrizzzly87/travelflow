import {
    readLocalStorageItem,
    removeLocalStorageItem,
    writeLocalStorageItem,
} from './browserStorageService';

export const SIMULATED_LOGIN_STORAGE_KEY = 'tf_debug_simulated_login';
export const SIMULATED_LOGIN_DEBUG_EVENT = 'tf:simulated-login-debug';

let simulatedLoginOverride: boolean | null = null;

const readSimulatedLoginOverride = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        return readLocalStorageItem(SIMULATED_LOGIN_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

const dispatchSimulatedLoginEvent = (loggedIn: boolean) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(SIMULATED_LOGIN_DEBUG_EVENT, {
        detail: { available: true, loggedIn },
    }));
};

export const isSimulatedLoggedIn = (): boolean => {
    if (simulatedLoginOverride === null) {
        simulatedLoginOverride = readSimulatedLoginOverride();
    }
    return simulatedLoginOverride;
};

export const setSimulatedLoggedIn = (enabled: boolean): boolean => {
    simulatedLoginOverride = Boolean(enabled);
    if (typeof window !== 'undefined') {
        try {
            if (simulatedLoginOverride) {
                writeLocalStorageItem(SIMULATED_LOGIN_STORAGE_KEY, '1');
            } else {
                removeLocalStorageItem(SIMULATED_LOGIN_STORAGE_KEY);
            }
        } catch {
            // ignore storage issues
        }
    }
    dispatchSimulatedLoginEvent(simulatedLoginOverride);
    return simulatedLoginOverride;
};

export const toggleSimulatedLogin = (force?: boolean): boolean => {
    const next = typeof force === 'boolean' ? force : !isSimulatedLoggedIn();
    return setSimulatedLoggedIn(next);
};
