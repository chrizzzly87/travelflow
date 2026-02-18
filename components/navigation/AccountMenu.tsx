import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AirplaneTakeoff, CaretDown, GearSix, ShieldCheck, SignOut, User } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';

interface AccountMenuProps {
    email: string | null;
    isAdmin: boolean;
    compact?: boolean;
    showLabel?: boolean;
    fullWidth?: boolean;
    menuPlacement?: 'bottom-end' | 'right-end';
    className?: string;
}

type AnalyticsEventName = `${string}__${string}` | `${string}__${string}--${string}`;

const computeInitial = (email: string | null): string => {
    const normalized = (email || '').trim();
    if (!normalized) return 'U';
    return normalized.charAt(0).toUpperCase();
};

const labelFromPath = (pathname: string): string => {
    if (pathname.startsWith('/profile/settings')) return 'Settings';
    if (pathname.startsWith('/profile')) return 'Profile';
    if (pathname.startsWith('/admin')) return 'Admin';
    return 'Account';
};

export const AccountMenu: React.FC<AccountMenuProps> = ({
    email,
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

    const navigateTo = (path: string, eventName: AnalyticsEventName) => {
        trackEvent(eventName);
        setIsOpen(false);
        navigate(path);
    };

    const handleLogout = async () => {
        trackEvent('navigation__account_menu--logout');
        setIsOpen(false);
        await logout();
        const locale = extractLocaleFromPath(location.pathname) || DEFAULT_LOCALE;
        navigate(buildLocalizedMarketingPath('home', locale));
    };

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
                    {computeInitial(email)}
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
                        <div className="truncate text-sm font-semibold text-slate-800">{email || 'Unknown user'}</div>
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
