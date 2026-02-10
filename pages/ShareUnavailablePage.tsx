import React from 'react';
import { Link } from 'react-router-dom';
import { WarningCircle } from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

export const ShareUnavailablePage: React.FC = () => {
    return (
        <MarketingLayout>
            <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-accent-200 bg-accent-50 text-accent-700">
                    <WarningCircle size={20} weight="duotone" />
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">This shared trip is no longer available</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                    The link may have expired or has been deactivated by the trip owner.
                    Please ask for a fresh link or create your own trip to continue planning.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                    <Link
                        to="/"
                        className="inline-flex h-10 items-center rounded-md border border-accent-200 bg-white px-4 text-sm font-semibold text-accent-700 hover:bg-accent-50"
                    >
                        Back to homepage
                    </Link>
                    <Link
                        to="/create-trip"
                        className="inline-flex h-10 items-center rounded-md bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700"
                    >
                        Create new trip
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
