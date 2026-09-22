import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPinLine, Printer, Ticket } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { FeaturesAirportBand } from '../components/marketing/features/FeaturesAirportBand';
import { FeaturesCapabilities, type FeatureCapabilityItem } from '../components/marketing/features/FeaturesCapabilities';
import { FeaturesGlobe } from '../components/marketing/features/FeaturesGlobe';
import { RevealWords } from '../components/marketing/features/RevealWords';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { normalizeLocale } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath } from '../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { warmRouteAssets } from '../services/navigationPrefetch';

interface OutcomeItem {
    title: string;
    description: string;
}

interface AirportCopy {
    eyebrow: string;
    title: string;
    description: string;
    originLabel: string;
    destinationLabel: string;
}

/** One duotone icon per outcome, in the order the locale files list them. */
const outcomeIcons: Icon[] = [MapPinLine, Ticket, Printer];

const primaryCtaClasses = 'inline-flex items-center justify-center rounded-lg bg-accent-600 px-7 py-3.5 text-base font-semibold text-white transition-[scale,translate,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:bg-accent-700 active:scale-[0.96] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:bg-accent-400 dark:text-background dark:hover:bg-accent-500';

const sectionEyebrowClasses = 'text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent-700 dark:text-accent-300';

export const FeaturesPage: React.FC = () => {
    const { t, i18n } = useTranslation('features');
    const activeLocale = normalizeLocale(i18n.resolvedLanguage || i18n.language);
    const inspirationsPath = buildLocalizedMarketingPath('inspirations', activeLocale);
    const capabilityItems = t('capabilities.items', { returnObjects: true }) as FeatureCapabilityItem[];
    const outcomeItems = t('outcomes.items', { returnObjects: true }) as OutcomeItem[];
    const airport = t('airport', { returnObjects: true }) as AirportCopy;

    const prewarmCreateTripRoute = () => {
        void warmRouteAssets(buildPath('createTrip'), 'manual');
    };

    return (
        <MarketingLayout>
            <section className="relative overflow-visible pb-20 pt-10 md:pb-28 md:pt-16">
                <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] lg:items-center">
                    <div className="max-w-2xl">
                        <p className={`${sectionEyebrowClasses} animate-hero-stagger`} style={{ '--stagger': '0ms' } as React.CSSProperties}>
                            {t('hero.eyebrow')}
                        </p>

                        <h1
                            className="mt-5 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl"
                            style={{ fontFamily: 'var(--tf-font-heading)' }}
                        >
                            <RevealWords
                                startDelayMs={120}
                                segments={[
                                    { text: t('hero.titleBefore') },
                                    { text: t('hero.titleHighlight'), className: 'text-accent-700 dark:text-accent-200' },
                                ]}
                            />
                        </h1>

                        <div className="animate-hero-stagger" style={{ '--stagger': '520ms' } as React.CSSProperties}>
                            <p className="mt-7 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
                                {t('hero.description')}
                            </p>

                            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2">
                                <Link
                                    to={buildPath('createTrip')}
                                    onClick={() => trackEvent('features__hero_cta--start_planning')}
                                    onMouseEnter={prewarmCreateTripRoute}
                                    onFocus={prewarmCreateTripRoute}
                                    onTouchStart={prewarmCreateTripRoute}
                                    className={primaryCtaClasses}
                                    {...getAnalyticsDebugAttributes('features__hero_cta--start_planning')}
                                >
                                    {t('hero.primaryCta')}
                                </Link>
                                <Link
                                    to={inspirationsPath}
                                    onClick={() => trackEvent('features__hero_cta--see_examples')}
                                    className="inline-flex items-center justify-center rounded-lg py-3.5 text-base font-semibold text-foreground underline-offset-4 transition-colors duration-150 hover:text-accent-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:hover:text-accent-200"
                                    {...getAnalyticsDebugAttributes('features__hero_cta--see_examples')}
                                >
                                    {t('hero.secondaryCta')}
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '620ms' } as React.CSSProperties}>
                        <FeaturesGlobe />
                    </div>
                </div>
            </section>

            {/* Tinted band: the page alternates surfaces so it reads as chapters
                rather than one uninterrupted column. */}
            <section className="tf-section-band py-16 md:py-24">
                <div className="animate-scroll-blur-in max-w-2xl">
                    <p className={sectionEyebrowClasses}>{t('capabilities.eyebrow')}</p>
                    <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                        {t('capabilities.title')}
                    </h2>
                    <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                        {t('capabilities.subtitle')}
                    </p>
                </div>

                <div className="mt-12">
                    <FeaturesCapabilities items={capabilityItems} />
                </div>
            </section>

            <section className="py-16 md:py-24">
                <FeaturesAirportBand
                    eyebrow={airport.eyebrow}
                    title={airport.title}
                    description={airport.description}
                    originLabel={airport.originLabel}
                    destinationLabel={airport.destinationLabel}
                />
            </section>

            <section className="tf-section-band py-16 md:py-24">
                <div className="animate-scroll-blur-in max-w-2xl">
                    <p className={sectionEyebrowClasses}>{t('outcomes.eyebrow')}</p>
                    <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                        {t('outcomes.title')}
                    </h2>
                </div>

                <ol className="tf-stagger-entry mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
                    {outcomeItems.map((item, index) => {
                        const OutcomeIcon = outcomeIcons[index] || MapPinLine;

                        return (
                            <li key={item.title} className="animate-scroll-fade-up border-t border-border pt-6">
                                <div className="flex items-center gap-3">
                                    <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-accent-700 dark:text-accent-300">
                                        <OutcomeIcon size={20} weight="duotone" />
                                    </span>
                                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                </div>
                                <h3 className="mt-4 text-balance text-xl font-semibold tracking-tight text-foreground">
                                    {item.title}
                                </h3>
                                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                                    {item.description}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            </section>

            <section className="pb-20 md:pb-28">
                {/* The closing banner carries the accent rather than the neutral
                    surface every other section uses, so it reads as the one place
                    on the page asking for something. */}
                <div className="tf-cta-banner animate-scroll-scale-in relative isolate overflow-hidden rounded-3xl px-8 py-16 text-center md:px-16 md:py-24">
                    <div className="relative z-10">
                        <h2
                            className="text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl"
                            style={{ fontFamily: 'var(--tf-font-heading)' }}
                        >
                            {t('cta.title')}
                        </h2>
                        <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-white/80 md:text-lg">
                            {t('cta.subtitle')}
                        </p>
                        <Link
                            to={buildPath('createTrip')}
                            onClick={() => trackEvent('features__bottom_cta')}
                            onMouseEnter={prewarmCreateTripRoute}
                            onFocus={prewarmCreateTripRoute}
                            onTouchStart={prewarmCreateTripRoute}
                            className="mt-10 inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-semibold text-accent-700 shadow-lg shadow-slate-900/20 transition-[scale,translate,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.96] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent-600"
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
