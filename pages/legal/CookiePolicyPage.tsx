import React, { useMemo, useState } from 'react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { COOKIE_CATEGORY_COPY, COOKIE_REGISTRY, getCookieLastReviewedDate } from '../../lib/legal/cookies';
import { CookieCategory } from '../../lib/legal/cookies.config';
import { ConsentChoice, readStoredConsent, saveConsent } from '../../services/consentService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const CATEGORY_ORDER: CookieCategory[] = ['essential', 'analytics', 'marketing'];

const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Cookie / Storage</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Purpose</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Duration</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Provider</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {children}
            </tbody>
        </table>
    </div>
);

export const CookiePolicyPage: React.FC = () => {
    const [consent, setConsent] = useState<ConsentChoice | null>(() => readStoredConsent());
    const lastReviewed = getCookieLastReviewedDate();

    const categoryBlocks = useMemo(() => CATEGORY_ORDER.map((category) => ({
        category,
        cookies: COOKIE_REGISTRY[category],
    })), []);

    const consentLabel = consent === 'all'
        ? 'All categories enabled'
        : consent === 'essential'
            ? 'Essential only'
            : 'Not decided yet';

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
            <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm md:p-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">ePrivacy · GDPR Art. 6</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                        Cookie & Local Storage Policy
                    </h1>
                    <p className="mt-4 text-base text-slate-700 md:text-lg">
                        This registry lists every cookie or persistent storage entry set by Travelflow. Essential cookies are
                        required for security and authentication. Optional categories are loaded only after you provide explicit
                        consent via the banner or the controls below.
                    </p>
                    <p className="mt-4 text-sm text-slate-600">Last reviewed: {lastReviewed}</p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Manage your consent</h2>
                    <p className="mt-3 text-sm text-slate-700">Current choice: {consentLabel}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => handleConsentUpdate('essential')}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                            {...getAnalyticsDebugAttributes('consent__page--reject', { source: 'cookies_page' })}
                        >
                            Essential only
                        </button>
                        <button
                            type="button"
                            onClick={() => handleConsentUpdate('all')}
                            className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
                            {...getAnalyticsDebugAttributes('consent__page--accept', { source: 'cookies_page' })}
                        >
                            Accept all
                        </button>
                    </div>
                </section>

                {categoryBlocks.map(({ category, cookies }) => (
                    <section key={category} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">{category}</p>
                                <h2 className="text-xl font-semibold text-slate-900">
                                    {COOKIE_CATEGORY_COPY[category].title}
                                </h2>
                                <p className="mt-1 text-sm text-slate-700">{COOKIE_CATEGORY_COPY[category].description}</p>
                            </div>
                        </div>
                        {cookies.length === 0 ? (
                            <p className="mt-4 text-sm text-slate-600">No cookies are set in this category.</p>
                        ) : (
                            <Table>
                                {cookies.map((cookie) => (
                                    <tr key={cookie.name}>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            <div>{cookie.name}</div>
                                            <div className="text-xs font-normal text-slate-500">{cookie.storage ?? 'cookie'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {cookie.purpose}
                                            {cookie.notes && (
                                                <div className="mt-1 text-xs text-slate-500">{cookie.notes}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">{cookie.duration}</td>
                                        <td className="px-4 py-3">{cookie.provider}</td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                    </section>
                ))}
            </div>
        </MarketingLayout>
    );
};
