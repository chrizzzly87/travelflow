import { readStoredConsent, subscribeToConsentChanges } from './consentService';

type AnalyticsValue = string | number | boolean | null;
type AnalyticsPayload = Record<string, AnalyticsValue>;

interface UmamiApi {
    track: {
        (): void;
        (eventName: string, data?: AnalyticsPayload): void;
    };
}

declare global {
    interface Window {
        umami?: UmamiApi;
    }
}

const UMAMI_SCRIPT_URL = (import.meta.env.VITE_UMAMI_SCRIPT_URL || '').trim();
const UMAMI_WEBSITE_ID = (import.meta.env.VITE_UMAMI_WEBSITE_ID || '').trim();
const SCRIPT_ID = 'tf-umami-script';

let scriptLoadPromise: Promise<boolean> | null = null;
let lastTrackedPath: string | null = null;
const pendingPageViews = new Set<string>();

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
const isConfigured = () => Boolean(UMAMI_SCRIPT_URL && UMAMI_WEBSITE_ID);
const hasAnalyticsConsent = () => readStoredConsent() === 'all';

const sanitizePayload = (payload?: Record<string, unknown>): AnalyticsPayload | undefined => {
    if (!payload) return undefined;
    const sanitized: AnalyticsPayload = {};
    for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
            sanitized[key] = value;
        }
    }
    return Object.keys(sanitized).length ? sanitized : undefined;
};

const createScriptLoadPromise = (script: HTMLScriptElement) =>
    new Promise<boolean>((resolve) => {
        const onLoad = () => {
            script.dataset.loaded = 'true';
            resolve(true);
        };
        const onError = () => {
            resolve(false);
        };
        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });
    });

const ensureUmamiScript = async (): Promise<boolean> => {
    if (!isBrowser() || !isConfigured()) return false;
    if (window.umami && typeof window.umami.track === 'function') return true;

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
        if (existingScript.dataset.loaded === 'true') return true;
        if (!scriptLoadPromise) {
            scriptLoadPromise = createScriptLoadPromise(existingScript);
        }
        return scriptLoadPromise;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = UMAMI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.loaded = 'false';
    script.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
    script.setAttribute('data-auto-track', 'false');

    scriptLoadPromise = createScriptLoadPromise(script);
    document.head.appendChild(script);

    return scriptLoadPromise;
};

const runWithUmami = async (runner: (umami: UmamiApi) => void): Promise<void> => {
    if (!isBrowser() || !isConfigured() || !hasAnalyticsConsent()) return;

    const scriptReady = await ensureUmamiScript();
    if (!scriptReady) return;

    if (window.umami && typeof window.umami.track === 'function') {
        runner(window.umami);
    }
};

export const initializeAnalytics = (): (() => void) => {
    if (!isBrowser() || !isConfigured()) return () => {};

    if (hasAnalyticsConsent()) {
        void ensureUmamiScript();
    }

    return subscribeToConsentChanges((choice) => {
        if (choice === 'all') {
            lastTrackedPath = null;
            void ensureUmamiScript().then((ready) => {
                if (!ready || typeof window === 'undefined') return;
                trackPageView(`${window.location.pathname}${window.location.search}`);
            });
            return;
        }
        lastTrackedPath = null;
    });
};

export const trackPageView = (path: string): void => {
    if (!path) return;
    if (!isBrowser() || !isConfigured() || !hasAnalyticsConsent()) return;
    if (lastTrackedPath === path) return;
    if (pendingPageViews.has(path)) return;
    pendingPageViews.add(path);

    void runWithUmami((umami) => {
        umami.track();
        lastTrackedPath = path;
    }).finally(() => {
        pendingPageViews.delete(path);
    });
};

export const trackEvent = (eventName: string, payload?: Record<string, unknown>): void => {
    const sanitizedEventName = eventName.trim();
    if (!sanitizedEventName) return;

    const sanitizedPayload = sanitizePayload(payload);
    void runWithUmami((umami) => {
        umami.track(sanitizedEventName, sanitizedPayload);
    });
};
