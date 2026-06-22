import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkle, ShareNetwork, LinkSimple, RocketLaunch } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { GradientShimmer, type GradientStop } from 'gradient-shimmer';
import { annotate } from 'rough-notation';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { PlaneWindowAnimation } from './PlaneWindowAnimation';
import { buildPath } from '../../config/routes';
import { warmRouteAssets } from '../../services/navigationPrefetch';

const HERO_UNDERLINE_DELAY_MS = 900;

const heroTitleGradient: GradientStop[] = [
    { color: '#0f766e', position: 0 },
    { color: '#14b8a6', position: 0.28 },
    { color: '#f59e0b', position: 0.62 },
    { color: '#fb7185', position: 1 },
];

interface HeroTitleHighlightProps {
    children: string;
}

const HeroTitleHighlight: React.FC<HeroTitleHighlightProps> = ({ children }) => {
    const highlightRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
        const element = highlightRef.current;
        if (!element) return;

        const annotation = annotate(element, {
            type: 'underline',
            color: 'var(--tf-accent-400)',
            strokeWidth: 3,
            iterations: 2,
            padding: [0, 4, 6, 4],
            animationDuration: 700,
            rtl: window.getComputedStyle(element).direction === 'rtl',
        });

        const showTimer = window.setTimeout(() => annotation.show(), HERO_UNDERLINE_DELAY_MS);

        return () => {
            window.clearTimeout(showTimer);
            annotation.remove();
        };
    }, []);

    return (
        <span ref={highlightRef} className="relative inline-block pb-1">
            <GradientShimmer
                gradient={heroTitleGradient}
                duration={1.75}
                spread={3.5}
                pauseBetween={1800}
                baseColor="currentColor"
                className="text-slate-900"
            >
                {children}
            </GradientShimmer>
        </span>
    );
};

export const HeroSection: React.FC = () => {
    const { t } = useTranslation('home');
    const [showPlaneWindow, setShowPlaneWindow] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const update = () => setShowPlaneWindow(mediaQuery.matches);
        update();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', update);
            return () => mediaQuery.removeEventListener('change', update);
        }

        mediaQuery.addListener(update);
        return () => mediaQuery.removeListener(update);
    }, []);

    const handleCtaClick = (ctaName: string) => {
        trackEvent(`home__hero_cta--${ctaName}`);
    };

    const heroCtaDebugAttributes = (ctaName: string) =>
        getAnalyticsDebugAttributes(`home__hero_cta--${ctaName}`);

    const prewarmCreateTripRoute = () => {
        void warmRouteAssets(buildPath('createTrip'), 'manual');
    };

    return (
        <section className="relative pt-8 pb-16 md:pt-16 md:pb-24">
            <div className="relative flex items-center gap-8 lg:gap-12">
                <div className="max-w-3xl flex-1">
                    <div className="animate-hero-stagger" style={{ '--stagger': '0ms' } as React.CSSProperties}>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                            <Sparkle size={14} weight="duotone" />
                            {t('hero.badge')}
                        </span>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '80ms' } as React.CSSProperties}>
                        <h1 className="mt-6 text-balance text-5xl font-semibold text-slate-900 md:text-7xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                            {t('hero.titleBefore')} {' '}
                            <HeroTitleHighlight>{t('hero.titleHighlight')}</HeroTitleHighlight>
                        </h1>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '160ms' } as React.CSSProperties}>
                        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600 md:text-xl">
                            {t('hero.description')}
                        </p>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center gap-4 animate-hero-stagger" style={{ '--stagger': '240ms' } as React.CSSProperties}>
                        <Link
                            to={buildPath('createTrip')}
                            onClick={() => handleCtaClick('start_planning')}
                            onMouseEnter={prewarmCreateTripRoute}
                            onFocus={prewarmCreateTripRoute}
                            onTouchStart={prewarmCreateTripRoute}
                            className="group relative rounded-2xl bg-accent-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-accent-200 transition-[scale,background-color,box-shadow] duration-150 ease-out hover:scale-[1.02] hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 active:scale-[0.96]"
                            {...heroCtaDebugAttributes('start_planning')}
                        >
                            {t('common:buttons.startPlanning')}
                        </Link>
                        <a
                            href="#examples"
                            onClick={() => handleCtaClick('see_examples')}
                            className="rounded-2xl border border-slate-300 bg-white px-7 py-3.5 text-base font-bold text-slate-700 transition-[scale,border-color,color,box-shadow] duration-150 ease-out hover:scale-[1.02] hover:border-slate-400 hover:text-slate-900 hover:shadow-sm active:scale-[0.96]"
                            {...heroCtaDebugAttributes('see_examples')}
                        >
                            {t('common:buttons.seeExampleTrips')}
                        </a>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2.5 animate-hero-stagger" style={{ '--stagger': '360ms' } as React.CSSProperties}>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm animate-float" style={{ '--float-delay': '0ms' } as React.CSSProperties}>
                            <RocketLaunch size={14} weight="duotone" className="text-accent-500" />
                            {t('hero.floating.ai')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm animate-float" style={{ '--float-delay': '600ms' } as React.CSSProperties}>
                            <ShareNetwork size={14} weight="duotone" className="text-accent-500" />
                            {t('hero.floating.share')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm animate-float" style={{ '--float-delay': '1200ms' } as React.CSSProperties}>
                            <LinkSimple size={14} weight="duotone" className="text-accent-500" />
                            {t('hero.floating.booking')}
                        </span>
                    </div>
                </div>

                <div className="hidden lg:block w-[280px] xl:w-[320px] shrink-0 animate-hero-stagger" style={{ '--stagger': '400ms' } as React.CSSProperties}>
                    {showPlaneWindow ? <PlaneWindowAnimation /> : null}
                </div>
            </div>
        </section>
    );
};
