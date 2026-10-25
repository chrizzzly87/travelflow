import React, { useEffect, useMemo, useState } from 'react';
import { AirplaneTakeoff, CaretDown, CaretRight, FolderSimple, GearSix, ShieldCheck, SignOut, User } from '@phosphor-icons/react';
import { useNavigate } from '@/app/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedCreateTripPath, buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE, localeToDir, normalizeLocale } from '../../config/locales';
import { getAllTrips } from '../../services/storageService';
import type { ITrip } from '../../types';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { buildAccountDisplayName, buildAccountTriggerName, computeInitial } from './accountIdentity';

export interface AccountMenuProps {
    email: string | null;
    userId?: string | null;
    isAdmin: boolean;
    compact?: boolean;
    showLabel?: boolean;
    fullWidth?: boolean;
    menuPlacement?: 'bottom-end' | 'right-end';
    labelMode?: 'route' | 'identity' | 'profile';
    showRecentTripsSection?: boolean;
    showCurrentPageSummary?: boolean;
    className?: string;
    triggerClassName?: string;
    showCaret?: boolean;
    onOpenTripManager?: () => void;
    onPrewarmTripManager?: () => void;
}

type AnalyticsEventName = `${string}__${string}` | `${string}__${string}--${string}`;

const sortByCreatedDesc = (trips: ITrip[]): ITrip[] =>
    Array.from(trips).sort((a, b) => {
        const byCreated = (Number.isFinite(b.createdAt) ? b.createdAt : 0) - (Number.isFinite(a.createdAt) ? a.createdAt : 0);
        if (byCreated !== 0) return byCreated;
        return (Number.isFinite(b.updatedAt) ? b.updatedAt : 0) - (Number.isFinite(a.updatedAt) ? a.updatedAt : 0);
    });

const formatRecentTripDate = (timestamp: number): string => {
    if (!Number.isFinite(timestamp)) return '';
    return new Date(timestamp).toLocaleDateString();
};

const labelFromPath = (pathname: string): string => {
    if (pathname.startsWith('/admin/dashboard')) return 'Overview';
    if (pathname.startsWith('/admin/users')) return 'Users';
    if (pathname.startsWith('/admin/trips')) return 'Trips';
    if (pathname.startsWith('/admin/tiers')) return 'Plans';
    if (pathname.startsWith('/admin/audit')) return 'Audit log';
    if (pathname.startsWith('/admin/legal')) return 'Legal terms';
    if (pathname.startsWith('/admin/ai-benchmark')) return 'AI benchmark';
    if (pathname.startsWith('/profile/settings')) return 'Settings';
    if (pathname.startsWith('/profile')) return 'Profile';
    if (pathname.startsWith('/admin')) return 'Admin';
    return 'Account';
};

