import React from 'react';
import { SiteFooter } from './SiteFooter';
import { EarlyAccessBanner } from './EarlyAccessBanner';
import { TranslationNoticeBanner } from './TranslationNoticeBanner';
import { SiteHeader } from '../navigation/SiteHeader';
import { LanguageSuggestionBanner } from '../navigation/LanguageSuggestionBanner';
import { useTripManager } from '../../contexts/TripManagerContext';

interface MarketingLayoutProps {
    children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
    const { openTripManager, prewarmTripManager } = useTripManager();

    return (
        <div className="min-h-screen scroll-smooth bg-white text-slate-900 flex flex-col">
            <SiteHeader variant="solid" onMyTripsClick={openTripManager} onMyTripsIntent={prewarmTripManager} />
            <EarlyAccessBanner />
            <LanguageSuggestionBanner />
            <TranslationNoticeBanner />

            <main className="mx-auto w-full flex-1">
                {children}
            </main>
            <SiteFooter />
        </div>
    );
};
