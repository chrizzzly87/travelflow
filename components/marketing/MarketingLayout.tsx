import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { EarlyAccessBanner } from './EarlyAccessBanner';
import { TranslationNoticeBanner } from './TranslationNoticeBanner';
import { SiteHeader } from '../navigation/SiteHeader';
import { LanguageSuggestionBanner } from '../navigation/LanguageSuggestionBanner';
import { useTripManager } from '../../contexts/TripManagerContext';
import { cn } from '../../lib/utils';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import { useTranslation } from 'react-i18next';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const SiteFooter = lazyWithRecovery(
    'SiteFooter',
    () => import('./SiteFooter').then((module) => ({ default: module.SiteFooter }))
);

interface MarketingLayoutProps {
    children: React.ReactNode;
    rootClassName?: string;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children, rootClassName }) => {
    const { openTripManager, prewarmTripManager } = useTripManager();
    const { t } = useTranslation('common');
    const [shouldLoadFooter, setShouldLoadFooter] = useState(false);
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
            <a
                href="#main-content"
                className="sr-only fixed left-4 top-4 z-[2000] rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
                {t('a11y.skipToContent')}
            </a>
            <SiteHeader onMyTripsClick={openTripManager} onMyTripsIntent={prewarmTripManager} />
            <div className="pointer-events-none fixed inset-x-0 top-[69px] z-[1500] md:top-[73px]">
                <div className="pointer-events-auto">
                    <EarlyAccessBanner />
                    <LanguageSuggestionBanner />
                    <TranslationNoticeBanner />
                </div>
            </div>

            <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-10 md:px-8 md:pt-14">
                {children}
            </main>

            <div ref={footerRef} className="min-h-[200px]">
                {shouldLoadFooter ? (
                    <Suspense fallback={<div className="h-[200px] w-full" aria-hidden="true" />}>
                        <SiteFooter />
                    </Suspense>
                ) : (
                    <div className="h-[200px] w-full" aria-hidden="true" />
                )}
            </div>
        </div>
    );
};
