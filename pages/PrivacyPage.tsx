import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

export const PrivacyPage: React.FC = () => {
    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Privacy Policy</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    This policy placeholder exists so legal navigation is complete. Replace this with your approved privacy policy text before launch.
                </p>
                <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    <li>What personal data is collected and why.</li>
                    <li>How long data is stored and where.</li>
                    <li>Lawful basis for processing and user rights.</li>
                    <li>Contact details for privacy requests and deletion.</li>
                </ul>
            </section>
        </MarketingLayout>
    );
};
