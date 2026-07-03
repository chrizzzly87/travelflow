import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { HeroSection } from '../components/marketing/HeroSection';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';
import { isPrerenderedDocument } from '../services/prerenderHydrationState';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const ExampleTripsCarousel = lazyWithRecovery(
    'ExampleTripsCarousel',
    () => import('../components/marketing/ExampleTripsCarousel').then((module) => ({ default: module.ExampleTripsCarousel }))
);

const FeatureShowcase = lazyWithRecovery(
    'FeatureShowcase',
    () => import('../components/marketing/FeatureShowcase').then((module) => ({ default: module.FeatureShowcase }))
);

const CtaBanner = lazyWithRecovery(
    'CtaBanner',
    () => import('../components/marketing/CtaBanner').then((module) => ({ default: module.CtaBanner }))
);

export const MarketingHomePage: React.FC = () => {
    // Below-fold sections are lazy and mount right after hydration via an idle
    // callback — NOT gated on IntersectionObserver (its callbacks did not fire
    // in WebKit/Safari, so the sections never mounted). The first render shows
    // empty spacers on BOTH the prerender capture and the client, so hydration
    // matches exactly (no preact/compat teardown/flash). During capture we hold
    // the spacers (isPrerenderCapture) instead of letting the idle callback fill
    // them, which keeps the prerendered HTML light and the hero's LCP fast.
    // Eager on prerendered pages so the sections are STATIC markup in the
    // captured HTML — present even if client hydration is slow/interrupted
    // (the robust guarantee). On the SPA fallback they mount after hydration
    // via the timer below.
    const [shouldLoadDeferred, setShouldLoadDeferred] = useState(() => isPrerenderedDocument());
    const carouselSectionRef = useRef<HTMLDivElement | null>(null);
    const showcaseSectionRef = useRef<HTMLDivElement | null>(null);
    const ctaSectionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (shouldLoadDeferred) return;
        let done = false;
        const reveal = () => { if (!done) { done = true; setShouldLoadDeferred(true); } };
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
    }, [shouldLoadDeferred]);

    const shouldLoadCarousel = shouldLoadDeferred;
    const shouldLoadShowcase = shouldLoadDeferred;
    const shouldLoadCta = shouldLoadDeferred;

    return (
        <MarketingLayout>
            <HeroSection />
            <div ref={carouselSectionRef} className="min-h-[460px]">
                {shouldLoadCarousel ? (
                    <Suspense fallback={<div className="h-[460px] w-full" aria-hidden="true" />}>
                        <ExampleTripsCarousel />
                    </Suspense>
                ) : (
                    <div className="h-[460px] w-full" aria-hidden="true" />
                )}
            </div>
            <div ref={showcaseSectionRef} className="min-h-[600px]">
                {shouldLoadShowcase ? (
                    <Suspense fallback={<div className="h-[600px] w-full" aria-hidden="true" />}>
                        <FeatureShowcase />
                    </Suspense>
                ) : (
                    <div className="h-[600px] w-full" aria-hidden="true" />
                )}
            </div>
            <div ref={ctaSectionRef} className="min-h-[300px]">
                {shouldLoadCta ? (
                    <Suspense fallback={<div className="h-[300px] w-full" aria-hidden="true" />}>
                        <CtaBanner />
                    </Suspense>
                ) : (
                    <div className="h-[300px] w-full" aria-hidden="true" />
                )}
            </div>
        </MarketingLayout>
    );
};
