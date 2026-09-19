import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ConsentChoice, readStoredConsent, saveConsent } from '../../services/consentService';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import { APP_NAME } from '../../config/appGlobals';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';
import { hasPreHydrationInteraction } from '../../services/bootInteractionBridge';

export const CookieConsentBanner: React.FC = () => {
    const { t } = useTranslation('common');
    const location = useSafeRouteLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const [consent, setConsent] = useState<ConsentChoice | null>(() => readStoredConsent());
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const isTestEnv = typeof process !== 'undefined' &&
            (process.env.NODE_ENV === 'test' || typeof process.env.VITEST !== 'undefined');

        if (isTestEnv) {
            setShouldRender(true);
            return;
        }

        // A tap or scroll that happened before this tree mounted still counts:
        // otherwise the banner waits for a second interaction the visitor has
        // no reason to make, and it never appears on a slow first mobile load.
        // Read it here rather than as initial state — rendering the banner on
        // the hydration render adds a node the prerendered DOM does not have,
        // and preact/compat hydrates that against the wrong element.
        if (hasPreHydrationInteraction()) {
            setShouldRender(true);
            return;
        }

        let mountTimeoutId: number | null = null;

        const triggerBanner = () => {
            removeListeners();
            // Render on the next macrotask rather than inside the interaction that
            // armed the banner. Mounting on `mousedown` inserted a fixed bar over
            // the bottom of the viewport while the pointer was still down, so a
            // click started on a control down there resolved against the banner.
            mountTimeoutId = window.setTimeout(() => {
                mountTimeoutId = null;
                setShouldRender(true);
            }, 0);
        };

        const removeListeners = () => {
            window.removeEventListener('scroll', triggerBanner);
            window.removeEventListener('pointerup', triggerBanner);
            window.removeEventListener('keyup', triggerBanner);
        };

        const cleanup = () => {
            removeListeners();
            if (mountTimeoutId !== null) {
                window.clearTimeout(mountTimeoutId);
                mountTimeoutId = null;
            }
        };

        // Arm on the first user interaction, but only once it has finished:
        // `pointerup` covers both mouse and touch, `scroll` covers a plain swipe.
        window.addEventListener('scroll', triggerBanner, { passive: true });
        window.addEventListener('pointerup', triggerBanner, { passive: true });
        window.addEventListener('keyup', triggerBanner, { passive: true });

        return cleanup;
    }, []);

    const isVisible = consent === null && shouldRender;

    const handleConsent = (choice: ConsentChoice) => {
        setConsent(choice);
        saveConsent(choice);
        if (choice === 'all') {
            trackEvent('consent__banner--accept', { source: 'cookie_banner' });
        } else {
            trackEvent('consent__banner--reject', { source: 'cookie_banner' });
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-x-0 bottom-4 z-cookie-consent px-4">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:border-border dark:bg-card/95">
                <p className="text-sm leading-6 text-slate-700 dark:text-foreground">
                    {t('cookieBanner.message', { appName: APP_NAME })}{' '}
                    <Link to={buildLocalizedMarketingPath('cookies', locale)} className="font-semibold text-accent-700 hover:text-accent-800 dark:text-accent-300">
                        {t('cookieBanner.policyLinkLabel')}
                    </Link>
                    .
                </p>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleConsent('essential')}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 dark:border-border dark:text-foreground dark:hover:border-border"
                        {...getAnalyticsDebugAttributes('consent__banner--reject', { source: 'cookie_banner' })}
                    >
                        {t('buttons.essentialOnly')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleConsent('all')}
                        className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700 dark:bg-accent-400 dark:hover:bg-accent-500"
                        {...getAnalyticsDebugAttributes('consent__banner--accept', { source: 'cookie_banner' })}
                    >
                        {t('buttons.acceptAll')}
                    </button>
                </div>
            </div>
        </div>
    );
};
