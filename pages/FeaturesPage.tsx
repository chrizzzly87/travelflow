import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowsClockwise, Printer, Sparkle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { FeaturesBentoGrid, type FeatureBentoItem } from '../components/marketing/features/FeaturesBentoGrid';
import { FeaturesGlobe } from '../components/marketing/features/FeaturesGlobe';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { Card, CardContent } from '../components/ui/card';
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

const workflowIconMap = [Sparkle, ArrowsClockwise, Printer];

export const FeaturesPage: React.FC = () => {
    const { t, i18n } = useTranslation('features');
    const activeLocale = normalizeLocale(i18n.resolvedLanguage || i18n.language);
    const inspirationsPath = buildLocalizedMarketingPath('inspirations', activeLocale);
    const bentoItems = t('bento.items', { returnObjects: true }) as FeatureBentoItem[];
    const workflowSteps = t('workflow.steps', { returnObjects: true }) as WorkflowStep[];
    const workflowGlance = t('workflow.glance', { returnObjects: true }) as WorkflowGlance;

    const prewarmCreateTripRoute = () => {
        void warmRouteAssets(buildPath('createTrip'), 'manual');
    };

    return (
        <MarketingLayout>
            <section className="relative overflow-visible pb-20 pt-8 md:pb-28 md:pt-14">
                <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(460px,560px)] lg:items-center">
                    <div className="max-w-3xl">
                        <div className="animate-hero-stagger" style={{ '--stagger': '0ms' } as React.CSSProperties}>
                            <h1
                                className="max-w-4xl text-balance text-5xl font-semibold text-foreground md:text-7xl dark:text-foreground"
                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                            >
                                {t('hero.titleBefore')}{' '}
                                <span className="text-accent-700 dark:text-accent-200">{t('hero.titleHighlight')}</span>
                            </h1>
                        </div>

                        <div className="animate-hero-stagger" style={{ '--stagger': '80ms' } as React.CSSProperties}>
                            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl dark:text-muted-foreground">
                                {t('hero.description')}
                            </p>
                        </div>

                        <div
                            className="mt-10 flex flex-wrap items-center gap-4 animate-hero-stagger"
                            style={{ '--stagger': '160ms' } as React.CSSProperties}
                        >
                            <Link
                                to={buildPath('createTrip')}
                                onClick={() => trackEvent('features__hero_cta--start_planning')}
                                onMouseEnter={prewarmCreateTripRoute}
                                onFocus={prewarmCreateTripRoute}
                                onTouchStart={prewarmCreateTripRoute}
                                className="rounded-lg bg-accent-600 px-7 py-3.5 text-base font-bold text-white shadow-sm shadow-accent-200 transition-[scale,translate,background-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-200 active:scale-[0.96] active:translate-y-0 dark:bg-accent-400 dark:hover:bg-accent-500 dark:shadow-none dark:text-background"
                                {...getAnalyticsDebugAttributes('features__hero_cta--start_planning')}
                            >
                                {t('hero.primaryCta')}
                            </Link>
                            <Link
                                to={inspirationsPath}
                                onClick={() => trackEvent('features__hero_cta--see_examples')}
                                className="rounded-lg border border-border bg-card px-7 py-3.5 text-base font-bold text-foreground shadow-sm transition-[scale,translate,border-color,color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-slate-400 hover:text-foreground hover:shadow-md active:scale-[0.96] active:translate-y-0 dark:border-border dark:bg-card dark:text-foreground dark:hover:border-border dark:hover:text-foreground"
                                {...getAnalyticsDebugAttributes('features__hero_cta--see_examples')}
                            >
                                {t('hero.secondaryCta')}
                            </Link>
                        </div>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '240ms' } as React.CSSProperties}>
                        <FeaturesGlobe />
                    </div>
                </div>
            </section>

            <section className="border-t border-border/80 py-16 md:py-24 dark:border-border/80">
                <div className="animate-scroll-blur-in max-w-3xl">
                    <h2 className="text-balance text-3xl font-semibold text-foreground md:text-5xl dark:text-foreground">
                        {t('bento.title')}
                    </h2>
                    <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg dark:text-muted-foreground">
                        {t('bento.subtitle')}
                    </p>
                </div>

                <div className="mt-12">
                    <FeaturesBentoGrid items={bentoItems} />
                </div>
            </section>

            <section className="border-t border-border/80 py-16 md:py-24 dark:border-border/80">
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
                    <div>
                        <div className="animate-scroll-blur-in max-w-3xl">
                            <h2 className="text-balance text-3xl font-semibold text-foreground md:text-5xl dark:text-foreground">
                                {t('workflow.title')}
                            </h2>
                            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg dark:text-muted-foreground">
                                {t('workflow.subtitle')}
                            </p>
                        </div>

                        <div className="mt-10 grid gap-4">
                            {workflowSteps.map((step, index) => {
                                const IconComponent = workflowIconMap[index] || Sparkle;
                                return (
                                    <article
                                        key={`${step.step}-${step.title}`}
                                        className="animate-scroll-fade-up rounded-[18px] border border-border bg-card p-5 shadow-sm shadow-slate-200/70 transition-transform hover:-translate-y-0.5 dark:border-border dark:bg-card"
                                        style={{ animationDelay: `${index * 90}ms` }}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-11 items-center justify-center rounded-lg border border-border bg-secondary text-accent-700 dark:border-border dark:bg-secondary dark:text-accent-200">
                                                    <IconComponent size={18} weight="duotone" />
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-semibold text-foreground dark:text-foreground">{step.title}</h3>
                                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base dark:text-muted-foreground">
                                                    {step.description}
                                                </p>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>

                    <Card className="animate-scroll-scale-in overflow-hidden rounded-[18px] border-border bg-card py-0 shadow-sm shadow-slate-200/70 dark:border-border dark:bg-card">
                        <div className="relative h-56 overflow-hidden border-b border-border/80 dark:border-border/80">
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

                        <CardContent className="px-6 pb-6 pt-6">
                            <p className="text-xl font-bold text-foreground dark:text-foreground">{workflowGlance.title}</p>
                            <p className="text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                                {workflowGlance.description}
                            </p>
                            <div className="mt-5 grid gap-3">
                                {workflowGlance.items.map((item) => (
                                    <div
                                        key={item}
                                        className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-foreground dark:border-border dark:bg-secondary dark:text-foreground"
                                    >
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="pb-16 md:pb-24 animate-scroll-scale-in">
                <div className="relative overflow-hidden rounded-[18px] border border-border bg-secondary px-8 py-14 text-center shadow-sm shadow-slate-200/70 md:px-16 md:py-20 dark:border-border dark:bg-secondary">
                    <h2
                        className="relative text-balance text-3xl font-semibold text-foreground md:text-5xl dark:text-foreground"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        {t('cta.title')}
                    </h2>
                    <p className="relative mx-auto mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg dark:text-muted-foreground">
                        {t('cta.subtitle')}
                    </p>
                    <Link
                        to={buildPath('createTrip')}
                        onClick={() => trackEvent('features__bottom_cta')}
                        onMouseEnter={prewarmCreateTripRoute}
                        onFocus={prewarmCreateTripRoute}
                        onTouchStart={prewarmCreateTripRoute}
                        className="relative mt-8 inline-flex items-center justify-center rounded-lg bg-accent-600 px-8 py-3.5 text-base font-bold text-white shadow-sm shadow-accent-200 transition-[scale,translate,background-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md active:scale-[0.96] active:translate-y-0 dark:bg-accent-400 dark:hover:bg-accent-500 dark:shadow-none dark:text-background"
                        {...getAnalyticsDebugAttributes('features__bottom_cta')}
                    >
                        {t('cta.button')}
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
