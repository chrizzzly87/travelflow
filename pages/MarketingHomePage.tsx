import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { HeroSection } from '../components/marketing/HeroSection';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';

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
    // Below-fold sections are lazy-loaded but NOT gated on IntersectionObserver:
    // in WebKit/Safari the observer callbacks did not fire for these sections,
    // so the marketing blocks and footer never mounted and the page showed empty
    // spacers with a large gap. Instead we mount them once, right after hydration
    // (idle callback) — reliable in every browser and it does not block the
    // hero's first paint. The first render still shows the empty spacers, which
    // matches the prerendered markup so hydration stays clean.
    const [shouldLoadDeferred, setShouldLoadDeferred] = useState(false);
    const carouselSectionRef = useRef<HTMLDivElement | null>(null);
    const showcaseSectionRef = useRef<HTMLDivElement | null>(null);
    const ctaSectionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (shouldLoadDeferred) return;
        const reveal = () => setShouldLoadDeferred(true);
        const ric = window.requestIdleCallback;
        const handle = ric ? ric(reveal, { timeout: 1500 }) : window.setTimeout(reveal, 200);
        return () => {
            if (ric && window.cancelIdleCallback) window.cancelIdleCallback(handle);
            else window.clearTimeout(handle);
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
