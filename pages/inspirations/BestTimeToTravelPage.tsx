import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDots, ArrowLeft } from '@phosphor-icons/react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';

export const BestTimeToTravelPage: React.FC = () => {
    return (
        <MarketingLayout>
            <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
                <Link
                    to="/inspirations"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-700 transition-colors mb-6"
                >
                    <ArrowLeft size={14} weight="bold" />
                    Back to Inspirations
                </Link>
                <span className="flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700 w-fit">
                    <CalendarDots size={14} weight="duotone" />
                    Best Time to Travel
                </span>
                <h1
                    className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
                    style={{ fontFamily: "var(--tf-font-heading)" }}
                >
                    When to Go Where
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    Every destination has a sweet spot — the month when weather, crowds, and prices align perfectly. Use our month-by-month guide to pick the ideal time for your next trip.
                </p>
            </section>

            <section className="pb-16 md:pb-24">
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                        Coming soon
                    </span>
                    <p className="mt-4 text-sm text-slate-500">
                        Detailed seasonal guides with weather data, peak-season alerts, and budget tips for every month are on the way.
                    </p>
                </div>
            </section>
        </MarketingLayout>
    );
};
