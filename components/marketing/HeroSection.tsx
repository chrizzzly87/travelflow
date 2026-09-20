import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';
import { Sparkle, ShareNetwork, LinkSimple, RocketLaunch } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { GradientShimmer, type GradientStop } from 'gradient-shimmer';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { PlaneWindow } from './PlaneWindow/PlaneWindow';
import { buildPath } from '../../config/routes';
import { warmRouteAssets } from '../../services/navigationPrefetch';

const heroTitleGradient: GradientStop[] = [
    { color: '#0f766e', position: 0 },
    { color: '#14b8a6', position: 0.28 },
    { color: '#f59e0b', position: 0.62 },
    { color: '#fb7185', position: 1 },
];

interface HeroTitleHighlightProps {
    children: string;
}

// The hero heading must not repaint after its prerendered first paint: any
// post-hydration change to the <h1> subtree (the old rough-notation SVG
// injection, or the shimmer restyling the text) registers a new, late LCP
// candidate and drags homepage LCP behind the full JS boot. Two measures:
// 1. The underline is a static inline SVG rendered identically on the
//    prerendered snapshot and the client (draw-in is CSS-only, see
//    .tf-hero-underline in index.css, reduced-motion safe).
// 2. The gradient shimmer starts only after the first user interaction —
//    LCP is finalized on first input, so the sweep never counts against it,
//    while real visitors still see it the moment they move/scroll.
// Deliberately no bare 'scroll': Lighthouse's full-page screenshot pass
// scrolls programmatically mid-trace, which would re-enable the shimmer
// inside the LCP window. Real scrolling intent arrives as wheel/touch.
const INTERACTION_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

const useFirstInteraction = (): boolean => {
    const [interacted, setInteracted] = useState(false);

    useEffect(() => {
        if (interacted) return;
        const activate = () => setInteracted(true);
        INTERACTION_EVENTS.forEach((eventName) =>
            window.addEventListener(eventName, activate, { once: true, passive: true })
        );
        return () => {
            INTERACTION_EVENTS.forEach((eventName) => window.removeEventListener(eventName, activate));
        };
    }, [interacted]);

    return interacted;
};

const HeroTitleHighlight: React.FC<HeroTitleHighlightProps> = ({ children }) => {
    const shimmerActive = useFirstInteraction();

    return (
    <span className="relative inline-block pb-1">
        {shimmerActive ? (
            <GradientShimmer
                gradient={heroTitleGradient}
                duration={1.75}
                spread={3.5}
                pauseBetween={1800}
                baseColor="currentColor"
                className="text-foreground dark:text-foreground"
            >
                {children}
            </GradientShimmer>
        ) : (
            <span className="text-foreground dark:text-foreground">{children}</span>
        )}
        <svg
            aria-hidden="true"
            className="tf-hero-underline"
            viewBox="0 0 120 12"
            preserveAspectRatio="none"
            fill="none"
        >
            <path
                className="tf-hero-underline-stroke"
                d="M3 8.2 C 22 5.4, 44 4.6, 62 5.8 S 100 8.6, 117 6.2"
                stroke="var(--tf-accent-400)"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength="100"
            />
            <path
                className="tf-hero-underline-stroke tf-hero-underline-stroke--second"
                d="M5 10.4 C 28 8.0, 52 7.2, 72 8.2 S 104 10.4, 115 8.8"
                stroke="var(--tf-accent-400)"
                strokeWidth="2.4"
                strokeLinecap="round"
                pathLength="100"
            />
        </svg>
    </span>
    );
};

export const HeroSection: React.FC = () => {
    const { t } = useTranslation('home');
    const [showPlaneWindow, setShowPlaneWindow] = useState(true);

    // Homepage only, and re-evaluated on every route change.
    //
    // An earlier version read window.location.pathname inside useMemo([]), which
    // snapshots the path once at mount and never looks again. If the hero mounts
    // while the app is still on '/', it stays "home" forever — which is how the
    // plane window ended up baked into the prerendered /features HTML and showed
    // up on a direct load of that page but not when navigating to it. Reading the
    // router location keeps this honest across navigations.
    const heroLocation = useSafeRouteLocation();
    const isHomeRoute = useMemo(() => {
        const pathname = heroLocation.pathname
            || (typeof window !== 'undefined' ? window.location.pathname : '/');
        const segments = (pathname || '/').split('/').filter(Boolean);
        // '/' or a bare locale prefix such as '/de'.
        return segments.length === 0 || (segments.length === 1 && /^[a-z]{2}$/.test(segments[0]));
    }, [heroLocation.pathname]);

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
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30">
                            <Sparkle size={14} weight="duotone" />
                            {t('hero.badge')}
                        </span>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '80ms' } as React.CSSProperties}>
                        <h1 className="mt-6 text-balance text-5xl font-semibold text-foreground dark:text-foreground md:text-7xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                            {t('hero.titleBefore')} {' '}
                            <HeroTitleHighlight>{t('hero.titleHighlight')}</HeroTitleHighlight>
                        </h1>
                    </div>

                    <div className="animate-hero-stagger" style={{ '--stagger': '160ms' } as React.CSSProperties}>
                        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground dark:text-muted-foreground md:text-xl">
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
                            className="group relative rounded-2xl bg-accent-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-accent-200 transition-[scale,background-color,box-shadow] duration-150 ease-out hover:scale-[1.02] hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 active:scale-[0.96] dark:bg-accent-400 dark:text-background dark:shadow-none dark:hover:bg-accent-300 dark:hover:shadow-none"
                            {...heroCtaDebugAttributes('start_planning')}
                        >
                            {t('common:buttons.startPlanning')}
                        </Link>
                        <a
                            href="#examples"
                            onClick={() => handleCtaClick('see_examples')}
                            className="rounded-2xl border border-border bg-card px-7 py-3.5 text-base font-bold text-foreground transition-[scale,border-color,color,box-shadow] duration-150 ease-out hover:scale-[1.02] hover:border-slate-400 hover:text-foreground hover:shadow-sm active:scale-[0.96] dark:border-border dark:bg-card dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:shadow-none"
                            {...heroCtaDebugAttributes('see_examples')}
                        >
                            {t('common:buttons.seeExampleTrips')}
                        </a>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2.5 animate-hero-stagger" style={{ '--stagger': '360ms' } as React.CSSProperties}>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm animate-float dark:border-border dark:bg-card dark:text-muted-foreground dark:shadow-none" style={{ '--float-delay': '0ms' } as React.CSSProperties}>
                            <RocketLaunch size={14} weight="duotone" className="text-accent-500" />
                            {t('hero.floating.ai')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm animate-float dark:border-border dark:bg-card dark:text-muted-foreground dark:shadow-none" style={{ '--float-delay': '600ms' } as React.CSSProperties}>
                            <ShareNetwork size={14} weight="duotone" className="text-accent-500" />
                            {t('hero.floating.share')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm animate-float dark:border-border dark:bg-card dark:text-muted-foreground dark:shadow-none" style={{ '--float-delay': '1200ms' } as React.CSSProperties}>
                            <LinkSimple size={14} weight="duotone" className="text-accent-500" />
                            {t('hero.floating.booking')}
                        </span>
                    </div>
                </div>

                <div className="hidden lg:block w-[280px] xl:w-[320px] shrink-0 animate-hero-stagger" style={{ '--stagger': '400ms' } as React.CSSProperties}>
                    {showPlaneWindow && isHomeRoute ? <PlaneWindow /> : null}
                </div>
            </div>
        </section>
    );
};
