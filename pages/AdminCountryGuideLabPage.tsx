import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowSquareOut,
    Cards,
    GlobeHemisphereWest,
    Lightning,
    ShieldCheck,
    SimCard,
    SuitcaseRolling,
    Warning,
} from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

type CarryOverStatus = 'adopt_now' | 'needs_pipeline' | 'skip';
type GuideLayoutMode = 'navigator' | 'field_guide' | 'planner_assist';

interface CarryOverItem {
    title: string;
    description: string;
    status: CarryOverStatus;
}

interface GuideSection {
    id: string;
    title: string;
    eyebrow: string;
    summary: string;
    bullets: string[];
    badge: string;
}

interface LayoutOption {
    id: GuideLayoutMode;
    label: string;
    description: string;
}

const GUIDE_SOURCE_URL = 'https://atobeach.com/thailand-travel-guide';

const LAYOUT_OPTIONS: LayoutOption[] = [
    {
        id: 'navigator',
        label: 'Top Navigation',
        description: 'A public country brief with a strong hero, sticky chapter bar, and trip actions always in reach.',
    },
    {
        id: 'field_guide',
        label: 'Sidebar Field Guide',
        description: 'A denser travel-prep view with a persistent section index for travelers who want to read deeply.',
    },
    {
        id: 'planner_assist',
        label: 'Planner Companion',
        description: 'A hybrid destination guide that stays close to trip actions, checklists, and guide-to-trip handoff.',
    },
];

const CARRY_OVER_ITEMS: CarryOverItem[] = [
    {
        title: 'Entry rules and visa windows',
        description: 'High-value planning data. This should feed country guides, create-trip warnings, and trip-prep reminders.',
        status: 'adopt_now',
    },
    {
        title: 'Safety and legal heads-up summaries',
        description: 'Strong fit for TravelFlow. Keep this short, source-backed, and visible where users decide destinations or departures.',
        status: 'adopt_now',
    },
    {
        title: 'Health, money, SIM, power, and emergency utilities',
        description: 'Useful operational layer for country detail pages and a future prep hub.',
        status: 'adopt_now',
    },
    {
        title: 'Recent travel updates',
        description: 'Implement, but only with a durable external-source pipeline and freshness timestamps.',
        status: 'needs_pipeline',
    },
    {
        title: 'Forecast weather and live exchange rates',
        description: 'Good value, but these should come from live services rather than static markdown copy.',
        status: 'needs_pipeline',
    },
    {
        title: 'Flight and hotel booking chrome',
        description: 'Do not copy into the guide surface right now. TravelFlow should stay focused on planning quality, not generic OTA clutter.',
        status: 'skip',
    },
    {
        title: 'Large generic FAQ wall',
        description: 'Use selective FAQ snippets instead of a long SEO-style wall. Pull only questions that resolve actual trip friction.',
        status: 'skip',
    },
];

