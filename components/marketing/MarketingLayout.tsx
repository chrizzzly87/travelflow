import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { EarlyAccessBanner } from './EarlyAccessBanner';
import { TranslationNoticeBanner } from './TranslationNoticeBanner';
import { SiteFooter as StaticSiteFooter } from './SiteFooter';
import { SiteHeader } from '../navigation/SiteHeader';
import { LanguageSuggestionBanner } from '../navigation/LanguageSuggestionBanner';
import { useTripManager } from '../../contexts/TripManagerContext';
import { cn } from '../../lib/utils';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const LazySiteFooter = lazyWithRecovery(
    'SiteFooter',
    () => import('./SiteFooter').then((module) => ({ default: module.SiteFooter }))
);

interface MarketingLayoutProps {
    children: React.ReactNode;
    rootClassName?: string;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children, rootClassName }) => {
    const { openTripManager, prewarmTripManager } = useTripManager();
    const isStaticRender = typeof window === 'undefined';
    const [shouldLoadFooter, setShouldLoadFooter] = useState(isStaticRender);
    const footerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (shouldLoadFooter) return;
        const node = footerRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setShouldLoadFooter(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            setShouldLoadFooter(true);
            observer.disconnect();
        }, { rootMargin: '400px' });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [shouldLoadFooter]);

    return (
        <div className={cn('min-h-screen scroll-smooth bg-slate-50 text-slate-900 flex flex-col overflow-x-clip', rootClassName)}>
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_48%),radial-gradient(circle_at_80%_30%,_rgba(15,23,42,0.10),_transparent_35%)]" />
            <SiteHeader onMyTripsClick={openTripManager} onMyTripsIntent={prewarmTripManager} />
            <div className="pointer-events-none fixed inset-x-0 top-[69px] z-[1500] md:top-[73px]">
                <div className="pointer-events-auto">
                    <EarlyAccessBanner />
                    <LanguageSuggestionBanner />
                    <TranslationNoticeBanner />
                </div>
            </div>

            <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-10 md:px-8 md:pt-14">
                {children}
            </main>
            
            <div ref={footerRef} className="min-h-[200px]">
                {isStaticRender ? (
                    <StaticSiteFooter />
                ) : shouldLoadFooter ? (
                    <Suspense fallback={<div className="h-[200px] w-full" aria-hidden="true" />}>
                        <LazySiteFooter />
                    </Suspense>
                ) : (
                    <div className="h-[200px] w-full" aria-hidden="true" />
                )}
            </div>
        </div>
    );
};
