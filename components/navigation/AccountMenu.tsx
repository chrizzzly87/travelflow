import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AirplaneTakeoff, CaretDown, GearSix, ShieldCheck, SignOut, User } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import { getAllTrips } from '../../services/storageService';
import type { ITrip } from '../../types';

interface AccountMenuProps {
    email: string | null;
    userId?: string | null;
    isAdmin: boolean;
    compact?: boolean;
    showLabel?: boolean;
    fullWidth?: boolean;
    menuPlacement?: 'bottom-end' | 'right-end';
    className?: string;
}

type AnalyticsEventName = `${string}__${string}` | `${string}__${string}--${string}`;

const sortByCreatedDesc = (trips: ITrip[]): ITrip[] =>
    [...trips].sort((a, b) => {
        const byCreated = (Number.isFinite(b.createdAt) ? b.createdAt : 0) - (Number.isFinite(a.createdAt) ? a.createdAt : 0);
        if (byCreated !== 0) return byCreated;
        return (Number.isFinite(b.updatedAt) ? b.updatedAt : 0) - (Number.isFinite(a.updatedAt) ? a.updatedAt : 0);
    });

const computeInitial = (email: string | null, userId?: string | null): string => {
    const normalized = (email || '').trim();
    if (!normalized) {
        const fallback = (userId || '').trim();
        if (fallback) return fallback.charAt(0).toUpperCase();
        return 'U';
    }
    return normalized.charAt(0).toUpperCase();
};

const labelFromPath = (pathname: string): string => {
    if (pathname.startsWith('/admin/dashboard')) return 'Overview';
    if (pathname.startsWith('/admin/users')) return 'Users';
    if (pathname.startsWith('/admin/trips')) return 'Trips';
    if (pathname.startsWith('/admin/tiers')) return 'Tiers';
    if (pathname.startsWith('/admin/audit')) return 'Audit';
    if (pathname.startsWith('/admin/ai-benchmark')) return 'AI Benchmark';
    if (pathname.startsWith('/profile/settings')) return 'Settings';
    if (pathname.startsWith('/profile')) return 'Profile';
    if (pathname.startsWith('/admin')) return 'Admin';
    return 'Account';
};

