import React, { useState } from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { trackEvent } from '../services/analyticsService';
import { ConsentChoice, readStoredConsent, saveConsent } from '../services/consentService';

export const CookiesPage: React.FC = () => {
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

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Cookie Policy</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    TravelFlow stores consent preferences locally and only activates analytics after optional consent is granted.
                </p>

                <div className="mt-6 space-y-3 text-sm text-slate-700">
                    <p>
                        <strong>Essential storage (always active):</strong> <code>tf_cookie_consent_choice_v1</code> in Local Storage to remember your banner selection.
                    </p>
                    <p>
                        <strong>Optional analytics:</strong> Umami is loaded only when you choose <em>Accept all</em> in the cookie banner.
                    </p>
                    <p>
                        <strong>Consent mapping:</strong> <em>Essential only</em> keeps analytics disabled; <em>Accept all</em> enables analytics tracking.
                    </p>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <h2 className="text-base font-bold text-slate-900">Analytics configuration notes</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5">
                        <li>Tracker script URL is configured via <code>VITE_UMAMI_SCRIPT_URL</code>.</li>
                        <li>Website identifier is configured via <code>VITE_UMAMI_WEBSITE_ID</code>.</li>
                        <li>If you enable cookie-based analytics features in Umami later, list all resulting cookie names and durations here.</li>
                    </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <h2 className="text-base font-bold text-slate-900">Manage analytics consent</h2>
                    <p className="mt-2">
                        Current preference:{' '}
                        <strong>
                            {consent === 'all' ? 'Accept all' : consent === 'essential' ? 'Essential only' : 'Not set'}
                        </strong>
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => handleConsentUpdate('essential')}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                        >
                            Essential only
                        </button>
                        <button
                            type="button"
                            onClick={() => handleConsentUpdate('all')}
                            className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700"
                        >
                            Accept all
                        </button>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
};
