import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, SignOut, UserCircleGear, ShieldCheck } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ADMIN_NAV_ITEMS } from '../admin/adminNavConfig';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';

interface AccountMenuProps {
    email: string | null;
    isAdmin: boolean;
    compact?: boolean;
}

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

export const AccountMenu: React.FC<AccountMenuProps> = ({ email, isAdmin, compact = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const accountLabel = useMemo(() => labelFromPath(location.pathname), [location.pathname]);
    const adminQuickLinks = useMemo(() => ADMIN_NAV_ITEMS, []);

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

    const navigateTo = (path: string, eventName: string) => {
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
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => {
                    const next = !isOpen;
                    setIsOpen(next);
                    trackEvent('navigation__account_menu--toggle', { open: next });
                }}
                className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 ${compact ? 'h-9' : 'h-10'}`}
                {...getAnalyticsDebugAttributes('navigation__account_menu--toggle')}
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-100 text-xs font-black text-accent-900">
                    {computeInitial(email)}
                </span>
                <span className="hidden sm:inline">{accountLabel}</span>
                <CaretDown size={14} />
            </button>

            {isOpen && (
                <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-[1800] w-[min(90vw,340px)] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                >
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Signed in</div>
                        <div className="truncate text-sm font-semibold text-slate-800">{email || 'Unknown user'}</div>
                    </div>

                    <div className="mt-2 space-y-1">
                        <button
                            type="button"
                            onClick={() => navigateTo('/profile', 'navigation__account_menu--profile')}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--profile')}
                        >
                            <UserCircleGear size={16} />
                            Profile
                        </button>
                        <button
                            type="button"
                            onClick={() => navigateTo('/profile/settings', 'navigation__account_menu--settings')}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--settings')}
                        >
                            <UserCircleGear size={16} />
                            Settings
                        </button>
                    </div>

                    {isAdmin && (
                        <div className="mt-2 rounded-lg border border-slate-200">
                            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Admin pages
                            </div>
                            <div className="space-y-0.5 px-1 pb-2">
                                {adminQuickLinks.map((item) => (
                                    <button
                                        key={`admin-link-${item.id}`}
                                        type="button"
                                        onClick={() => navigateTo(item.path, `navigation__account_menu--admin_${item.id}`)}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                        {...getAnalyticsDebugAttributes(`navigation__account_menu--admin_${item.id}`)}
                                    >
                                        <ShieldCheck size={15} />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-2 border-t border-slate-200 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                void handleLogout();
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50"
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