/** Lightweight member actions share the header’s already loaded common namespace. */
export const AccountMenuContent: React.FC<AccountMenuProps & { onAction?: () => void }> = ({
    email, userId = null, isAdmin, showRecentTripsSection = true,
    showCurrentPageSummary = true, onOpenTripManager, onPrewarmTripManager, onAction,
}) => {
    const navigate = useNavigate();
    const routeLocation = useSafeRouteLocation();
    const { logout, profile } = useAuth();
    const { t } = useTranslation('common');
    const [recentTrips, setRecentTrips] = useState<ITrip[]>(() => (
        showRecentTripsSection
            ? sortByCreatedDesc(getAllTrips()).slice(0, 5)
            : []
    ));

    const accountLabel = useMemo(() => labelFromPath(routeLocation.pathname), [routeLocation.pathname]);
    const accountDisplayName = useMemo(
        () => buildAccountDisplayName(profile, email, userId),
        [email, profile, userId]
    );
    const activeLocale = useMemo(
        () => extractLocaleFromPath(routeLocation.pathname) || DEFAULT_LOCALE,
        [routeLocation.pathname],
    );

    useEffect(() => {
        if (!showRecentTripsSection) {
            setRecentTrips([]);
            return;
        }
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
    }, [showRecentTripsSection]);

    const navigateTo = (path: string, eventName: AnalyticsEventName) => {
        trackEvent(eventName);
        onAction?.();
        navigate(path);
    };

    const openTripManager = () => {
        if (!onOpenTripManager) return;
        trackEvent('navigation__account_menu--my_trips');
        onAction?.();
        onOpenTripManager();
    };

    const navigateToRecentTrip = (trip: ITrip) => {
        trackEvent('navigation__account_menu--recent_trip', { trip_id: trip.id });
        onAction?.();
        navigate(`/trip/${encodeURIComponent(trip.id)}`);
    };

    const handleLogout = async () => {
        trackEvent('navigation__account_menu--logout');
        onAction?.();
        await logout();
        const locale = extractLocaleFromPath(routeLocation.pathname) || DEFAULT_LOCALE;
        navigate(buildLocalizedMarketingPath('home', locale));
    };

    const accountIdentityLabel = useMemo(() => {
        const normalizedEmail = (email || '').trim();
        if (normalizedEmail) return normalizedEmail;
        const normalizedUserId = (userId || '').trim();
        if (normalizedUserId) return `User ID ${normalizedUserId.slice(0, 8)}`;
        return null;
    }, [email, userId]);

    return <>
                    <div className="rounded-lg border border-border bg-secondary px-3 py-2 dark:border-border dark:bg-secondary">
                        <div className="truncate text-sm font-semibold text-foreground dark:text-foreground">{accountDisplayName}</div>
                        {accountIdentityLabel && (
                            <div className="truncate text-xs text-muted-foreground dark:text-muted-foreground">{accountIdentityLabel}</div>
                        )}
                        {showCurrentPageSummary && (
                            <div className="text-xs text-muted-foreground dark:text-muted-foreground">Current page: {accountLabel}</div>
                        )}
                    </div>

                    {showRecentTripsSection && (
                        <div className="mt-1.5 space-y-1 border-t border-border pt-1.5 dark:border-border">
                            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
                                Recent trips
                            </div>
                            {recentTrips.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground dark:text-muted-foreground">No recent trips yet.</div>
                            ) : (
                                recentTrips.map((trip) => (
                                    <DropdownMenuItem asChild key={`account-recent-${trip.id}`}><button
                                        type="button"
                                        onClick={() => navigateToRecentTrip(trip)}
                                        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm text-foreground transition-colors hover:bg-secondary dark:text-foreground dark:hover:bg-secondary"
                                        {...getAnalyticsDebugAttributes('navigation__account_menu--recent_trip', { trip_id: trip.id })}
                                    >
                                        <span className="truncate">{trip.title}</span>
                                        <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                                            {formatRecentTripDate(trip.createdAt)}
                                        </span>
                                    </button></DropdownMenuItem>
                                ))
                            )}
                            <DropdownMenuItem asChild><button
                                type="button"
                                onClick={() => navigateTo('/profile?tab=recent', 'navigation__account_menu--recent_view_all')}
                                className="mt-0.5 w-full rounded-md border border-border px-3 py-2 text-start text-sm font-semibold text-foreground transition-colors hover:border-border hover:bg-secondary dark:border-border dark:text-foreground dark:hover:border-border dark:hover:bg-secondary"
                                {...getAnalyticsDebugAttributes('navigation__account_menu--recent_view_all')}
                            >
                                View all trips
                            </button></DropdownMenuItem>
                        </div>
                    )}

                    <div className="mt-1.5 space-y-0.5">
                        <DropdownMenuItem asChild><button
                            type="button"
                            onClick={() => navigateTo('/profile', 'navigation__account_menu--profile')}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium text-foreground transition-colors hover:bg-secondary dark:text-foreground dark:hover:bg-secondary"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--profile')}
                        >
                            <User size={16} />
                            {t('nav.profile')}
                        </button></DropdownMenuItem>
                        <DropdownMenuItem asChild><button
                            type="button"
                            onClick={() => navigateTo('/profile/settings', 'navigation__account_menu--settings')}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--settings')}
                        >
                            <GearSix size={16} />
                            {t('nav.settings')}
                        </button></DropdownMenuItem>
                        {onOpenTripManager && (
                            <DropdownMenuItem asChild><button
                                type="button"
                                onMouseEnter={onPrewarmTripManager}
                                onFocus={onPrewarmTripManager}
                                onTouchStart={onPrewarmTripManager}
                                onClick={openTripManager}
                                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start text-sm font-medium text-foreground transition-colors hover:bg-secondary dark:text-foreground dark:hover:bg-secondary"
                                {...getAnalyticsDebugAttributes('navigation__account_menu--my_trips')}
                            >
                                <span className="flex items-center gap-2">
                                    <FolderSimple size={16} />
                                    <span>{t('nav.myTrips')}</span>
                                </span>
                                <CaretRight size={14} className="text-muted-foreground dark:text-muted-foreground" />
                            </button></DropdownMenuItem>
                        )}
                    </div>

                    <div className="mt-1.5 border-t border-border pt-1.5 dark:border-border">
                        <DropdownMenuItem asChild><button
                            type="button"
                            onClick={() => navigateTo(buildLocalizedCreateTripPath(activeLocale), 'navigation__account_menu--create_trip')}
                            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-500 dark:text-white dark:hover:bg-accent-600"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--create_trip')}
                        >
                            <AirplaneTakeoff size={16} weight="fill" />
                            {t('nav.createTrip')}
                        </button></DropdownMenuItem>
                    </div>

                    {isAdmin && (
                        <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5 dark:border-border">
                            <DropdownMenuItem asChild><button
                                type="button"
                                onClick={() => navigateTo('/admin/dashboard', 'navigation__account_menu--admin_workspace')}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium text-foreground transition-colors hover:bg-secondary dark:text-foreground dark:hover:bg-secondary"
                                {...getAnalyticsDebugAttributes('navigation__account_menu--admin_workspace')}
                            >
                                <ShieldCheck size={15} />
                                Admin workspace
                            </button></DropdownMenuItem>
                        </div>
                    )}

                    <div className="mt-1.5 border-t border-border pt-1.5 dark:border-border">
                        <DropdownMenuItem asChild><button
                            type="button"
                            onClick={() => {
                                void handleLogout();
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:hover:bg-rose-400/12 dark:text-rose-200"
                            {...getAnalyticsDebugAttributes('navigation__account_menu--logout')}
                        >
                            <SignOut size={16} />
                            Logout
                        </button></DropdownMenuItem>
                    </div>
    </>;
};

export const AccountMenu: React.FC<AccountMenuProps> = (props) => {
    const { email, userId, compact = false, showLabel, fullWidth = false,
        menuPlacement = 'bottom-end', labelMode = 'identity', className,
        triggerClassName, showCaret = true } = props;
    const { profile } = useAuth();
    const { i18n } = useTranslation('common');
    const location = useSafeRouteLocation();
    const [isOpen, setIsOpen] = useState(false);
    const triggerLabel = labelMode === 'identity'
        ? buildAccountTriggerName(profile, email, userId)
        : labelMode === 'profile' ? 'Profile' : labelFromPath(location.pathname);
    const shouldShowLabel = showLabel ?? !compact;
    return <DropdownMenu dir={localeToDir(normalizeLocale(i18n?.resolvedLanguage || i18n?.language || DEFAULT_LOCALE))} open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        trackEvent('navigation__account_menu--toggle', { open });
    }}>
        <div className={`relative ${className || ''}`.trim()}>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label={!shouldShowLabel ? triggerLabel : undefined}
                    className={[
                        'inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:shadow-none',
                        compact ? 'h-9 py-1.5' : 'h-10 py-2',
                        fullWidth ? 'w-full justify-between' : '', triggerClassName || '',
                    ].join(' ')}
                    {...getAnalyticsDebugAttributes('navigation__account_menu--toggle')}>
                    <span className="flex size-7 shrink-0 aspect-square items-center justify-center rounded-full bg-accent-100 text-xs font-black text-accent-900 dark:bg-accent-400/12 dark:text-accent-200">
                        {computeInitial(profile, email, userId)}
                    </span>
                    {shouldShowLabel && <span className="truncate">{triggerLabel}</span>}
                    {showCaret && <CaretDown size={14} />}
                </button>
            </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent align="end" side={menuPlacement === 'right-end' ? 'right' : 'bottom'}
            aria-label="Account menu" className="z-[2100] w-[min(92vw,320px)] rounded-xl border-border bg-card p-1.5 text-foreground shadow-2xl">
            <AccountMenuContent {...props} onAction={() => setIsOpen(false)} />
        </DropdownMenuContent>
    </DropdownMenu>;
};
