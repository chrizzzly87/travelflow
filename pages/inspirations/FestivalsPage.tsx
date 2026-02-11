import React from 'react';
import { Link } from 'react-router-dom';
import { Confetti, ArrowLeft } from '@phosphor-icons/react';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';

export const FestivalsPage: React.FC = () => {
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
                    <Confetti size={14} weight="duotone" />
                    Events & Festivals
                </span>
                <h1
                    className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
                    style={{ fontFamily: "var(--tf-font-heading)" }}
                >
                    Plan Your Trip Around a Festival
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    The world's greatest celebrations deserve more than a last-minute flight. Discover upcoming festivals sorted by date — from Carnival in Rio to lantern festivals in Taiwan — and build your itinerary around the event.
                </p>
            </section>

            <section className="pb-16 md:pb-24">
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                        Coming soon
                    </span>
                    <p className="mt-4 text-sm text-slate-500">
                        Detailed festival guides with schedules, accommodation tips, and day-by-day itinerary suggestions are on the way.
                    </p>
                </div>
            </section>
        </MarketingLayout>
    );
};
