import { describe, expect, it } from 'vitest';

import {
    shouldRegisterServiceWorker,
    type ServiceWorkerEnvironment,
} from '../../services/serviceWorkerRegistration';

const ENABLED: ServiceWorkerEnvironment = {
    isSupported: true,
    isProductionBuild: true,
    isSecureContext: true,
    isDisabled: false,
};

describe('shouldRegisterServiceWorker', () => {
    it('registers in a supported, secure production context', () => {
        expect(shouldRegisterServiceWorker(ENABLED)).toBe(true);
    });

    it('skips when the browser has no service worker support', () => {
        expect(shouldRegisterServiceWorker({ ...ENABLED, isSupported: false })).toBe(false);
    });

    it('skips in dev, where a cache-first worker would serve stale modules', () => {
        expect(shouldRegisterServiceWorker({ ...ENABLED, isProductionBuild: false })).toBe(false);
    });

    it('skips outside a secure context', () => {
        expect(shouldRegisterServiceWorker({ ...ENABLED, isSecureContext: false })).toBe(false);
    });

    it('honours the support escape hatch', () => {
        expect(shouldRegisterServiceWorker({ ...ENABLED, isDisabled: true })).toBe(false);
    });
});
