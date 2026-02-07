import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

export const ImprintPage: React.FC = () => {
    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Imprint</h1>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                    This legal imprint page is set up as a placeholder. Replace the fields below with your official business and contact details before production launch.
                </p>
                <div className="mt-6 space-y-4 text-sm text-slate-700">
                    <p><strong>Company:</strong> TravelFlow (placeholder)</p>
                    <p><strong>Address:</strong> Replace with legal business address</p>
                    <p><strong>Email:</strong> legal@travelflow.example</p>
                    <p><strong>Responsible person:</strong> Replace with legal representative</p>
                    <p><strong>VAT / registration:</strong> Replace with required local registration identifiers</p>
                </div>
            </section>
        </MarketingLayout>
    );
};
