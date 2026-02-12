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
    const { openTripManager } = useTripManager();

    return (
        <div className="min-h-screen scroll-smooth bg-slate-50 text-slate-900 flex flex-col overflow-x-hidden">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_48%),radial-gradient(circle_at_80%_30%,_rgba(15,23,42,0.10),_transparent_35%)]" />
            <SiteHeader onMyTripsClick={openTripManager} />
            <EarlyAccessBanner />
            <LanguageSuggestionBanner />
            <TranslationNoticeBanner />

            <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-10 md:px-8 md:pt-14">
                {children}
            </main>
            <SiteFooter />
        </div>
    );
};
