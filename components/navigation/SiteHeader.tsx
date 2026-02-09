import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AirplaneTilt, List, Folder } from '@phosphor-icons/react';
import { MobileMenu } from './MobileMenu';
import { useHasSavedTrips } from '../../hooks/useHasSavedTrips';
import { trackEvent } from '../../services/analyticsService';

type HeaderVariant = 'solid' | 'glass';

interface SiteHeaderProps {
    variant?: HeaderVariant;
    /** When provided, "My Trips" opens this callback instead of navigating. */
    onMyTripsClick?: () => void;
    /** Hide the "Create Trip" CTA (e.g. when already on the create-trip page). */
    hideCreateTrip?: boolean;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClass = 'relative font-semibold text-slate-500 transition-colors hover:text-slate-900 after:pointer-events-none after:absolute after:-bottom-4 after:left-0 after:h-0.5 after:w-full after:origin-center after:scale-x-0 after:rounded-full after:bg-accent-600 after:transition-transform';
    if (isActive) return `${baseClass} text-slate-900 after:scale-x-100`;
    return baseClass;
};

export const SiteHeader: React.FC<SiteHeaderProps> = ({
    variant = 'solid',
    onMyTripsClick,
    hideCreateTrip = false,
}) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const hasTrips = useHasSavedTrips();

    const handleNavClick = (target: string) => {
        trackEvent('marketing_nav_clicked', { target });
    };

    const isGlass = variant === 'glass';

    const headerClass = isGlass
        ? 'sticky top-0 z-40 border-b border-white/20 bg-white/80 backdrop-blur'
        : 'sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur';

    const loginClass = isGlass
        ? 'hidden sm:inline-flex rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900'
        : 'hidden sm:inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900';

    const burgerClass = isGlass
        ? 'flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900 lg:hidden'
        : 'flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden';

    return (
        <>
            <header className={headerClass} style={{ viewTransitionName: 'site-header' }}>
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
                    <NavLink to="/" onClick={() => handleNavClick('brand')} className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                            <AirplaneTilt size={16} weight="duotone" />
                        </span>
                        <span className="text-lg font-extrabold tracking-tight">TravelFlow</span>
                    </NavLink>

                    <nav className="hidden items-center gap-4 text-sm lg:flex xl:gap-6">
                        <NavLink to="/features" onClick={() => handleNavClick('features')} className={navLinkClass}>Features</NavLink>
                        <NavLink to="/inspirations" onClick={() => handleNavClick('inspirations')} className={navLinkClass}>Inspirations</NavLink>
                        <NavLink to="/updates" onClick={() => handleNavClick('updates')} className={navLinkClass}>News & Updates</NavLink>
                        <NavLink to="/blog" onClick={() => handleNavClick('blog')} className={navLinkClass}>Blog</NavLink>
                        <NavLink to="/pricing" onClick={() => handleNavClick('pricing')} className={navLinkClass}>Pricing</NavLink>
                    </nav>

                    <div className="flex items-center gap-2">
                        <NavLink
                            to="/login"
                            onClick={() => handleNavClick('login')}
                            className={loginClass}
                        >
                            Login
                        </NavLink>
                        {hideCreateTrip ? (
                            hasTrips && onMyTripsClick && (
                                <button
                                    onClick={() => {
                                        handleNavClick('my_trips');
                                        onMyTripsClick();
                                    }}
                                    className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                                >
                                    <Folder size={15} />
                                    My Trips
                                </button>
                            )
                        ) : (
                            <NavLink
                                to="/create-trip"
                                onClick={() => handleNavClick('create_trip')}
                                className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                            >
                                Create Trip
                            </NavLink>
                        )}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className={burgerClass}
                            aria-label="Open menu"
                        >
                            <List size={22} weight="bold" />
                        </button>
                    </div>
                </div>
            </header>

            <MobileMenu
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                onMyTripsClick={onMyTripsClick}
            />
        </>
    );
};
