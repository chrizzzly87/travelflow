import React from 'react';
import { NavLink } from 'react-router-dom';
import { AirplaneTilt } from '@phosphor-icons/react';
import { SiteFooter } from './SiteFooter';
import { EarlyAccessBanner } from './EarlyAccessBanner';
import { trackEvent } from '../../services/analyticsService';

interface MarketingLayoutProps {
    children: React.ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClass = 'relative font-semibold text-slate-500 transition-colors hover:text-slate-900 after:pointer-events-none after:absolute after:-bottom-4 after:left-0 after:h-0.5 after:w-full after:origin-center after:scale-x-0 after:rounded-full after:bg-accent-600 after:transition-transform';
    if (isActive) {
        return `${baseClass} text-slate-900 after:scale-x-100`;
    }
    return baseClass;
};

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
    const handleNavClick = (target: string) => {
        trackEvent('marketing_nav_clicked', { target });
    };

    return (
        <div className="min-h-screen scroll-smooth bg-slate-50 text-slate-900 flex flex-col">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_48%),radial-gradient(circle_at_80%_30%,_rgba(15,23,42,0.10),_transparent_35%)]" />
            <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur" style={{ viewTransitionName: 'site-header' }}>
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8">
                    <NavLink to="/" onClick={() => handleNavClick('brand')} className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                            <AirplaneTilt size={16} weight="duotone" />
                        </span>
                        <span className="text-lg font-extrabold tracking-tight">TravelFlow</span>
                    </NavLink>

                    <nav className="hidden items-center gap-6 text-sm md:flex">
                        <NavLink to="/features" onClick={() => handleNavClick('features')} className={navLinkClass}>Features</NavLink>
                        <NavLink to="/inspirations" onClick={() => handleNavClick('inspirations')} className={navLinkClass}>Inspirations</NavLink>
                        <NavLink to="/updates" onClick={() => handleNavClick('updates')} className={navLinkClass}>News & Updates</NavLink>
                        <NavLink to="/blog" onClick={() => handleNavClick('blog')} className={navLinkClass}>Blog</NavLink>
                    </nav>

                    <div className="flex items-center gap-2">
                        <NavLink
                            to="/login"
                            onClick={() => handleNavClick('login')}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                        >
                            Login
                        </NavLink>
                        <NavLink
                            to="/create-trip"
                            onClick={() => handleNavClick('create_trip')}
                            className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                        >
                            Create Trip
                        </NavLink>
                    </div>
                </div>
            </header>
            <EarlyAccessBanner />

            <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-10 md:px-8 md:pt-14">
                {children}
            </main>
            <SiteFooter />

        </div>
    );
};
