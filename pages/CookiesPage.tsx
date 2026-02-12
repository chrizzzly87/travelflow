import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { ConsentChoice, readStoredConsent, saveConsent } from '../services/consentService';

export const CookiesPage: React.FC = () => {
    const { t } = useTranslation(['legal', 'common']);
    const [consent, setConsent] = useState<ConsentChoice | null>(() => readStoredConsent());

    const handleConsentUpdate = (choice: ConsentChoice) => {
        setConsent(choice);
        saveConsent(choice);
        if (choice === 'all') {
            trackEvent('consent__page--accept', { source: 'cookies_page' });
        } else {
            trackEvent('consent__page--reject', { source: 'cookies_page' });
        }
    };

    const noteItems = t('legal:cookies.notes', { returnObjects: true }) as string[];

    const consentLabel = consent === 'all'
        ? t('legal:cookies.stateAll')
        : consent === 'essential'
            ? t('legal:cookies.stateEssential')
            : t('legal:cookies.stateUnset');

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('legal:cookies.title')}</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    {t('legal:cookies.intro')}
                </p>

                <div className="mt-6 space-y-3 text-sm text-slate-700">
                    <p>
                        <strong>{t('legal:cookies.essential')}</strong> <code>{t('legal:cookies.essentialValue')}</code>
                    </p>
                    <p>
                        <strong>{t('legal:cookies.optional')}</strong> {t('legal:cookies.optionalValue')}
                    </p>
                    <p>
                        <strong>{t('legal:cookies.mapping')}</strong> {t('legal:cookies.mappingValue')}
                    </p>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <h2 className="text-base font-bold text-slate-900">{t('legal:cookies.notesTitle')}</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5">
                        {noteItems.map((item, index) => (
                            <li key={`${index}-${item}`}>{item}</li>
                        ))}
                    </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <h2 className="text-base font-bold text-slate-900">{t('legal:cookies.manageTitle')}</h2>
                    <p className="mt-2">
                        <strong>{t('legal:cookies.current')}</strong> {consentLabel}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => handleConsentUpdate('essential')}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                            {...getAnalyticsDebugAttributes('consent__page--reject', { source: 'cookies_page' })}
                        >
                            {t('common:buttons.essentialOnly')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleConsentUpdate('all')}
                            className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700"
                            {...getAnalyticsDebugAttributes('consent__page--accept', { source: 'cookies_page' })}
                        >
                            {t('common:buttons.acceptAll')}
                        </button>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
};
