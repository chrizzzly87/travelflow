import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { HeroSection } from '../components/marketing/HeroSection';
import { FeatureShowcase } from '../components/marketing/FeatureShowcase';
import { CtaBanner } from '../components/marketing/CtaBanner';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const ExampleTripsCarousel = lazyWithRecovery(
    'ExampleTripsCarousel',
    () => import('../components/marketing/ExampleTripsCarousel').then((module) => ({ default: module.ExampleTripsCarousel }))
);

export const MarketingHomePage: React.FC = () => {
    const [shouldLoadCarousel, setShouldLoadCarousel] = useState(false);
    const carouselSectionRef = useRef<HTMLDivElement | null>(null);

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
        }, { rootMargin: '0px' });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [shouldLoadCarousel]);

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
            <FeatureShowcase />
            <CtaBanner />
        </MarketingLayout>
    );
};
