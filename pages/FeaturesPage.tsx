import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FeaturesBentoGrid, type FeatureBentoItem } from '../components/marketing/features/FeaturesBentoGrid';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { normalizeLocale } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath } from '../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { warmRouteAssets } from '../services/navigationPrefetch';

interface WorkflowStep {
    step: string;
    title: string;
    description: string;
}

interface WorkflowGlance {
    eyebrow: string;
    title: string;
    description: string;
    items: string[];
}

const prewarmCreateTripRoute = () => {
    void warmRouteAssets(buildPath('createTrip'), 'manual');
};

export const FeaturesPage: React.FC = () => {
    const { t, i18n } = useTranslation('features');
    const activeLocale = normalizeLocale(i18n.resolvedLanguage || i18n.language);
    const inspirationsPath = buildLocalizedMarketingPath('inspirations', activeLocale);
    const bentoItems = t('bento.items', { returnObjects: true }) as FeatureBentoItem[];
    const workflowSteps = t('workflow.steps', { returnObjects: true }) as WorkflowStep[];
    const workflowGlance = t('workflow.glance', { returnObjects: true }) as WorkflowGlance;

    return (
        <MarketingLayout>
            <section className="border-b border-slate-200 pb-20 pt-10 md:pb-28 md:pt-20">
                <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
                    <div className="lg:col-span-8">
                            <h1 className="max-w-[13ch] text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl md:text-8xl">
                                {t('hero.titleBefore')}{' '}
                                {t('hero.titleHighlight')}
                            </h1>
                            <p className="mt-7 max-w-[64ch] text-pretty text-lg leading-8 text-slate-600 md:text-xl">
                                {t('hero.description')}
                            </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 lg:col-span-4 lg:justify-end">
                            <Link
                                to={buildPath('createTrip')}
                                onClick={() => trackEvent('features__hero_cta--start_planning')}
                                onMouseEnter={prewarmCreateTripRoute}
                                onFocus={prewarmCreateTripRoute}
                                onTouchStart={prewarmCreateTripRoute}
                                className="inline-flex min-h-12 items-center rounded-md bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-black"
                                {...getAnalyticsDebugAttributes('features__hero_cta--start_planning')}
                            >
                                {t('hero.primaryCta')}
                            </Link>
                            <Link
                                to={inspirationsPath}
                                onClick={() => trackEvent('features__hero_cta--see_examples')}
                                className="inline-flex min-h-12 items-center text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                                {...getAnalyticsDebugAttributes('features__hero_cta--see_examples')}
                            >
                                {t('hero.secondaryCta')}
                            </Link>
                    </div>
                </div>
            </section>

            <section className="border-t border-slate-200/80 py-16 md:py-24">
                <div className="grid gap-5 lg:grid-cols-12">
                    <h2 className="text-balance text-3xl font-semibold text-slate-950 md:text-5xl lg:col-span-7">
                        {t('bento.title')}
                    </h2>
                    <p className="max-w-[64ch] text-pretty text-base leading-7 text-slate-600 md:text-lg lg:col-span-5 lg:col-start-8 lg:pt-2">
                        {t('bento.subtitle')}
                    </p>
                </div>

                <div className="mt-12">
                    <FeaturesBentoGrid items={bentoItems} />
                </div>
            </section>

            <section className="border-t border-slate-200/80 py-16 md:py-24">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
                    <div>
                        <div className="max-w-3xl">
                            <h2 className="text-balance text-3xl font-semibold text-slate-950 md:text-5xl">
                                {t('workflow.title')}
                            </h2>
                            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 md:text-lg">
                                {t('workflow.subtitle')}
                            </p>
                        </div>

                        <div className="mt-10 grid gap-4">
                            {workflowSteps.map((step, index) => (
                                    <article
                                        key={`${step.step}-${step.title}`}
                                        className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-slate-200 py-6"
                                    >
                                        <span className="font-mono text-xs tabular-nums text-slate-400">0{index + 1}</span>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                                                <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                                                    {step.description}
                                                </p>
                                            </div>
                                    </article>
                            ))}
                        </div>
                    </div>

                    <figure className="overflow-hidden border-y border-slate-200 bg-white">
                        <div className="relative h-56 overflow-hidden border-b border-slate-200/80">
                            <img
                                src="/images/trip-maps/japan-spring.png"
                                alt=""
                                aria-hidden="true"
                                width={1280}
                                height={576}
                                className="size-full object-cover"
                                loading="lazy"
                            />
                        </div>

                        <figcaption className="px-1 py-6">
                            <p className="text-xl font-bold text-slate-950">{workflowGlance.title}</p>
                            <p className="text-sm leading-relaxed text-slate-600">
                                {workflowGlance.description}
                            </p>
                            <div className="mt-5 grid gap-3">
                                {workflowGlance.items.map((item) => (
                                    <div key={item} className="border-t border-slate-200 py-3 text-sm font-medium text-slate-700">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </figcaption>
                    </figure>
                </div>
            </section>

            <section className="border-t border-slate-200 py-20 md:py-28">
                <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
                    <div className="lg:col-span-8">
                    <h2
                        className="max-w-[18ch] text-balance text-3xl font-semibold text-slate-950 md:text-5xl"
                    >
                        {t('cta.title')}
                    </h2>
                    <p className="mt-4 max-w-[64ch] text-pretty text-base leading-7 text-slate-600 md:text-lg">
                        {t('cta.subtitle')}
                    </p>
                    </div>
                    <div className="lg:col-span-4 lg:text-right">
                    <Link
                        to={buildPath('createTrip')}
                        onClick={() => trackEvent('features__bottom_cta')}
                        onMouseEnter={prewarmCreateTripRoute}
                        onFocus={prewarmCreateTripRoute}
                        onTouchStart={prewarmCreateTripRoute}
                        className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-black"
                        {...getAnalyticsDebugAttributes('features__bottom_cta')}
                    >
                        {t('cta.button')}
                    </Link>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
};
