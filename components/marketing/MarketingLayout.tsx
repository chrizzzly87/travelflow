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
        <div className="min-h-screen scroll-smooth bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden relative">
            <SiteHeader variant="glass" onMyTripsClick={openTripManager} onMyTripsIntent={prewarmTripManager} />
            <div className="absolute top-0 left-0 w-full z-30 pointer-events-none">
                <EarlyAccessBanner />
                <LanguageSuggestionBanner />
                <TranslationNoticeBanner />
            </div>

            <main className="w-full flex-1">
                {children}
            </main>
            <SiteFooter />
        </div>
    );
};
