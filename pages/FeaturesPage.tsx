import React from 'react';
import { Link } from 'react-router-dom';
import {
    Sparkle,
    MapTrifold,
    SlidersHorizontal,
    UsersThree,
    ShareNetwork,
    LinkSimple,
    Timer,
    DeviceMobile,
    Printer,
    Globe,
    ArrowsClockwise,
    ShieldCheck,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { trackEvent } from '../services/analyticsService';

interface Feature {
    icon: Icon;
    title: string;
    description: string;
    color: string;
}

const heroFeatures: Feature[] = [
    {
        icon: Sparkle,
        title: 'AI Trip Generation',
        description:
            'Describe where you want to go and TravelFlow creates a full itinerary — optimized routes, curated activities, realistic timing — in under 30 seconds. Classic, Wizard, or Surprise Me modes adapt to how you like to plan.',
        color: 'bg-violet-50 text-violet-600 ring-violet-100',
    },
    {
        icon: MapTrifold,
        title: 'Interactive Map & Timeline',
        description:
            'Your trip lives on a real map with animated route lines, city markers, and dynamic zoom. Below the map, a visual timeline shows every day at a glance. Switch between satellite, terrain, and minimalist styles.',
        color: 'bg-sky-50 text-sky-600 ring-sky-100',
    },
    {
        icon: SlidersHorizontal,
        title: 'Drag-and-Drop Editing',
        description:
            'Reorder cities, stretch stay durations, and insert spontaneous stops — all by dragging on the timeline. Dates, connections, and the map update automatically so everything stays in sync.',
        color: 'bg-amber-50 text-amber-600 ring-amber-100',
    },
];

const secondaryFeatures: { icon: Icon; title: string; description: string }[] = [
    {
        icon: ShareNetwork,
        title: 'One-Click Sharing',
        description: 'Generate a link and send it to your travel crew. They see the full map, timeline, and activities — no account needed.',
    },
    {
        icon: UsersThree,
        title: 'Community Inspirations',
        description: 'Browse curated trips from travelers worldwide. Fork any itinerary as a starting point and make it your own.',
    },
    {
        icon: LinkSimple,
        title: 'Booking Links',
        description: 'Every AI-suggested activity links to booking platforms — tours, restaurants, transport — so you can reserve without leaving TravelFlow.',
    },
    {
        icon: Timer,
        title: 'Smart Duration Hints',
        description: 'TravelFlow analyzes seasonal data and travel distances to suggest how long to spend in each city so you never feel rushed.',
    },
    {
        icon: DeviceMobile,
        title: 'Mobile-Optimized',
        description: 'Plan on the go with a responsive layout tuned for phones and tablets. The map, timeline, and editing all adapt to smaller screens.',
    },
    {
        icon: Printer,
        title: 'Print-Ready Itineraries',
        description: 'Switch to print view for a clean, paper-friendly itinerary with day headers, activity lists, and essential logistics.',
    },
    {
        icon: Globe,
        title: 'Multi-Country Routing',
        description: 'Select multiple countries or islands and TravelFlow builds a cross-border route with realistic transit between regions.',
    },
    {
        icon: ArrowsClockwise,
        title: 'Version History',
        description: 'Every meaningful change creates a snapshot. Jump back to any previous version of your trip with a single click.',
    },
    {
        icon: ShieldCheck,
        title: 'Privacy-First',
        description: 'Your trips stay local by default. Optional cloud sync is consent-gated, and analytics only run after explicit opt-in.',
    },
];

const comparisonRows = [
    { feature: 'AI-generated itinerary', travelflow: true, spreadsheet: false, other: 'Partial' },
    { feature: 'Interactive map', travelflow: true, spreadsheet: false, other: true },
    { feature: 'Drag-and-drop timeline', travelflow: true, spreadsheet: false, other: false },
    { feature: 'One-click sharing', travelflow: true, spreadsheet: 'Manual', other: true },
    { feature: 'Booking links', travelflow: true, spreadsheet: false, other: 'Partial' },
    { feature: 'Offline-first / local data', travelflow: true, spreadsheet: false, other: false },
    { feature: 'Free to use', travelflow: true, spreadsheet: true, other: 'Freemium' },
];

const ComparisonCell: React.FC<{ value: boolean | string }> = ({ value }) => {
    if (value === true) return <span className="text-emerald-600 font-bold">Yes</span>;
    if (value === false) return <span className="text-slate-300">—</span>;
    return <span className="text-amber-600 text-xs font-medium">{value}</span>;
};

export const FeaturesPage: React.FC = () => {
    return (
        <MarketingLayout>
            {/* ── Hero ── */}
            <section className="pt-8 pb-16 md:pt-14 md:pb-24 animate-hero-entrance">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                    Product Capabilities
                </span>
                <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Plan smarter, travel better
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    TravelFlow combines AI generation, visual editing, and collaboration into one workspace. Here is everything the platform can do for your next trip.
                </p>
            </section>

            {/* ── Three hero feature cards ── */}
            <section className="grid gap-6 md:grid-cols-3 pb-20">
                {heroFeatures.map((feature, index) => {
                    const IconComponent = feature.icon;
                    return (
                        <article
                            key={feature.title}
                            className="animate-scroll-blur-in rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
                            style={{ animationDelay: `${index * 80}ms` }}
                        >
                            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${feature.color}`}>
                                <IconComponent size={24} weight="duotone" />
                            </div>
                            <h2 className="mt-5 text-lg font-bold text-slate-900">{feature.title}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                        </article>
                    );
                })}
            </section>

            {/* ── Visual break: workflow steps ── */}
            <section className="py-16 md:py-24 border-t border-slate-200">
                <div className="animate-scroll-blur-in text-center">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">How it works</h2>
                    <p className="mx-auto mt-3 max-w-lg text-base text-slate-600">From idea to itinerary in three steps.</p>
                </div>

                <div className="mt-14 grid gap-8 md:grid-cols-3">
                    {[
                        { step: '01', title: 'Choose your destination', description: 'Pick countries, islands, or let Surprise Me suggest the perfect match for your travel window.' },
                        { step: '02', title: 'Generate with AI', description: 'Our model drafts a full route with city timing, activities, and logistics. Tweak the result in seconds.' },
                        { step: '03', title: 'Refine & share', description: 'Drag cities, adjust durations, add notes. Then share a link — your crew sees the live map and timeline.' },
                    ].map((item, index) => (
                        <div key={item.step} className="animate-scroll-fade-up text-center" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-600 text-white text-lg font-black">
                                {item.step}
                            </div>
                            <h3 className="mt-4 text-base font-bold text-slate-900">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Secondary feature grid ── */}
            <section className="py-16 md:py-24 border-t border-slate-200">
                <div className="animate-scroll-blur-in">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">And so much more</h2>
                    <p className="mt-3 max-w-xl text-base text-slate-600">Every detail is designed to remove friction from trip planning.</p>
                </div>

                <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {secondaryFeatures.map((feature) => {
                        const IconComponent = feature.icon;
                        return (
                            <div
                                key={feature.title}
                                className="animate-scroll-fade-up rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                                    <IconComponent size={22} weight="duotone" />
                                </div>
                                <h3 className="mt-4 text-sm font-bold text-slate-900">{feature.title}</h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{feature.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Comparison table ── */}
            <section className="py-16 md:py-24 border-t border-slate-200">
                <div className="animate-scroll-blur-in">
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">How TravelFlow compares</h2>
                    <p className="mt-3 max-w-xl text-base text-slate-600">Side-by-side against spreadsheet planning and other trip tools.</p>
                </div>

                <div className="mt-10 overflow-x-auto animate-scroll-fade-up">
                    <table className="w-full min-w-[540px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left">
                                <th className="py-3 pr-4 font-semibold text-slate-500">Feature</th>
                                <th className="py-3 px-4 font-bold text-accent-700">TravelFlow</th>
                                <th className="py-3 px-4 font-semibold text-slate-500">Spreadsheet</th>
                                <th className="py-3 px-4 font-semibold text-slate-500">Other Tools</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonRows.map((row) => (
                                <tr key={row.feature} className="border-b border-slate-100">
                                    <td className="py-3 pr-4 text-slate-700">{row.feature}</td>
                                    <td className="py-3 px-4"><ComparisonCell value={row.travelflow} /></td>
                                    <td className="py-3 px-4"><ComparisonCell value={row.spreadsheet} /></td>
                                    <td className="py-3 px-4"><ComparisonCell value={row.other} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Bottom CTA ── */}
            <section className="pb-16 md:pb-24 animate-scroll-scale-in">
                <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                    <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-[60px]" />
                    <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent-400/20 blur-[50px]" />

                    <h2 className="relative text-3xl font-black tracking-tight text-white md:text-5xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        See it in action
                    </h2>
                    <p className="relative mx-auto mt-4 max-w-xl text-base text-accent-100 md:text-lg">
                        Create your first AI-powered itinerary in under a minute.
                    </p>
                    <Link
                        to="/create-trip"
                        onClick={() => trackEvent('features__bottom_cta')}
                        className="relative mt-8 inline-block rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:shadow-xl hover:bg-accent-50 hover:scale-[1.03] active:scale-[0.98]"
                    >
                        Start Planning — Free
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
