import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    CalendarCheck,
    CheckCircle,
    Clock,
    MapPinLine,
    MapTrifold,
    PencilSimpleLine,
    ShareNetwork,
    Sparkle,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';
import { warmRouteAssets } from '../../services/navigationPrefetch';
import { buildCreateTripUrl } from '../../utils';

/** Animated hand-drawn zigzag underline SVG */
const ZigzagUnderline: React.FC = () => (
    <svg
        className="pointer-events-none absolute -bottom-[10%] left-0 w-full"
        viewBox="0 0 200 14"
        fill="none"
        preserveAspectRatio="none"
        style={{ height: '0.18em' }}
    >
        <path
            d="M 2 8 L 18 3 L 36 10 L 54 2 L 71 9 L 88 3 L 106 10 L 123 2 L 140 9 L 157 3 L 174 10 L 191 4 L 198 7"
            stroke="var(--tf-accent-400)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hand-drawn-zigzag"
            style={{ filter: 'url(#zigzag-roughen)' }}
        />
        <defs>
            <filter id="zigzag-roughen" x="-5%" y="-20%" width="110%" height="140%">
                <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="3" seed="7" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </defs>
    </svg>
);

export const HeroSection: React.FC = () => {
    const { t } = useTranslation('home');
    const navigate = useNavigate();
    const [plannerPrompt, setPlannerPrompt] = useState('');
    const samplePrompt = t('hero.prompt.sample');
    const proofPoints = t('hero.proof', { returnObjects: true }) as string[];
    const routeStops = t('hero.preview.routeStops', { returnObjects: true }) as string[];
    const dayCards = t('hero.preview.days', { returnObjects: true }) as Array<{
        day: string;
        title: string;
        detail: string;
    }>;

    const sampleTripUrl = useMemo(() => buildCreateTripUrl({
        countries: ['Portugal', 'Spain'],
        pace: 'Balanced',
        budget: 'Medium',
        roundTrip: false,
        notes: samplePrompt,
        styles: ['culture', 'food'],
        meta: {
            source: 'homepage_hero',
            label: t('hero.prompt.prefillLabel'),
        },
    }), [samplePrompt, t]);

    const handleCtaClick = (ctaName: string) => {
        trackEvent(`home__hero_cta--${ctaName}`);
    };

    const heroCtaDebugAttributes = (ctaName: string) =>
        getAnalyticsDebugAttributes(`home__hero_cta--${ctaName}`);

    const prewarmCreateTripRoute = () => {
        void warmRouteAssets(buildPath('createTrip'), 'manual');
    };

    const handlePromptSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const prompt = plannerPrompt.trim() || samplePrompt;
        trackEvent('home__hero_prompt--submit', {
            prompt_source: plannerPrompt.trim() ? 'typed' : 'sample',
        });
        navigate(buildCreateTripUrl({
            notes: prompt,
            pace: 'Balanced',
            budget: 'Medium',
            meta: {
                source: 'homepage_hero_prompt',
                label: t('hero.prompt.prefillLabel'),
            },
        }));
    };

    return (
        <section className="relative pt-20 pb-16 md:pt-12 md:pb-24">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(248,250,252,0))]" />

            <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(500px,1fr)] lg:gap-14">
                <div className="max-w-3xl">
                    <div className="animate-hero-stagger" style={{ '--stagger': '0ms' } as React.CSSProperties}>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700 shadow-sm">
                            <Sparkle size={14} weight="duotone" />
                            {t('hero.badge')}
                        </span>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '80ms' } as React.CSSProperties}>
                        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                            {t('hero.titleBefore')} {' '}
                            <span className="relative inline-block">
                                {t('hero.titleHighlight')}
                                <ZigzagUnderline />
                            </span>
                        </h1>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '160ms' } as React.CSSProperties}>
                        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
                            {t('hero.description')}
                        </p>
                    </div>

                    <form
                        onSubmit={handlePromptSubmit}
                        className="mt-8 animate-hero-stagger rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60 md:flex md:items-center md:gap-2"
                        style={{ '--stagger': '240ms' } as React.CSSProperties}
                    >
                        <label className="sr-only" htmlFor="homepage-trip-prompt">
                            {t('hero.prompt.label')}
                        </label>
                        <input
                            id="homepage-trip-prompt"
                            type="text"
                            value={plannerPrompt}
                            onChange={(event) => setPlannerPrompt(event.target.value)}
                            onFocus={prewarmCreateTripRoute}
                            placeholder={samplePrompt}
                            className="min-h-12 w-full rounded-xl border-0 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-accent-300 md:flex-1"
                        />
                        <button
                            type="submit"
                            onMouseEnter={prewarmCreateTripRoute}
                            onFocus={prewarmCreateTripRoute}
                            className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-600 px-5 text-sm font-bold text-white shadow-md shadow-accent-200 transition hover:bg-accent-700 active:scale-[0.98] md:mt-0 md:w-auto"
                            {...getAnalyticsDebugAttributes('home__hero_prompt--submit')}
                        >
                            {t('hero.prompt.cta')}
                            <ArrowRight size={16} weight="bold" />
                        </button>
                    </form>

                    <div className="mt-5 flex flex-wrap gap-2.5 animate-hero-stagger" style={{ '--stagger': '320ms' } as React.CSSProperties}>
                        {proofPoints.map((point) => (
                            <span key={point} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                                <CheckCircle size={14} weight="fill" className="text-emerald-500" />
                                {point}
                            </span>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-4 animate-hero-stagger" style={{ '--stagger': '380ms' } as React.CSSProperties}>
                        <Link
                            to={sampleTripUrl}
                            onClick={() => handleCtaClick('start_with_sample')}
                            onMouseEnter={prewarmCreateTripRoute}
                            onFocus={prewarmCreateTripRoute}
                            onTouchStart={prewarmCreateTripRoute}
                            className="group relative rounded-2xl bg-slate-950 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-slate-300 transition-all hover:bg-slate-800 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                            {...heroCtaDebugAttributes('start_with_sample')}
                        >
                            {t('hero.sampleCta')}
                        </Link>
                        <a
                            href="#examples"
                            onClick={() => handleCtaClick('see_examples')}
                            className="rounded-2xl border border-slate-300 bg-white px-7 py-3.5 text-base font-bold text-slate-700 transition-all hover:border-slate-400 hover:text-slate-900 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                            {...heroCtaDebugAttributes('see_examples')}
                        >
                            {t('common:buttons.seeExampleTrips')}
                        </a>
                    </div>
                </div>

                <div className="animate-hero-stagger" style={{ '--stagger': '420ms' } as React.CSSProperties}>
                    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300/70">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">{t('hero.preview.eyebrow')}</p>
                                <h2 className="mt-1 text-lg font-semibold text-slate-950">{t('hero.preview.title')}</h2>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                <Clock size={13} weight="duotone" />
                                {t('hero.preview.timeSaved')}
                            </span>
                        </div>

                        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-e">
                                <div className="rounded-2xl bg-slate-950 p-4 text-white">
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200">
                                            <MapTrifold size={15} weight="duotone" />
                                            {t('hero.preview.mapLabel')}
                                        </span>
                                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                                            {t('hero.preview.routeLabel')}
                                        </span>
                                    </div>
                                    <div className="relative mt-5 h-56 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.24),transparent_32%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.2),transparent_30%),linear-gradient(135deg,#0f172a,#1e293b)]">
                                        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 220" role="img" aria-label={t('hero.preview.mapAria')}>
                                            <path d="M 42 168 C 78 120, 112 148, 146 92 S 232 82, 272 40" fill="none" stroke="rgba(125,211,252,0.9)" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" />
                                            {[['42', '168'], ['146', '92'], ['272', '40']].map(([cx, cy]) => (
                                                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill="#f8fafc" stroke="#38bdf8" strokeWidth="4" />
                                            ))}
                                        </svg>
                                        <div className="absolute inset-x-4 bottom-4 grid grid-cols-3 gap-2">
                                            {routeStops.map((stop) => (
                                                <span key={stop} className="rounded-xl bg-white/90 px-2 py-2 text-center text-[11px] font-bold text-slate-900 shadow-sm">
                                                    {stop}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('hero.preview.timelineLabel')}</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-950">{t('hero.preview.timelineTitle')}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                                            <PencilSimpleLine size={15} weight="duotone" />
                                        </span>
                                        <span className="inline-flex size-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                                            <ShareNetwork size={15} weight="duotone" />
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                    {dayCards.map((day) => (
                                        <div key={day.day} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex items-start gap-3">
                                                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-bold text-accent-700 shadow-sm">
                                                    {day.day}
                                                </span>
                                                <div className="min-w-0">
                                                    <h3 className="text-sm font-semibold text-slate-950">{day.title}</h3>
                                                    <p className="mt-1 text-xs leading-5 text-slate-600">{day.detail}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                                        <CalendarCheck size={18} weight="duotone" className="text-emerald-700" />
                                        <p className="mt-2 text-xs font-semibold text-emerald-900">{t('hero.preview.booking')}</p>
                                    </div>
                                    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
                                        <MapPinLine size={18} weight="duotone" className="text-sky-700" />
                                        <p className="mt-2 text-xs font-semibold text-sky-900">{t('hero.preview.mapSync')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
