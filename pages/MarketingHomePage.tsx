import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { HeroSection } from '../components/marketing/HeroSection';
import { ExampleTripsCarousel } from '../components/marketing/ExampleTripsCarousel';
import { FeatureShowcase } from '../components/marketing/FeatureShowcase';
import { CtaBanner } from '../components/marketing/CtaBanner';
/** Start owns route splitting and SSR. Essential content has no idle/visibility gate. */
export const MarketingHomePage = () => <MarketingLayout>
    <HeroSection />
    <section className="min-h-[460px]"><ExampleTripsCarousel /></section>
    <section className="min-h-[600px]"><FeatureShowcase /></section>
    <section className="min-h-[300px]"><CtaBanner /></section>
</MarketingLayout>;
