import React from 'react';
import {
    ArrowSquareOut,
    GlobeHemisphereWest,
    Lightning,
    ShieldCheck,
    Warning,
} from '@phosphor-icons/react';
import type { CountryGuideTone, ICountryGuideFact, ICountryGuideSection, ICountryTravelGuide } from '../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

interface CountryGuideInfoProps {
    guide: ICountryTravelGuide;
}

const getToneClassNames = (tone?: CountryGuideTone) => {
    if (tone === 'accent') {
        return {
            card: 'border-emerald-200 bg-emerald-50/80',
            pill: 'bg-emerald-100 text-emerald-900',
        };
    }
    if (tone === 'warning') {
        return {
            card: 'border-amber-200 bg-amber-50/85',
            pill: 'bg-amber-100 text-amber-900',
        };
    }
    return {
        card: 'border-slate-200 bg-slate-50/90',
        pill: 'bg-slate-200 text-slate-700',
    };
};

const GuideFactCard: React.FC<{ fact: ICountryGuideFact }> = ({ fact }) => {
    const tone = getToneClassNames(fact.tone);
    return (
        <div className={`rounded-2xl border px-4 py-4 shadow-sm shadow-slate-200/70 ${tone.card}`}>
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{fact.label}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.pill}`}>
                    {fact.tone || 'snapshot'}
                </span>
            </div>
            <p className="mt-3 text-base font-bold leading-6 text-slate-950">{fact.value}</p>
            {fact.helper && (
                <p className="mt-2 text-sm leading-6 text-slate-600">{fact.helper}</p>
            )}
        </div>
    );
};

const GuideSectionCard: React.FC<{ section: ICountryGuideSection }> = ({ section }) => {
    const tone = getToneClassNames(section.tone);
    return (
        <section className={`rounded-[24px] border px-5 py-5 shadow-sm shadow-slate-200/80 ${tone.card}`}>
            {section.eyebrow && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.eyebrow}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-lg font-bold text-slate-950">{section.title}</h4>
                <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.pill}`}>
                    {section.tone || 'guide'}
                </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{section.summary}</p>
            <div className="mt-4 grid gap-2">
                {section.bullets.map((bullet) => (
                    <div key={`${section.id}-${bullet}`} className="rounded-2xl bg-white/75 px-4 py-3 text-sm leading-6 text-slate-700">
                        {bullet}
                    </div>
                ))}
            </div>
        </section>
    );
};

export const CountryGuideInfo: React.FC<CountryGuideInfoProps> = ({ guide }) => {
    const hasQuickFacts = (guide.quickFacts?.length || 0) > 0;
    const hasSections = (guide.sections?.length || 0) > 0;
    const hasUtilities = (guide.utilities?.length || 0) > 0;
    const hasOfficialLinks = (guide.officialLinks?.length || 0) > 0;
    const hasUpdates = (guide.updates?.length || 0) > 0;

    return (
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,oklch(0.985_0.012_92)_0%,oklch(0.96_0.018_210)_52%,oklch(0.93_0.03_200)_100%)] px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                        <p className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                            <GlobeHemisphereWest size={14} weight="duotone" />
                            Travel prep companion
                        </p>
                        <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-950">{guide.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{guide.summary}</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-950/10 bg-slate-950 px-4 py-3 text-white shadow-lg shadow-slate-300/30">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                            <ShieldCheck size={14} weight="fill" />
                            Guide mode
                        </div>
                        <p className="mt-2 max-w-[16rem] text-sm leading-6 text-slate-200">
                            Use this to pressure-test how destination guidance should support the planner before it becomes a public country page.
                        </p>
                    </div>
                </div>
                {guide.disclaimer && (
                    <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-950">
                        <div className="flex items-start gap-2">
                            <Warning size={16} weight="fill" className="mt-1 shrink-0 text-amber-700" />
                            <span>{guide.disclaimer}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-6 px-5 py-5">
                {hasQuickFacts && (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {guide.quickFacts?.map((fact) => (
                            <GuideFactCard key={`${fact.label}-${fact.value}`} fact={fact} />
                        ))}
                    </div>
                )}

                {hasSections && (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {guide.sections?.map((section) => (
                            <GuideSectionCard key={section.id} section={section} />
                        ))}
                    </div>
                )}

                {(hasUtilities || hasOfficialLinks || hasUpdates) && (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
                        <div className="space-y-4">
                            {hasUtilities && (
                                <section className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 shadow-sm shadow-slate-200/70">
                                    <div className="flex items-center gap-2 text-slate-950">
                                        <Lightning size={18} weight="duotone" />
                                        <h4 className="text-base font-bold">Utilities and emergency snapshot</h4>
                                    </div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        {guide.utilities?.map((fact) => (
                                            <div key={`${fact.label}-${fact.value}`} className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{fact.label}</p>
                                                <p className="mt-2 text-sm font-bold text-slate-950">{fact.value}</p>
                                                {fact.helper && (
                                                    <p className="mt-2 text-sm leading-6 text-slate-600">{fact.helper}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {hasUpdates && (
                                <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm shadow-slate-200/80">
                                    <div className="flex items-center gap-2 text-slate-950">
                                        <Warning size={18} weight="duotone" />
                                        <h4 className="text-base font-bold">Recent guide updates worth testing</h4>
                                    </div>
                                    <div className="mt-4 grid gap-3">
                                        {guide.updates?.map((update) => (
                                            <article key={update.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                                                        {update.category}
                                                    </span>
                                                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                        {update.ageLabel}
                                                    </span>
                                                </div>
                                                <p className="mt-3 text-sm font-bold text-slate-950">{update.title}</p>
                                                <p className="mt-2 text-sm leading-6 text-slate-600">{update.summary}</p>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {hasOfficialLinks && (
                            <aside className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm shadow-slate-200/80 xl:sticky xl:top-4 xl:h-fit">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Official sources</p>
                                <div className="mt-4 grid gap-3">
                                    {guide.officialLinks?.map((link) => (
                                        <a
                                            key={link.url}
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={() => {
                                                trackEvent('trip_view__country_guide_source', {
                                                    label: link.label,
                                                });
                                            }}
                                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-colors hover:bg-slate-100"
                                            {...getAnalyticsDebugAttributes('trip_view__country_guide_source', { label: link.label })}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-950">{link.label}</p>
                                                    {link.helper && (
                                                        <p className="mt-2 text-sm leading-6 text-slate-600">{link.helper}</p>
                                                    )}
                                                </div>
                                                <ArrowSquareOut size={16} weight="bold" className="mt-1 shrink-0 text-slate-500" />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </aside>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};
