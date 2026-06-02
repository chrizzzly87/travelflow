import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { HeroSection } from '../components/marketing/HeroSection';
import { ExampleTripsCarousel as StaticExampleTripsCarousel } from '../components/marketing/ExampleTripsCarousel';
import { FeatureShowcase as StaticFeatureShowcase } from '../components/marketing/FeatureShowcase';
import { CtaBanner as StaticCtaBanner } from '../components/marketing/CtaBanner';
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
    const isStaticRender = typeof window === 'undefined';
    const [shouldLoadCarousel, setShouldLoadCarousel] = useState(isStaticRender);
    const carouselSectionRef = useRef<HTMLDivElement | null>(null);

    const [shouldLoadShowcase, setShouldLoadShowcase] = useState(isStaticRender);
    const showcaseSectionRef = useRef<HTMLDivElement | null>(null);

    const [shouldLoadCta, setShouldLoadCta] = useState(isStaticRender);
    const ctaSectionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (shouldLoadCarousel) return;
        const node = carouselSectionRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setShouldLoadCarousel(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            setShouldLoadCarousel(true);
            observer.disconnect();
        }, { rootMargin: '100px' });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [shouldLoadCarousel]);

    useEffect(() => {
        if (shouldLoadShowcase) return;
        const node = showcaseSectionRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setShouldLoadShowcase(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            setShouldLoadShowcase(true);
            observer.disconnect();
        }, { rootMargin: '200px' });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [shouldLoadShowcase]);

    useEffect(() => {
        if (shouldLoadCta) return;
        const node = ctaSectionRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setShouldLoadCta(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            setShouldLoadCta(true);
            observer.disconnect();
        }, { rootMargin: '200px' });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [shouldLoadCta]);

    return (
        <MarketingLayout>
            <HeroSection />
            <div ref={carouselSectionRef} className="min-h-[460px]">
                {isStaticRender ? (
                    <StaticExampleTripsCarousel />
                ) : shouldLoadCarousel ? (
                    <Suspense fallback={<div className="h-[460px] w-full" aria-hidden="true" />}>
                        <ExampleTripsCarousel />
                    </Suspense>
                ) : (
                    <div className="h-[460px] w-full" aria-hidden="true" />
                )}
            </div>
            <div ref={showcaseSectionRef} className="min-h-[600px]">
                {isStaticRender ? (
                    <StaticFeatureShowcase />
                ) : shouldLoadShowcase ? (
                    <Suspense fallback={<div className="h-[600px] w-full" aria-hidden="true" />}>
                        <FeatureShowcase />
                    </Suspense>
                ) : (
                    <div className="h-[600px] w-full" aria-hidden="true" />
                )}
            </div>
            <div ref={ctaSectionRef} className="min-h-[300px]">
                {isStaticRender ? (
                    <StaticCtaBanner />
                ) : shouldLoadCta ? (
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