export const AccountMenu: React.FC<AccountMenuProps> = ({
    email,
    userId = null,
    isAdmin,
    compact = false,
    showLabel,
    fullWidth = false,
    menuPlacement = 'bottom-end',
    className,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [recentTrips, setRecentTrips] = useState<ITrip[]>(() => sortByCreatedDesc(getAllTrips()).slice(0, 5));
    const containerRef = useRef<HTMLDivElement | null>(null);

    const accountLabel = useMemo(() => labelFromPath(location.pathname), [location.pathname]);
    const shouldShowLabel = showLabel ?? !compact;

    useEffect(() => {
        if (!isOpen) return;
        const handlePointer = (event: PointerEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsOpen(false);
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
        };
        window.addEventListener('pointerdown', handlePointer);
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('pointerdown', handlePointer);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const refreshRecentTrips = () => {
            setRecentTrips(sortByCreatedDesc(getAllTrips()).slice(0, 5));
        };

        refreshRecentTrips();
        window.addEventListener('storage', refreshRecentTrips);
        window.addEventListener('tf:trips-updated', refreshRecentTrips);
        return () => {
            window.removeEventListener('storage', refreshRecentTrips);
            window.removeEventListener('tf:trips-updated', refreshRecentTrips);
        };
    }, []);

    const navigateTo = (path: string, eventName: AnalyticsEventName) => {
        trackEvent(eventName);
        setIsOpen(false);
        navigate(path);
    };

    const navigateToRecentTrip = (trip: ITrip) => {
        trackEvent('navigation__account_menu--recent_trip', { trip_id: trip.id });
        setIsOpen(false);
        navigate(`/trip/${encodeURIComponent(trip.id)}`);
    };

    const handleLogout = async () => {
        trackEvent('navigation__account_menu--logout');
        setIsOpen(false);
        await logout();
        const locale = extractLocaleFromPath(location.pathname) || DEFAULT_LOCALE;
        navigate(buildLocalizedMarketingPath('home', locale));
    };

    const accountIdentityLabel = useMemo(() => {
        const normalizedEmail = (email || '').trim();
        if (normalizedEmail) return normalizedEmail;
        const normalizedUserId = (userId || '').trim();
        if (normalizedUserId) return `User ${normalizedUserId.slice(0, 8)}`;
        return 'Signed-in account';
    }, [email, userId]);

    return (
        <div className={`relative ${className || ''}`.trim()} ref={containerRef}>
            <button
                type="button"
                onClick={() => {
                    const next = !isOpen;
                    setIsOpen(next);
                    trackEvent('navigation__account_menu--toggle', { open: next });
                }}
                className={[
                    'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors',
                    'hover:border-slate-300 hover:text-slate-900',
                    compact ? 'h-9 py-1.5' : 'h-10 py-2',
                    fullWidth ? 'w-full justify-between' : '',
                ].join(' ')}
                {...getAnalyticsDebugAttributes('navigation__account_menu--toggle')}
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-xs font-black text-accent-900">
                    {computeInitial(email, userId)}
                </span>
                {shouldShowLabel && <span className="truncate">{accountLabel}</span>}
                <CaretDown size={14} />
            </button>

            {isOpen && (
                <div
                    role="menu"
                    aria-label="Account menu"
                    className={[
                        'absolute z-[1800] w-[min(92vw,320px)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl',
                        menuPlacement === 'right-end'
                            ? 'left-[calc(100%+10px)] bottom-0'
                            : 'right-0 top-[calc(100%+8px)]',
                    ].join(' ')}
                >
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="truncate text-sm font-semibold text-slate-800">{accountIdentityLabel}</div>
                        <div className="text-xs text-slate-500">Current page: {accountLabel}</div>
                    </div>

                    <div className="mt-1.5 space-y-1 border-t border-slate-200 pt-1.5">
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Recent trips
                        </div>
                        {recentTrips.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500">No recent trips yet.</div>
                        ) : (
                            recentTrips.map((trip) => (
                                <button
                                    key={`account-recent-${trip.id}`}
                                    type="button"
                                    onClick={() => navigateToRecentTrip(trip)}
                                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                                    {...getAnalyticsDebugAttributes('navigation__account_menu--recent_trip', { trip_id: trip.id })}
                                >
                                    <span className="truncate">{trip.title}</span>
                                    <span className="text-[11px] text-slate-400">
                                        {new Date(trip.createdAt).toLocaleDateString()}
                                    </span>
                                </button>
                            ))
                        )}
                        <button
                            type="button"
                            onClick={() => navigateTo('/profile?tab=recent', 'navigation__account_menu--recent_view_all')}
                            className="mt-0.5 w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--recent_view_all')}
                        >
                            View all trips
                        </button>
                    </div>

                    <div className="mt-1.5 space-y-0.5">
                        <button
                            type="button"
                            onClick={() => navigateTo('/profile', 'navigation__account_menu--profile')}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--profile')}
                        >
                            <User size={16} />
                            Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => navigateTo('/profile/settings', 'navigation__account_menu--settings')}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--settings')}
                        >
                            <GearSix size={16} />
                            Settings
                        </button>
                        <button
                            type="button"
                            onClick={() => navigateTo('/create-trip', 'navigation__account_menu--planner')}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--planner')}
                        >
                            <AirplaneTakeoff size={16} />
                            Planner
                        </button>
                    </div>

                    {isAdmin && (
                        <div className="mt-1.5 space-y-0.5 border-t border-slate-200 pt-1.5">
                            <button
                                type="button"
                                onClick={() => navigateTo('/admin/dashboard', 'navigation__account_menu--admin_workspace')}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                {...getAnalyticsDebugAttributes('navigation__account_menu--admin_workspace')}
                            >
                                <ShieldCheck size={15} />
                                Admin workspace
                            </button>
                        </div>
                    )}

                    <div className="mt-1.5 border-t border-slate-200 pt-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                void handleLogout();
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--logout')}
                        >
                            <SignOut size={16} />
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
