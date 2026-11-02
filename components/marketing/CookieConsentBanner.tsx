import React, { useSyncExternalStore, useEffect } from 'react';
import { Link } from '@/app/navigation';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ConsentChoice, readStoredConsent, saveConsent, subscribeToConsentChanges } from '../../services/consentService';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { normalizeLocale } from '../../config/locales';
import { APP_NAME } from '../../config/appGlobals';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';
import { activateBootControls } from '../../services/bootInteractionBridge';

const subscribe = (notify: () => void) => subscribeToConsentChanges(() => notify());
const getServerSnapshot = () => null;

export const CookieConsentBanner: React.FC = () => {
    const { t, i18n } = useTranslation('common');
    const location = useSafeRouteLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
    const consent = useSyncExternalStore(subscribe, readStoredConsent, getServerSnapshot);
    useEffect(() => activateBootControls('consent'), []);

    const handleConsent = (choice: ConsentChoice) => {
        saveConsent(choice);
        if (choice === 'all') {
            trackEvent('consent__banner--accept', { source: 'cookie_banner' });
        } else {
            trackEvent('consent__banner--reject', { source: 'cookie_banner' });
        }
    };

    if (consent !== null) return null;

    return (
        <div data-tf-consent-banner="" className="fixed inset-x-0 bottom-4 z-cookie-consent px-4">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:border-border dark:bg-card/95 dark:shadow-none">
                <p className="text-sm leading-6 text-foreground dark:text-foreground">
                    {t('cookieBanner.message', { appName: APP_NAME })}{' '}
                    <Link to={buildLocalizedMarketingPath('cookies', locale)} className="font-semibold text-accent-700 hover:text-accent-800 dark:text-accent-200 dark:hover:text-accent-200">
                        {t('cookieBanner.policyLinkLabel')}
                    </Link>
                    .
                </p>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        data-tf-boot-scope="consent"
                        data-tf-boot-replay="consent:essential"
                        onClick={() => handleConsent('essential')}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-slate-400 dark:border-border dark:text-foreground dark:hover:border-border"
                        {...getAnalyticsDebugAttributes('consent__banner--reject', { source: 'cookie_banner' })}
                    >
                        {t('buttons.essentialOnly')}
                    </button>
                    <button
                        type="button"
                        data-tf-boot-scope="consent"
                        data-tf-boot-replay="consent:all"
                        onClick={() => handleConsent('all')}
                        className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700 dark:bg-accent-400 dark:hover:bg-accent-500 dark:text-background"
                        {...getAnalyticsDebugAttributes('consent__banner--accept', { source: 'cookie_banner' })}
                    >
                        {t('buttons.acceptAll')}
                    </button>
                </div>
            </div>
        </div>
    );
};
