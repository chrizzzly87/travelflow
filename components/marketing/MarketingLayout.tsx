import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { TranslationNoticeBanner } from './TranslationNoticeBanner';
import { SiteHeader } from '../navigation/SiteHeader';
import { LanguageSuggestionBanner } from '../navigation/LanguageSuggestionBanner';
import { useTripManager } from '../../contexts/TripManagerContext';
import { cn } from '../../lib/utils';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import { isPrerenderCapture } from '../../services/prerenderHydrationState';
import { useTranslation } from 'react-i18next';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const SiteFooter = lazyWithRecovery(
    'SiteFooter',
    () => import('./SiteFooter').then((module) => ({ default: module.SiteFooter }))
);

interface MarketingLayoutProps {
    children: React.ReactNode;
    rootClassName?: string;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children, rootClassName }) => {
    const { openTripManager, prewarmTripManager } = useTripManager();
    const { t } = useTranslation('common');
    // The footer is lazy and mounts right after hydration via an idle callback
    // — NOT gated on IntersectionObserver (its callbacks did not fire in
    // WebKit/Safari, so the footer never mounted → missing footer + big gap).
    // First render shows the empty spacer on BOTH the prerender capture and the
    // client, so hydration matches exactly (no preact/compat teardown). During
    // capture we hold the spacer (isPrerenderCapture) so the prerendered HTML
    // stays light; the client fills it on idle just after hydration.
    const [shouldLoadFooter, setShouldLoadFooter] = useState(false);
    const footerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (shouldLoadFooter || isPrerenderCapture()) return;
        let done = false;
        const reveal = () => { if (!done) { done = true; setShouldLoadFooter(true); } };
        // Guaranteed timer: requestIdleCallback is unreliable in WebKit/Safari
        // (throttled even with a timeout), which left the footer/sections
        // unmounted there. A plain setTimeout fires in every browser just after
        // the hero has painted; rIC is only an optional earlier fast-path.
        const timer = window.setTimeout(reveal, 250);
        const ricId = typeof window.requestIdleCallback === 'function'
            ? window.requestIdleCallback(reveal, { timeout: 250 })
            : undefined;
        return () => {
            window.clearTimeout(timer);
            if (ricId !== undefined && window.cancelIdleCallback) window.cancelIdleCallback(ricId);
        };
    }, [shouldLoadFooter]);

    return (
        <div className={cn('min-h-screen scroll-smooth bg-slate-50 text-slate-900 flex flex-col overflow-x-clip', rootClassName)}>
            <a
                href="#main-content"
                className="sr-only fixed left-4 top-4 z-[2000] rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
                {t('a11y.skipToContent')}
            </a>
            <SiteHeader onMyTripsClick={openTripManager} onMyTripsIntent={prewarmTripManager} />
            <div className="pointer-events-none fixed inset-x-0 top-[69px] z-[1500] md:top-[73px]">
                <div className="pointer-events-auto">
                    <LanguageSuggestionBanner />
                    <TranslationNoticeBanner />
                </div>
            </div>

            <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-10 md:px-8 md:pt-14">
                {children}
            </main>

            <div ref={footerRef} className="min-h-[200px]">
                {shouldLoadFooter ? (
                    <Suspense fallback={<div className="h-[200px] w-full" aria-hidden="true" />}>
                        <SiteFooter />
                    </Suspense>
                ) : (
                    <div className="h-[200px] w-full" aria-hidden="true" />
                )}
            </div>
        </div>
    );
};
