import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ConsentChoice, readStoredConsent, saveConsent } from '../../services/consentService';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import { APP_NAME } from '../../config/appGlobals';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';

export const CookieConsentBanner: React.FC = () => {
    const { t } = useTranslation('common');
    const location = useSafeRouteLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const [consent, setConsent] = useState<ConsentChoice | null>(() => readStoredConsent());
    const isVisible = consent === null;

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
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="text-sm leading-6 text-slate-700">
                    {t('cookieBanner.message', { appName: APP_NAME })}{' '}
                    <a href={buildLocalizedMarketingPath('cookies', locale)} className="font-semibold text-accent-700 hover:text-accent-800">
                        {t('cookieBanner.policyLinkLabel')}
                    </a>
                    .
                </p>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleConsent('essential')}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                        {...getAnalyticsDebugAttributes('consent__banner--reject', { source: 'cookie_banner' })}
                    >
                        {t('buttons.essentialOnly')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleConsent('all')}
                        className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700"
                        {...getAnalyticsDebugAttributes('consent__banner--accept', { source: 'cookie_banner' })}
                    >
                        {t('buttons.acceptAll')}
                    </button>
                </div>
            </div>
        </div>
    );
};