const GUIDE_SECTIONS: GuideSection[] = [
    {
        id: 'entry',
        title: 'Entry and legal basics',
        eyebrow: 'Before you book',
        summary: 'Thailand prototype: 60-day visa-free tourism, six-month passport validity, digital arrival card within three days before arrival.',
        bullets: [
            'Flag the 60-day stay window and one-time extension path.',
            'Show passport validity and blank-page requirement as a checklist row.',
            'Turn the digital arrival card into a dated trip reminder.',
        ],
        badge: 'Trip prep',
    },
    {
        id: 'safety',
        title: 'Safety and situational warnings',
        eyebrow: 'Before you go',
        summary: 'Keep travel warnings short, practical, and visible where they affect destination choice and traveler confidence.',
        bullets: [
            'Surface active regional warnings in a compact priority banner.',
            'Translate legal risks like vape bans into plain-language traveler notes.',
            'Feed high-risk warnings into create-trip and trip-level heads-up modules.',
        ],
        badge: 'Heads up',
    },
    {
        id: 'health',
        title: 'Health and medical readiness',
        eyebrow: 'Stay healthy',
        summary: 'Health content is strongest when it focuses on insurance, mosquito-borne risk, water guidance, and vaccine reminders.',
        bullets: [
            'Use one quick summary block plus action prompts for insurance and vaccines.',
            'Avoid long prose when a clear checklist is enough.',
            'Fold destination-specific health notes into packing and prep flows later.',
        ],
        badge: 'Checklist',
    },
    {
        id: 'money',
        title: 'Money, payments, and tipping',
        eyebrow: 'On the ground',
        summary: 'Card acceptance, ATM fallback, tipping customs, and example exchange context are highly reusable trip-ops content.',
        bullets: [
            'Show payment confidence by network instead of generic currency paragraphs.',
            'Keep tipping customs as fast-use cards by situation.',
            'Connect this later to budgeting and expense split features.',
        ],
        badge: 'Operations',
    },
    {
        id: 'connectivity',
        title: 'Connectivity and essentials',
        eyebrow: 'Stay connected',
        summary: 'SIM pricing, network coverage, sockets, Wi-Fi, and emergency numbers make the guide immediately practical.',
        bullets: [
            'Use dense utility cards instead of narrative copy.',
            'Show adapter, local SIM, and emergency numbers above the fold on mobile.',
            'Bundle embassy details with emergency help, not in a detached legal section.',
        ],
        badge: 'Utility',
    },
    {
        id: 'updates',
        title: 'Recent changes and official links',
        eyebrow: 'Stay current',
        summary: 'A compact update stream can be valuable, but only if each item is timestamped and clearly attributed to a source.',
        bullets: [
            'Limit updates to a short feed with date, source, and what changed.',
            'Show official source links for visa, embassy, and travel advice.',
            'Do not ship stale operational data without freshness metadata.',
        ],
        badge: 'Source-backed',
    },
];

const SIGNAL_PILLS = [
    { label: 'Visa-free', value: '60 days' },
    { label: 'Local SIM', value: '15 GB / 499 THB' },
    { label: 'Average Wi-Fi', value: '50 Mbps' },
    { label: 'Power', value: '220V · A/B/C/O' },
    { label: 'Emergency', value: '191' },
];

const ACTION_CARDS = [
    {
        title: 'Create trip from this brief',
        description: 'Send guide signals into the wizard and prefill warnings, climate, and trip-prep context.',
    },
    {
        title: 'Save to prep board',
        description: 'Convert entry rules, health notes, and SIM guidance into a trip checklist and reminder stack.',
    },
    {
        title: 'Pin to profile',
        description: 'Let travelers save country briefs to inspiration collections before the trip exists.',
    },
];

const getCarryOverTone = (status: CarryOverStatus) => {
    if (status === 'adopt_now') {
        return {
            containerClassName: 'border-emerald-200 bg-emerald-50/80',
            badgeClassName: 'bg-emerald-100 text-emerald-800',
            label: 'Adopt now',
        };
    }
    if (status === 'needs_pipeline') {
        return {
            containerClassName: 'border-amber-200 bg-amber-50/85',
            badgeClassName: 'bg-amber-100 text-amber-900',
            label: 'Needs pipeline',
        };
    }
    return {
        containerClassName: 'border-slate-200 bg-slate-100/90',
        badgeClassName: 'bg-slate-200 text-slate-700',
        label: 'Do not copy',
    };
};

const SignalChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm shadow-slate-200/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
);

const SectionShell: React.FC<{ section: GuideSection }> = ({ section }) => (
    <section className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{section.eyebrow}</p>
                <h3 className="mt-2 text-lg font-bold text-slate-950">{section.title}</h3>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                {section.badge}
            </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{section.summary}</p>
        <div className="mt-4 grid gap-2">
            {section.bullets.map((bullet) => (
                <div key={bullet} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {bullet}
                </div>
            ))}
        </div>
    </section>
);

const PreviewHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
    <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Preview direction</p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">{title}</h3>
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                Internal experiment
            </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
);

