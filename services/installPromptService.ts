import { readLocalStorageItem, writeLocalStorageItem } from './browserStorageService';
import { stripLocalePrefix } from '../config/routes';

/**
 * Eligibility rules for the "add to home screen" prompt.
 *
 * Everything here is pure so the policy can be tested without a browser. The
 * component owns only the timing delay and the platform APIs.
 */

export const INSTALL_PROMPT_STORAGE_KEY = 'tf_install_prompt_state_v1';

/** After this many dismissals we stop asking for good. */
export const MAX_DISMISSALS = 2;

/** A single dismissal buys this much quiet. */
export const DISMISS_QUIET_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export type InstallPlatform = 'ios' | 'android' | 'other';

export interface InstallPromptState {
    dismissCount: number;
    lastDismissedAt: number | null;
    installedAt: number | null;
}

export const DEFAULT_INSTALL_PROMPT_STATE: InstallPromptState = {
    dismissCount: 0,
    lastDismissedAt: null,
    installedAt: null,
};

export const readInstallPromptState = (): InstallPromptState => {
    try {
        const raw = readLocalStorageItem(INSTALL_PROMPT_STORAGE_KEY);
        if (!raw) return DEFAULT_INSTALL_PROMPT_STATE;
        const parsed = JSON.parse(raw) as Partial<InstallPromptState>;
        return {
            dismissCount: typeof parsed.dismissCount === 'number' && parsed.dismissCount >= 0
                ? Math.floor(parsed.dismissCount)
                : 0,
            lastDismissedAt: typeof parsed.lastDismissedAt === 'number' ? parsed.lastDismissedAt : null,
            installedAt: typeof parsed.installedAt === 'number' ? parsed.installedAt : null,
        };
    } catch {
        return DEFAULT_INSTALL_PROMPT_STATE;
    }
};

export const writeInstallPromptState = (state: InstallPromptState): void => {
    try {
        writeLocalStorageItem(INSTALL_PROMPT_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage is a convenience here. Losing it means the prompt may reappear,
        // which is far better than the prompt throwing.
    }
};

export const recordInstallPromptDismissed = (now = Date.now()): InstallPromptState => {
    const current = readInstallPromptState();
    const next: InstallPromptState = {
        ...current,
        dismissCount: current.dismissCount + 1,
        lastDismissedAt: now,
    };
    writeInstallPromptState(next);
    return next;
};

export const recordInstallAccepted = (now = Date.now()): InstallPromptState => {
    const next: InstallPromptState = { ...readInstallPromptState(), installedAt: now };
    writeInstallPromptState(next);
    return next;
};

/**
 * Routes where installing is worth suggesting: the trips list and a trip.
 * Offline access is the reason to install, and those are the only screens where
 * it pays off.
 */
export const isInstallPromptRoute = (pathname: string): boolean => {
    const stripped = stripLocalePrefix(pathname || '/');
    if (stripped === '/trips') return true;
    return stripped.startsWith('/trip/');
};

/** A single trip's screen, which carries its own floating bottom controls. */
export const isTripDetailRoute = (pathname: string): boolean =>
    stripLocalePrefix(pathname || '/').startsWith('/trip/');

export const detectInstallPlatform = (userAgent: string): InstallPlatform => {
    const ua = userAgent || '';
    // iPadOS 13+ reports a desktop Safari UA, so the touch check catches it.
    const isIpadOs = /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
    if (/iPhone|iPad|iPod/.test(ua) || isIpadOs) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'other';
};

export interface InstallPromptEligibility {
    /** Already running as an installed app. */
    isStandalone: boolean;
    /** Narrow viewport; the prompt is mobile-only. */
    isMobileViewport: boolean;
    platform: InstallPlatform;
    /** They have something worth taking offline. */
    hasSavedTrip: boolean;
    pathname: string;
    state: InstallPromptState;
    now: number;
}

/**
 * Whether to offer the install prompt.
 *
 * Deliberately conservative. An install prompt is an interruption, so it only
 * appears once someone has a trip to lose, on a screen where offline access
 * matters, and it takes no for an answer.
 */
export const shouldOfferInstallPrompt = (input: InstallPromptEligibility): boolean => {
    if (input.isStandalone) return false;
    if (!input.isMobileViewport) return false;
    if (input.platform === 'other') return false;
    if (!input.hasSavedTrip) return false;
    if (!isInstallPromptRoute(input.pathname)) return false;

    const { dismissCount, lastDismissedAt, installedAt } = input.state;
    if (installedAt) return false;
    if (dismissCount >= MAX_DISMISSALS) return false;
    if (lastDismissedAt && input.now - lastDismissedAt < DISMISS_QUIET_DAYS * DAY_MS) return false;

    return true;
};

/**
 * Whether the app is already running installed.
 *
 * `display-mode: standalone` covers Android and iOS 16.4+; `navigator.standalone`
 * is the older iOS-only flag, which is still the only signal on iOS below 16.4.
 */
export const detectStandaloneDisplay = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    } catch {
        // matchMedia can throw in exotic embedders; fall through.
    }
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
    return iosStandalone === true;
};

/** Viewport below which the trips list opens as a route rather than an overlay. */
export const TRIPS_ROUTE_VIEWPORT_QUERY = '(max-width: 767px)';

/**
 * Whether "My Trips" should navigate to `/trips` instead of opening the overlay.
 *
 * Read at call time rather than render time so a rotation or resize between
 * mount and tap cannot give the stale answer.
 */
export const shouldOpenTripsAsRoute = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        return Boolean(window.matchMedia?.(TRIPS_ROUTE_VIEWPORT_QUERY).matches);
    } catch {
        return false;
    }
};
