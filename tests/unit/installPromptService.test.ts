import { describe, expect, it } from 'vitest';

import {
    DEFAULT_INSTALL_PROMPT_STATE,
    DISMISS_QUIET_DAYS,
    MAX_DISMISSALS,
    detectInstallPlatform,
    isInstallPromptRoute,
    isTripDetailRoute,
    shouldOfferInstallPrompt,
    type InstallPromptEligibility,
} from '../../services/installPromptService';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);

const ELIGIBLE: InstallPromptEligibility = {
    isStandalone: false,
    isMobileViewport: true,
    platform: 'ios',
    hasSavedTrip: true,
    pathname: '/trips',
    state: DEFAULT_INSTALL_PROMPT_STATE,
    now: NOW,
};

describe('isInstallPromptRoute', () => {
    it('offers only where offline access pays off', () => {
        expect(isInstallPromptRoute('/trips')).toBe(true);
        expect(isInstallPromptRoute('/de/trips')).toBe(true);
        expect(isInstallPromptRoute('/trip/abc-123')).toBe(true);
        expect(isInstallPromptRoute('/de/trip/abc-123')).toBe(true);
    });

    it('stays out of the way everywhere else', () => {
        for (const path of ['/', '/features', '/pricing', '/blog/post', '/create-trip', '/profile', '/checkout']) {
            expect(isInstallPromptRoute(path)).toBe(false);
        }
    });
});

describe('isTripDetailRoute', () => {
    it('separates a single trip from the trips list', () => {
        // A trip screen has its own fixed bottom-right launcher, which the
        // banner must not cover; the list has none.
        expect(isTripDetailRoute('/trip/abc-123')).toBe(true);
        expect(isTripDetailRoute('/de/trip/abc-123')).toBe(true);
        expect(isTripDetailRoute('/trips')).toBe(false);
        expect(isTripDetailRoute('/de/trips')).toBe(false);
        expect(isTripDetailRoute('/')).toBe(false);
    });
});

describe('detectInstallPlatform', () => {
    it('recognises iOS', () => {
        expect(detectInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')).toBe('ios');
        expect(detectInstallPlatform('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) Safari')).toBe('ios');
    });

    it('recognises Android', () => {
        expect(detectInstallPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome')).toBe('android');
    });

    it('treats desktop as ineligible', () => {
        expect(detectInstallPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome')).toBe('other');
        expect(detectInstallPlatform('')).toBe('other');
    });
});

describe('shouldOfferInstallPrompt', () => {
    it('offers to a returning mobile visitor with a trip, on a trip screen', () => {
        expect(shouldOfferInstallPrompt(ELIGIBLE)).toBe(true);
        expect(shouldOfferInstallPrompt({ ...ELIGIBLE, platform: 'android' })).toBe(true);
    });

    it('never interrupts someone who already installed it', () => {
        expect(shouldOfferInstallPrompt({ ...ELIGIBLE, isStandalone: true })).toBe(false);
        expect(shouldOfferInstallPrompt({
            ...ELIGIBLE,
            state: { ...DEFAULT_INSTALL_PROMPT_STATE, installedAt: NOW - DAY_MS },
        })).toBe(false);
    });

    it('is mobile-only', () => {
        expect(shouldOfferInstallPrompt({ ...ELIGIBLE, isMobileViewport: false })).toBe(false);
        expect(shouldOfferInstallPrompt({ ...ELIGIBLE, platform: 'other' })).toBe(false);
    });

    it('waits until there is something worth taking offline', () => {
        expect(shouldOfferInstallPrompt({ ...ELIGIBLE, hasSavedTrip: false })).toBe(false);
    });

    it('does not appear on marketing pages', () => {
        expect(shouldOfferInstallPrompt({ ...ELIGIBLE, pathname: '/' })).toBe(false);
        expect(shouldOfferInstallPrompt({ ...ELIGIBLE, pathname: '/pricing' })).toBe(false);
    });

    it('takes no for an answer', () => {
        const justDismissed = {
            ...ELIGIBLE,
            state: { dismissCount: 1, lastDismissedAt: NOW - DAY_MS, installedAt: null },
        };
        expect(shouldOfferInstallPrompt(justDismissed)).toBe(false);

        // ...and asks again only after the quiet period.
        const longAgo = {
            ...ELIGIBLE,
            state: {
                dismissCount: 1,
                lastDismissedAt: NOW - (DISMISS_QUIET_DAYS + 1) * DAY_MS,
                installedAt: null,
            },
        };
        expect(shouldOfferInstallPrompt(longAgo)).toBe(true);
    });

    it('gives up permanently after repeated dismissals', () => {
        const repeatedlyDismissed = {
            ...ELIGIBLE,
            state: {
                dismissCount: MAX_DISMISSALS,
                lastDismissedAt: NOW - (DISMISS_QUIET_DAYS + 999) * DAY_MS,
                installedAt: null,
            },
        };
        expect(shouldOfferInstallPrompt(repeatedlyDismissed)).toBe(false);
    });
});
