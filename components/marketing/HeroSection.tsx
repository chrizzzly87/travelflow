import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';
import { warmRouteAssets } from '../../services/navigationPrefetch';

const handleHeroCtaClick = (ctaName: string) => {
    trackEvent(`home__hero_cta--${ctaName}`);
};

const getHeroCtaDebugAttributes = (ctaName: string) =>
    getAnalyticsDebugAttributes(`home__hero_cta--${ctaName}`);

const prewarmCreateTripRoute = () => {
    void warmRouteAssets(buildPath('createTrip'), 'manual');
};

export const HeroSection: React.FC = () => {
    const { t } = useTranslation('home');

    return (
        <section className="border-b border-slate-200 pb-20 pt-10 md:pb-28 md:pt-20">
            <div className="grid gap-14 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-8">
                    <h1 className="max-w-[12ch] text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl md:text-8xl">
                        {t('hero.titleBefore')} {t('hero.titleHighlight')}
                    </h1>
                    <p className="mt-7 max-w-[64ch] text-pretty text-lg leading-8 text-slate-600 md:text-xl">
                        {t('hero.description')}
                    </p>
                    <div className="mt-9 flex flex-wrap items-center gap-6">
                        <Link
                            to={buildPath('createTrip')}
                            onClick={() => handleHeroCtaClick('start_planning')}
                            onMouseEnter={prewarmCreateTripRoute}
                            onFocus={prewarmCreateTripRoute}
                            onTouchStart={prewarmCreateTripRoute}
                            className="inline-flex min-h-12 items-center rounded-md bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-black"
                            {...getHeroCtaDebugAttributes('start_planning')}
                        >
                            {t('common:buttons.startPlanning')}
                        </Link>
                        <a
                            href="#examples"
                            onClick={() => handleHeroCtaClick('see_examples')}
                            className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                            {...getHeroCtaDebugAttributes('see_examples')}
                        >
                            {t('common:buttons.seeExampleTrips')} <ArrowRight size={16} aria-hidden="true" />
                        </a>
                    </div>
                </div>
                <aside className="divide-y divide-slate-200 border-y border-slate-200 lg:col-span-4" aria-label={t('hero.badge')}>
                    {[t('hero.floating.ai'), t('hero.floating.share'), t('hero.floating.booking')].map((item, index) => (
                        <div key={item} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5">
                            <span className="font-mono text-xs tabular-nums text-slate-400">0{index + 1}</span>
                            <span className="text-sm font-medium text-slate-800">{item}</span>
                        </div>
                    ))}
                </aside>
            </div>
        </section>
    );
};
