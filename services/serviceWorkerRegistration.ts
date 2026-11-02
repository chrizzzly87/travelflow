/**
 * Registers the offline service worker.
 *
 * Deliberately conservative: offline support is an enhancement, so every
 * failure path here degrades to "the app behaves exactly as it did before"
 * rather than surfacing anything to the user.
 */

const SERVICE_WORKER_URL = '/sw.js';

/** Escape hatch for support: `localStorage.setItem('tf_disable_sw', '1')`. */
export const SERVICE_WORKER_DISABLED_STORAGE_KEY = 'tf_disable_sw';

const isServiceWorkerSupported = (): boolean => (
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
);

const isDisabledByUser = (): boolean => {
    try {
        return window.localStorage.getItem(SERVICE_WORKER_DISABLED_STORAGE_KEY) === '1';
    } catch {
        // Private mode or blocked storage: treat as not disabled.
        return false;
    }
};

export interface ServiceWorkerEnvironment {
    isSupported: boolean;
    isProductionBuild: boolean;
    isSecureContext: boolean;
    isDisabled: boolean;
}

/**
 * Whether registration should run at all.
 *
 * Kept separate from the registration call so the decision is testable without
 * stubbing `navigator.serviceWorker.register`.
 */
export const shouldRegisterServiceWorker = (environment: ServiceWorkerEnvironment): boolean => {
    if (!environment.isSupported) return false;
    // `vite dev` serves modules unbundled; a cache-first worker there would
    // serve stale modules and make HMR behave bizarrely.
    if (!environment.isProductionBuild) return false;
    if (!environment.isSecureContext) return false;
    if (environment.isDisabled) return false;
    return true;
};

const readEnvironment = (): ServiceWorkerEnvironment => ({
    isSupported: isServiceWorkerSupported(),
    isProductionBuild: import.meta.env.PROD,
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
    isDisabled: isDisabledByUser(),
});

const registerNow = async (): Promise<void> => {
    try {
        await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
    } catch (error) {
        // A failed registration only costs offline support. Never escalate.
        console.debug('Service worker registration failed', error);
    }
};

/**
 * Register after first paint.
 *
 * The boot shell and the trip route compete for the same bandwidth on a phone,
 * and precaching is never urgent — it only has to finish before the user goes
 * offline, not before the page is interactive.
 */
export const registerServiceWorker = (): void => {
    if (typeof window === 'undefined') return;
    if (!shouldRegisterServiceWorker(readEnvironment())) return;

    const start = () => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => { void registerNow(); }, { timeout: 5000 });
            return;
        }
        window.setTimeout(() => { void registerNow(); }, 1000);
    };

    if (document.readyState === 'complete') {
        start();
        return;
    }
    window.addEventListener('load', start, { once: true });
};

/**
 * Remove the worker and every cache it owns.
 *
 * The documented recovery step in `docs/PWA_OFFLINE.md` for a device stuck on a
 * bad build.
 */
export const unregisterServiceWorker = async (): Promise<void> => {
    if (!isServiceWorkerSupported()) return;
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if (typeof caches !== 'undefined') {
            const names = await caches.keys();
            await Promise.all(
                names
                    .filter((name) => name.startsWith('travelflow-'))
                    .map((name) => caches.delete(name))
            );
        }
    } catch (error) {
        console.debug('Service worker cleanup failed', error);
    }
};
