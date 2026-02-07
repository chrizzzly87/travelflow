import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

export const TermsPage: React.FC = () => {
    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Terms of Service</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    This terms page is a structural placeholder. Replace with your legal terms for account, billing, acceptable use, and liability limitations.
                </p>
                <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    <li>Service scope and account responsibilities.</li>
                    <li>Subscription/paywall terms and billing policy.</li>
                    <li>Prohibited uses and suspension policy.</li>
                    <li>Warranty disclaimer and limitation of liability.</li>
                </ul>
            </section>
        </MarketingLayout>
    );
};
