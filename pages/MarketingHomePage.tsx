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
            <div className="-mt-12 relative z-20 bg-slate-50 rounded-t-[3rem] px-5 sm:px-8 pt-24 pb-16 shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
                <div className="max-w-7xl mx-auto flex flex-col gap-12 sm:gap-24">
                    <FeatureShowcase />
                    
                    <div ref={carouselSectionRef} className="min-h-[460px] w-full" id="examples">
                        {shouldLoadCarousel ? (
                            <Suspense fallback={<div className="h-[460px] w-full" aria-hidden="true" />}>
                                <ExampleTripsCarousel />
                            </Suspense>
                        ) : (
                            <div className="h-[460px] w-full" aria-hidden="true" />
                        )}
                    </div>
                </div>
            </div>
            <CtaBanner />
        </MarketingLayout>
    );
};
