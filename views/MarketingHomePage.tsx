'use client';

import React, { Suspense, lazy } from 'react';
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
    // The below-fold sections render in one pass on server and client — SSR
    // ships their full markup and hydration matches exactly. The Suspense
    // spacers (with matching min-heights to avoid layout shift) only show
    // while the lazy chunks load during a client-side navigation.
    return (
        <MarketingLayout>
            <HeroSection />
            <div className="min-h-[460px]">
                <Suspense fallback={<div className="h-[460px] w-full" aria-hidden="true" />}>
                    <ExampleTripsCarousel />
                </Suspense>
            </div>
            <div className="min-h-[600px]">
                <Suspense fallback={<div className="h-[600px] w-full" aria-hidden="true" />}>
                    <FeatureShowcase />
                </Suspense>
            </div>
            <div className="min-h-[300px]">
                <Suspense fallback={<div className="h-[300px] w-full" aria-hidden="true" />}>
                    <CtaBanner />
                </Suspense>
            </div>
        </MarketingLayout>
    );
};