const NavigatorPreview: React.FC = () => (
    <div className="space-y-5">
        <PreviewHeader
            title="Top-nav country brief"
            description="Best fit for a public destination detail page. It keeps the page inspirational, but makes practical information and trip actions feel first-class instead of buried."
        />
        <div className="overflow-hidden rounded-[30px] border border-slate-300 bg-[linear-gradient(160deg,oklch(0.99_0.015_95)_0%,oklch(0.96_0.03_90)_55%,oklch(0.92_0.04_210)_100%)] shadow-xl shadow-slate-300/50">
            <div className="border-b border-slate-300/80 bg-white/75 px-6 py-4 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                            TravelFlow
                        </div>
                        <nav className="hidden gap-5 text-sm font-semibold text-slate-600 md:flex">
                            <span className="text-slate-950">Country guide</span>
                            <span>Regions</span>
                            <span>Trip prep</span>
                            <span>Recent updates</span>
                        </nav>
                    </div>
                    <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
                        Create trip
                    </button>
                </div>
            </div>

            <div className="space-y-6 px-6 py-7">
                <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,320px)]">
                    <div className="rounded-[32px] bg-slate-950 px-6 py-6 text-white shadow-xl shadow-slate-500/20">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Thailand operational guide</p>
                        <h2 className="mt-3 max-w-2xl text-4xl font-black tracking-tight text-white">Travel prep that belongs next to the itinerary, not buried in a booking site.</h2>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                            The strongest import from destination guides is the practical layer: entry, safety, money, mobile data, adapters, emergency help, and recent official updates.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            {SIGNAL_PILLS.map((pill) => (
                                <SignalChip key={pill.label} label={pill.label} value={pill.value} />
                            ))}
                        </div>
                    </div>

                    <aside className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-300/40 backdrop-blur">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                            <Warning size={18} weight="fill" />
                            Travel warning
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                            Active border-area disruptions near Malaysia and Cambodia should stay visible as a short, source-backed notice.
                        </p>
                        <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                            Best fit: show this at the top of the guide and again inside trip-level prep when departure is near.
                        </div>
                    </aside>
                </section>

                <div className="sticky top-3 z-10 rounded-full border border-slate-300/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                        {GUIDE_SECTIONS.map((section) => (
                            <span key={section.id} className="rounded-full bg-slate-100 px-3 py-2">
                                {section.title}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="grid gap-5">
                        {GUIDE_SECTIONS.slice(0, 3).map((section) => (
                            <SectionShell key={section.id} section={section} />
                        ))}
                    </div>
                    <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
                        {ACTION_CARDS.map((card) => (
                            <div key={card.title} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/80">
                                <p className="text-sm font-bold text-slate-950">{card.title}</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                            </div>
                        ))}
                    </aside>
                </div>
            </div>
        </div>
    </div>
);

