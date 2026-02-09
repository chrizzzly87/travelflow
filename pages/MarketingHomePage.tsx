import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { HeroSection } from '../components/marketing/HeroSection';
import { ExampleTripsCarousel } from '../components/marketing/ExampleTripsCarousel';
import { FeatureShowcase } from '../components/marketing/FeatureShowcase';
import { CtaBanner } from '../components/marketing/CtaBanner';

export const MarketingHomePage: React.FC = () => {
    return (
        <MarketingLayout>
            <HeroSection />
            <ExampleTripsCarousel />
            <FeatureShowcase />
            <CtaBanner />
        </MarketingLayout>
    );
};
