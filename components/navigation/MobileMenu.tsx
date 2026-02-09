import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X, AirplaneTilt } from '@phosphor-icons/react';
import { NAV_ITEMS } from '../../config/navigation';
import { useHasSavedTrips } from '../../hooks/useHasSavedTrips';
import { trackEvent } from '../../services/analyticsService';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onMyTripsClick?: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
        isActive
            ? 'bg-accent-50 text-accent-700'
            : 'text-slate-700 hover:bg-slate-100'
    }`;

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, onMyTripsClick }) => {
    const hasTrips = useHasSavedTrips();

    useEffect(() => {
        if (isOpen) {
            trackEvent('mobile_menu_opened');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleNavClick = (target: string) => {
        trackEvent('mobile_nav_clicked', { target });
        onClose();
    };

    const visibleItems = NAV_ITEMS.filter((item) => !item.requiresTrips);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`fixed inset-y-0 right-0 z-50 w-[85vw] max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
            >
                <div className="flex h-full flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                                <AirplaneTilt size={16} weight="duotone" />
                            </span>
                            <span className="text-lg font-extrabold tracking-tight">TravelFlow</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Close menu"
                        >
                            <X size={20} weight="bold" />
                        </button>
                    </div>

                    {/* Nav links */}
                    <nav className="flex-1 overflow-y-auto px-3 py-4">
                        <div className="space-y-1">
                            {visibleItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={navLinkClass}
                                    onClick={() => handleNavClick(item.label.toLowerCase())}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    </nav>

                    {/* Footer CTA */}
                    <div className="border-t border-slate-100 p-4 space-y-2">
                        {onMyTripsClick && hasTrips ? (
                            <button
                                onClick={() => {
                                    handleNavClick('my_trips');
                                    onMyTripsClick();
                                }}
                                className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                            >
                                My Trips
                            </button>
                        ) : (
                            <NavLink
                                to="/create-trip"
                                onClick={() => handleNavClick('create_trip')}
                                className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                            >
                                Create Trip
                            </NavLink>
                        )}
                        <NavLink
                            to="/login"
                            onClick={() => handleNavClick('login')}
                            className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-base font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                        >
                            Login
                        </NavLink>
                    </div>
                </div>
            </div>
        </>
    );
};
