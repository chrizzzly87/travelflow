import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { CalendarClock, MapPinned, Route, Sparkles } from 'lucide-react';
import { trackEvent } from '../services/analyticsService';

const featureCards = [
    {
        title: 'AI trip generation',
        description: 'Draft a full route with city timing and activity suggestions in seconds.',
        icon: Sparkles,
    },
    {
        title: 'Map + timeline planning',
        description: 'Adjust city durations and route flow visually while keeping trip context.',
        icon: Route,
    },
    {
        title: 'Share and collaborate',
        description: 'Send view-only or editable links and keep versions in history.',
        icon: MapPinned,
    },
    {
        title: 'Print-ready itineraries',
        description: 'Switch to print view for a cleaner itinerary export and travel brief.',
        icon: CalendarClock,
    },
];

export const MarketingHomePage: React.FC = () => {
    const handleHeroCtaClick = (ctaName: string) => {
        trackEvent('marketing_hero_cta_clicked', {
            cta_name: ctaName,
            page: 'home',
        });
    };

    return (
        <MarketingLayout>
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
                <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-accent-300/40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 left-8 h-72 w-72 rounded-full bg-accent-200/50 blur-3xl" />

                <div className="relative max-w-3xl">
                    <span className="inline-flex rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-700">
                        Future-ready planning workspace
                    </span>
                    <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
                        Build better trips with less planning overhead
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
                        TravelFlow combines AI itinerary generation, timeline editing, map visualization, and collaboration links in one clean workflow.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Link
                            to="/create-trip"
                            onClick={() => handleHeroCtaClick('create_trip')}
                            className="rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                        >
                            Create Trip
                        </Link>
                        <Link
                            to="/features"
                            onClick={() => handleHeroCtaClick('see_features')}
                            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                        >
                            See features
                        </Link>
                    </div>
                </div>
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-2">
                {featureCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                <Icon size={18} />
                            </span>
                            <h2 className="mt-4 text-lg font-bold text-slate-900">{card.title}</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                        </article>
                    );
                })}
            </section>
        </MarketingLayout>
    );
};