const FieldGuidePreview: React.FC = () => (
    <div className="space-y-5">
        <PreviewHeader
            title="Sidebar field guide"
            description="Best fit for a denser country-information experience. This layout makes scanning, section jumping, and long-form prep information feel much more intentional."
        />
        <div className="overflow-hidden rounded-[30px] border border-slate-300 bg-[linear-gradient(180deg,oklch(0.98_0.012_85)_0%,oklch(0.95_0.015_215)_100%)] shadow-xl shadow-slate-300/50">
            <div className="border-b border-slate-300/70 bg-white/70 px-6 py-4 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Field guide prototype</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">A left-rail section map plus dense operational cards feels strong for deep-read country prep.</h2>
                    </div>
                    <div className="hidden rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 lg:block">
                        Source-backed utilities
                    </div>
                </div>
            </div>

            <div className="grid gap-5 px-6 py-6 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
                <aside className="rounded-[26px] border border-white/80 bg-white/80 p-4 shadow-sm shadow-slate-200/80 xl:sticky xl:top-6 xl:h-fit">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Guide sections</p>
                    <div className="mt-4 grid gap-2">
                        {GUIDE_SECTIONS.map((section, index) => (
                            <div
                                key={section.id}
                                className={`rounded-2xl px-3 py-3 text-sm ${index === 0 ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}
                            >
                                <p className="font-semibold">{section.title}</p>
                                <p className={`mt-1 text-xs ${index === 0 ? 'text-slate-300' : 'text-slate-500'}`}>{section.eyebrow}</p>
                            </div>
                        ))}
                    </div>
                </aside>

                <div className="grid gap-5">
                    {GUIDE_SECTIONS.map((section) => (
                        <SectionShell key={section.id} section={section} />
                    ))}
                </div>

                <aside className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
                    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/80">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick utilities</p>
                        <div className="mt-4 grid gap-3">
                            {SIGNAL_PILLS.map((pill) => (
                                <div key={pill.label} className="rounded-2xl bg-slate-100 px-4 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{pill.label}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{pill.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 shadow-sm shadow-amber-200/50">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">Recent update</p>
                        <p className="mt-3 text-sm font-semibold text-slate-950">Vehicle hire and insurance</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                            A short change log card works well here, but only if it carries a date and an official source link.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    </div>
);

const PlannerAssistPreview: React.FC = () => (
    <div className="space-y-5">
        <PreviewHeader
            title="Planner companion"
            description="Best fit if we want country guidance to feel tightly integrated with trip creation and upcoming-trip prep. This is the most TravelFlow-native direction."
        />
        <div className="overflow-hidden rounded-[30px] border border-slate-300 bg-[linear-gradient(180deg,oklch(0.98_0.01_220)_0%,oklch(0.93_0.03_200)_100%)] shadow-xl shadow-slate-300/50">
            <div className="border-b border-slate-300/70 bg-white/75 px-6 py-4 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">TravelFlow-native solution</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Guide on the left, trip actions on the right, with prep and warning modules living close to the actual plan.</h2>
                    </div>
                    <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        Recommended
                    </div>
                </div>
            </div>

            <div className="grid gap-5 px-6 py-6 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
                <aside className="rounded-[28px] border border-white/80 bg-white/80 p-4 shadow-sm shadow-slate-200/80">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Trip prep stack</p>
                    <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
                            <p className="text-sm font-semibold">Departure readiness</p>
                            <p className="mt-2 text-xs leading-5 text-slate-300">Arrival card, passport validity, and embassy details become checklist and reminder modules.</p>
                        </div>
                        <div className="rounded-2xl bg-slate-100 px-4 py-4">
                            <p className="text-sm font-semibold text-slate-950">Safety notes</p>
                            <p className="mt-2 text-xs leading-5 text-slate-600">Compact warning cards stay in-view while editing the trip.</p>
                        </div>
                        <div className="rounded-2xl bg-slate-100 px-4 py-4">
                            <p className="text-sm font-semibold text-slate-950">Utilities</p>
                            <p className="mt-2 text-xs leading-5 text-slate-600">SIM, plugs, emergency help, and money signals are always one glance away.</p>
                        </div>
                    </div>
                </aside>

                <div className="space-y-5">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-900">
                                Good product fit
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                                Thailand prototype
                            </span>
                        </div>
                        <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Turn country-guide content into a prep layer, not a travel encyclopedia.</h3>
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                            This direction keeps the public guide useful, but more importantly it gives TravelFlow a reason to reuse the same data in create-trip, trip info, prep checklists, and future operational alerts.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        {GUIDE_SECTIONS.slice(0, 4).map((section) => (
                            <SectionShell key={section.id} section={section} />
                        ))}
                    </div>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/80">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Guide actions</p>
                        <div className="mt-4 grid gap-3">
                            {ACTION_CARDS.map((card) => (
                                <button
                                    key={card.title}
                                    type="button"
                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-colors hover:bg-slate-100"
                                >
                                    <p className="text-sm font-semibold text-slate-950">{card.title}</p>
                                    <p className="mt-2 text-xs leading-5 text-slate-600">{card.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm shadow-emerald-200/60">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">Implementation note</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                            This layout is the best bridge into the roadmap work on destination intelligence, trip prep, alerts, packing, and budgeting.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    </div>
);

export const AdminCountryGuideLabPage: React.FC = () => {
    const [activeLayout, setActiveLayout] = useState<GuideLayoutMode>('planner_assist');

    useEffect(() => {
        trackEvent('admin__country_guide_lab--open');
    }, []);

    const activeLayoutDefinition = useMemo(
        () => LAYOUT_OPTIONS.find((option) => option.id === activeLayout) || LAYOUT_OPTIONS[0],
        [activeLayout]
    );

    return (
        <AdminShell
            title="Country Guide Lab"
            description="Internal experiment for turning destination-guide information into a stronger TravelFlow country-detail and trip-prep system."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <a
                    href={GUIDE_SOURCE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
                >
                    Review source guide
                    <ArrowSquareOut size={16} weight="bold" />
                </a>
            )}
        >
            <div className="space-y-6">
                <section className="overflow-hidden rounded-[34px] border border-slate-300 bg-[linear-gradient(135deg,oklch(0.985_0.012_92)_0%,oklch(0.955_0.02_220)_50%,oklch(0.92_0.035_205)_100%)] shadow-xl shadow-slate-300/40">
                    <div className="grid gap-6 px-6 py-7 xl:grid-cols-[minmax(0,1.2fr)_340px] xl:px-8 xl:py-8">
                        <div>
                            <p className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 backdrop-blur">
                                <GlobeHemisphereWest size={16} weight="duotone" />
                                Thailand guide experiment
                            </p>
                            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">
                                Convert destination-guide content into a three-layer TravelFlow system: discover, prepare, and go.
                            </h1>
                            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700">
                                The best reusable ideas from the reference guide are not the booking widgets. They are the operational travel facts that should follow users from country discovery into trip creation and then into departure prep.
                            </p>

                            <div className="mt-6 grid gap-3 md:grid-cols-3">
                                <div className="rounded-[26px] border border-white/80 bg-white/75 p-5 shadow-sm shadow-slate-200/80 backdrop-blur">
                                    <div className="flex items-center gap-3 text-slate-950">
                                        <Cards size={22} weight="duotone" />
                                        <p className="font-bold">Discover</p>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">Country detail pages should carry just enough inspiration to choose where to go and when.</p>
                                </div>
                                <div className="rounded-[26px] border border-white/80 bg-white/75 p-5 shadow-sm shadow-slate-200/80 backdrop-blur">
                                    <div className="flex items-center gap-3 text-slate-950">
                                        <ShieldCheck size={22} weight="duotone" />
                                        <p className="font-bold">Prepare</p>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">Entry rules, safety, health, money, SIM, and emergency data should become reusable trip-prep modules.</p>
                                </div>
                                <div className="rounded-[26px] border border-white/80 bg-white/75 p-5 shadow-sm shadow-slate-200/80 backdrop-blur">
                                    <div className="flex items-center gap-3 text-slate-950">
                                        <SuitcaseRolling size={22} weight="duotone" />
                                        <p className="font-bold">Go</p>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">The same signals should later feed checklist, alerts, packing, budgeting, and upcoming-trip utilities.</p>
                                </div>
                            </div>
                        </div>

                        <aside className="rounded-[30px] border border-slate-950/10 bg-slate-950 px-5 py-5 text-white shadow-xl shadow-slate-500/20">
                            <div className="flex items-center gap-3 text-amber-200">
                                <Lightning size={18} weight="fill" />
                                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Recommended solution</p>
                            </div>
                            <h2 className="mt-4 text-2xl font-black tracking-tight text-white">Start with a planner companion, then back-port the best parts to the public country page.</h2>
                            <p className="mt-4 text-sm leading-6 text-slate-300">
                                TravelFlow wins when operational guidance is connected to trip actions. The public guide can stay lighter, while the real product value comes from reusing the same data inside trip creation, prep, and trip view.
                            </p>
                            <div className="mt-6 grid gap-3">
                                {SIGNAL_PILLS.map((pill) => (
                                    <div key={pill.label} className="rounded-2xl bg-white/10 px-4 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{pill.label}</p>
                                        <p className="mt-1 text-sm font-semibold text-white">{pill.value}</p>
                                    </div>
                                ))}
                            </div>
                        </aside>
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80">
                        <div className="flex items-center gap-3">
                            <Warning size={20} weight="duotone" className="text-amber-700" />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Carry-over audit</p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">What should TravelFlow borrow from guide-style country pages?</h2>
                            </div>
                        </div>
                        <div className="mt-5 grid gap-3">
                            {CARRY_OVER_ITEMS.map((item) => {
                                const tone = getCarryOverTone(item.status);
                                return (
                                    <div key={item.title} className={`rounded-[24px] border p-4 ${tone.containerClassName}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-sm font-bold text-slate-950">{item.title}</p>
                                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone.badgeClassName}`}>
                                                {tone.label}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Implementation recommendation</p>
                        <div className="mt-4 space-y-4">
                            <div className="rounded-[24px] bg-slate-100 p-4">
                                <p className="text-sm font-bold text-slate-950">Phase 1</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">Ship this as an internal pattern lab, then promote the data model into the country detail route once the section hierarchy feels right.</p>
                            </div>
                            <div className="rounded-[24px] bg-slate-100 p-4">
                                <p className="text-sm font-bold text-slate-950">Phase 2</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">Reuse the same signals in create-trip warnings, trip prep, checklist, and future alerts instead of leaving them trapped in marketing copy.</p>
                            </div>
                            <div className="rounded-[24px] bg-slate-100 p-4">
                                <p className="text-sm font-bold text-slate-950">Phase 3</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">Back this with the destination intelligence roadmap so country pages stop being static content and become product infrastructure.</p>
                            </div>
                        </div>
                    </aside>
                </section>

                <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80">
                    <Tabs value={activeLayout} onValueChange={(value) => {
                        const nextValue = value as GuideLayoutMode;
                        setActiveLayout(nextValue);
                        trackEvent('admin__country_guide_lab_layout--select', { mode: nextValue });
                    }}>
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Layout lab</p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">One page, three navigation systems</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                    Switch the same Thailand content model between a top-nav brief, a sidebar-heavy field guide, and a planner-centric hybrid to pressure-test the information architecture.
                                </p>
                            </div>
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <p className="font-semibold text-slate-950">{activeLayoutDefinition.label}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{activeLayoutDefinition.description}</p>
                            </div>
                        </div>

                        <TabsList variant="line" className="mt-6 flex-wrap">
                            {LAYOUT_OPTIONS.map((option) => (
                                <TabsTrigger
                                    key={option.id}
                                    value={option.id}
                                    {...getAnalyticsDebugAttributes('admin__country_guide_lab_layout--select', { mode: option.id })}
                                >
                                    {option.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="navigator" className="mt-6">
                            <NavigatorPreview />
                        </TabsContent>
                        <TabsContent value="field_guide" className="mt-6">
                            <FieldGuidePreview />
                        </TabsContent>
                        <TabsContent value="planner_assist" className="mt-6">
                            <PlannerAssistPreview />
                        </TabsContent>
                    </Tabs>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/80">
                        <div className="flex items-center gap-3 text-slate-950">
                            <ShieldCheck size={20} weight="duotone" />
                            <p className="text-sm font-bold">Good for immediate implementation</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">Entry, safety, health, money, utilities, and emergency information fit the current roadmap and can be made useful fast.</p>
                    </div>
                    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/80">
                        <div className="flex items-center gap-3 text-slate-950">
                            <SimCard size={20} weight="duotone" />
                            <p className="text-sm font-bold">Best product bridge</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">Country guide data should flow into trip-prep, alerts, packing, and future budgeting instead of remaining isolated on a content page.</p>
                    </div>
                    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/80">
                        <div className="flex items-center gap-3 text-slate-950">
                            <Cards size={20} weight="duotone" />
                            <p className="text-sm font-bold">Best first public expression</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">A lighter top-nav brief works publicly, but the internal recommended direction is still the planner companion because it turns guide content into product leverage.</p>
                    </div>
                </section>
            </div>
        </AdminShell>
    );
};
