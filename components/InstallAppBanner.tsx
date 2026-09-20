import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DeviceMobile, Export, Plus, X } from '@phosphor-icons/react';

import { useHasSavedTrips } from '../hooks/useHasSavedTrips';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    detectInstallPlatform,
    isTripDetailRoute,
    detectStandaloneDisplay,
    readInstallPromptState,
    recordInstallAccepted,
    recordInstallPromptDismissed,
    shouldOfferInstallPrompt,
    type InstallPlatform,
} from '../services/installPromptService';

/** Chrome's install event. Not in lib.dom, so it is described here. */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';

/**
 * How long to wait after arriving before offering. Long enough that the prompt
 * never competes with the page rendering, short enough that it still lands
 * while the person is looking at their trips.
 */
const APPEAR_DELAY_MS = 5000;

export const InstallAppBanner: React.FC = () => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const hasSavedTrips = useHasSavedTrips();

    const [isVisible, setIsVisible] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);
    const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
    const [hasNativePrompt, setHasNativePrompt] = useState(false);

    const platform: InstallPlatform = useMemo(
        () => detectInstallPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent),
        []
    );

    // Chrome fires this once, early, and it is the only way to trigger a real
    // install. Capturing it is unconditional; whether we ever act on it is the
    // eligibility check's business.
    useEffect(() => {
        const handler = (event: Event) => {
            event.preventDefault();
            deferredPromptRef.current = event as BeforeInstallPromptEvent;
            setHasNativePrompt(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    useEffect(() => {
        const handler = () => {
            recordInstallAccepted();
            setIsVisible(false);
        };
        window.addEventListener('appinstalled', handler);
        return () => window.removeEventListener('appinstalled', handler);
    }, []);

    const isEligible = useMemo(() => shouldOfferInstallPrompt({
        isStandalone: detectStandaloneDisplay(),
        isMobileViewport: typeof window !== 'undefined'
            && Boolean(window.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches),
        platform,
        hasSavedTrip: hasSavedTrips,
        pathname: location.pathname,
        state: readInstallPromptState(),
        now: Date.now(),
    }), [hasSavedTrips, location.pathname, platform]);

    useEffect(() => {
        if (!isEligible) {
            setIsVisible(false);
            return undefined;
        }
        const timer = window.setTimeout(() => {
            setIsVisible(true);
            trackEvent('install__banner--show', { platform });
        }, APPEAR_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [isEligible, platform]);

    const dismiss = useCallback(() => {
        setIsDismissing(true);
        recordInstallPromptDismissed();
        trackEvent('install__banner--dismiss', { platform });
        window.setTimeout(() => setIsVisible(false), 180);
    }, [platform]);

    const handleInstall = useCallback(async () => {
        const deferred = deferredPromptRef.current;
        if (!deferred) return;
        trackEvent('install__banner--accept', { platform });
        try {
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === 'accepted') {
                recordInstallAccepted();
            } else {
                // A declined native prompt counts as a dismissal, so we do not
                // ask again on the next screen.
                recordInstallPromptDismissed();
            }
        } catch {
            // The prompt can only be used once and throws if replayed. Either
            // way there is nothing useful to tell the visitor.
        } finally {
            deferredPromptRef.current = null;
            setHasNativePrompt(false);
            setIsVisible(false);
        }
    }, [platform]);

    if (!isVisible) return null;

    // iOS has no install API at all — Safari only offers it through the Share
    // sheet — so there the banner can do nothing but explain where to tap.
    // On Android the opposite holds: Chrome tells us when the app is actually
    // installable, and without that signal we have no idea which menu this
    // browser hides it behind. Saying nothing beats guessing wrong.
    if (platform === 'android' && !hasNativePrompt) return null;

    const showsIosInstructions = platform === 'ios';

    // A trip screen carries its own fixed bottom-right launcher. A full-width
    // banner pinned to the bottom would sit straight on top of it, so lift the
    // banner clear of it there.
    const bottomInsetClass = isTripDetailRoute(location.pathname)
        ? 'pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)]'
        : 'pb-[max(0.75rem,env(safe-area-inset-bottom))]';

    return (
        <div
            className={`fixed inset-x-0 bottom-0 z-[2400] px-3 ${bottomInsetClass} transition-all duration-200 md:hidden ${
                isDismissing ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
            }`}
            data-testid="install-app-banner"
            {...getAnalyticsDebugAttributes('install__banner', { platform })}
        >
            <div
                role="region"
                aria-label={t('install.banner.title')}
                className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_8px_30px_rgba(15,23,42,0.18)]"
            >
                <span className="mt-0.5 inline-flex size-9 flex-none items-center justify-center rounded-xl bg-accent-600 text-white">
                    <DeviceMobile size={18} weight="bold" />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                        {t('install.banner.title')}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {t('install.banner.body')}
                    </p>

                    {showsIosInstructions ? (
                        <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-xs font-medium text-foreground">
                            <Export size={14} weight="bold" className="text-accent-600 dark:text-accent-300" />
                            <span>{t('install.banner.iosStepShare')}</span>
                            <Plus size={14} weight="bold" className="text-accent-600 dark:text-accent-300" />
                            <span>{t('install.banner.iosStepAdd')}</span>
                        </p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { void handleInstall(); }}
                            data-testid="install-app-banner-accept"
                            className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                        >
                            {t('install.banner.action')}
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={dismiss}
                    data-testid="install-app-banner-dismiss"
                    aria-label={t('install.banner.dismiss')}
                    className="-m-1 flex size-8 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-muted-foreground dark:text-foreground"
                >
                    <X size={16} weight="bold" />
                </button>
            </div>
        </div>
    );
};
