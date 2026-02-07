import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

export const CookiesPage: React.FC = () => {
    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Cookie Policy</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    TravelFlow currently stores a minimal consent value in local storage for cookie preference handling. Extend this page with your full policy before production.
                </p>
                <div className="mt-6 space-y-3 text-sm text-slate-700">
                    <p><strong>Essential:</strong> Required for app stability and preference persistence.</p>
                    <p><strong>Optional:</strong> Reserved for analytics and experience improvements.</p>
                    <p><strong>Consent storage:</strong> A local preference key is stored in the browser to remember your choice.</p>
                </div>
            </section>
        </MarketingLayout>
    );
};
