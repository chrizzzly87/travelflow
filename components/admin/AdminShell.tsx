import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    AirplaneTilt,
    CaretLeft,
    CaretRight,
    ChartLineUp,
    ChartPieSlice,
    Flask,
    List,
    Scroll,
    StackSimple,
    SuitcaseRolling,
    UsersThree,
    X,
} from '@phosphor-icons/react';
import { APP_NAME } from '../../config/appGlobals';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    readLocalStorageItem,
    readSessionStorageItem,
    writeLocalStorageItem,
} from '../../services/browserStorageService';
import {
    SIMULATED_LOGIN_DEBUG_EVENT,
    SIMULATED_LOGIN_STORAGE_KEY,
    isSimulatedLoggedIn,
    setSimulatedLoggedIn,
} from '../../services/simulatedLoginService';
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS } from './adminNavConfig';
import { AccountMenu } from '../navigation/AccountMenu';
import { useAuth } from '../../hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export type AdminDateRange = '7d' | '30d' | '90d' | 'all';

interface AdminShellProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    searchValue?: string;
    onSearchValueChange?: (value: string) => void;
    dateRange?: AdminDateRange;
    onDateRangeChange?: (next: AdminDateRange) => void;
    showGlobalSearch?: boolean;
    showDateRange?: boolean;
}

const SIDEBAR_COLLAPSE_PERSIST_KEY = 'tf_admin_sidebar_collapsed_v1';
const DEV_ADMIN_BYPASS_DISABLED_SESSION_KEY = 'tf_dev_admin_bypass_disabled';

export const getStoredSidebarCollapseState = (): boolean => {
    return readLocalStorageItem(SIDEBAR_COLLAPSE_PERSIST_KEY) === '1';
};

export const persistSidebarCollapseState = (next: boolean): void => {
    writeLocalStorageItem(SIDEBAR_COLLAPSE_PERSIST_KEY, next ? '1' : '0');
};

export const isDevAdminBypassDisabled = (): boolean => {
    return readSessionStorageItem(DEV_ADMIN_BYPASS_DISABLED_SESSION_KEY) === '1';
};

const itemIcon = (icon: (typeof ADMIN_NAV_ITEMS)[number]['icon']) => {
    if (icon === 'overview') return <ChartPieSlice size={16} weight="duotone" />;
    if (icon === 'telemetry') return <ChartLineUp size={16} weight="duotone" />;
    if (icon === 'users') return <UsersThree size={16} weight="duotone" />;
    if (icon === 'trips') return <SuitcaseRolling size={16} weight="duotone" />;
    if (icon === 'tiers') return <StackSimple size={16} weight="duotone" />;
    if (icon === 'audit') return <Scroll size={16} weight="duotone" />;
    return <Flask size={16} weight="duotone" />;
};

const buildDesktopNavClass = ({ isActive }: { isActive: boolean }, isCollapsed: boolean) => {
    const base = isCollapsed
        ? 'flex items-center justify-center rounded-xl border px-2 py-2 text-sm transition-colors'
        : 'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors';
    if (isActive) {
        return `${base} border-accent-200 bg-accent-50 font-semibold text-accent-900`;
    }
    return `${base} border-transparent font-medium text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900`;
};

const buildMobileNavClass = ({ isActive }: { isActive: boolean }) => {
    if (isActive) {
        return 'flex items-center gap-2 rounded-xl border border-accent-300 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-900';
    }
    return 'flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900';
};

const DATE_RANGE_OPTIONS: Array<{ value: AdminDateRange; label: string }> = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
];

export const AdminShell: React.FC<AdminShellProps> = ({
    title,
    description,
    children,
    actions,
    searchValue = '',
    onSearchValueChange,
    dateRange = '30d',
    onDateRangeChange,
    showGlobalSearch = true,
    showDateRange = true,
}) => {
    const location = useLocation();
    const { access, isAdmin } = useAuth();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => getStoredSidebarCollapseState());
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSimulatedDebugLoginActive, setIsSimulatedDebugLoginActive] = useState<boolean>(() => isSimulatedLoggedIn());
    const [isDevAdminBypassActive, setIsDevAdminBypassActive] = useState(false);

    const syncAdminRuntimeFlags = useCallback(() => {
        const simulatedDebugLogin = isSimulatedLoggedIn();
        setIsSimulatedDebugLoginActive(simulatedDebugLogin);

        if (typeof window === 'undefined') {
            setIsDevAdminBypassActive(false);
            return;
        }

        const bypassConfigured = import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN_BYPASS === 'true';
        const bypassDisabled = isDevAdminBypassDisabled();
        const bypassSessionUser = (access?.userId || '').trim() === 'dev-admin-id';
        setIsDevAdminBypassActive(bypassConfigured && !bypassDisabled && bypassSessionUser);
    }, [access?.userId]);

    const handleDisableSimulatedLogin = useCallback(() => {
        setSimulatedLoggedIn(false);
        syncAdminRuntimeFlags();
    }, [syncAdminRuntimeFlags]);

    useEffect(() => {
        persistSidebarCollapseState(isSidebarCollapsed);
    }, [isSidebarCollapsed]);

    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!isMobileSidebarOpen) return;
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsMobileSidebarOpen(false);
        };
        window.addEventListener('keydown', onEscape);
        return () => window.removeEventListener('keydown', onEscape);
    }, [isMobileSidebarOpen]);

    useEffect(() => {
        syncAdminRuntimeFlags();
        if (typeof window === 'undefined') return;

        const handleStorage = (event: StorageEvent) => {
            if (event.key && event.key !== SIMULATED_LOGIN_STORAGE_KEY && event.key !== DEV_ADMIN_BYPASS_DISABLED_SESSION_KEY) {
                return;
            }
            syncAdminRuntimeFlags();
        };
        const handleSimulatedDebugEvent = () => {
            syncAdminRuntimeFlags();
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener(SIMULATED_LOGIN_DEBUG_EVENT, handleSimulatedDebugEvent as EventListener);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(SIMULATED_LOGIN_DEBUG_EVENT, handleSimulatedDebugEvent as EventListener);
        };
    }, [syncAdminRuntimeFlags]);

    const emitMenuEvent = (id: string) => {
        trackEvent(`admin__menu--${id}`);
    };

    const navSections = useMemo(
        () => ADMIN_NAV_SECTIONS.map((section) => ({
            ...section,
            items: ADMIN_NAV_ITEMS.filter((item) => item.section === section.id),
        })).filter((section) => section.items.length > 0),
        []
    );

    const renderNavItems = (mode: 'desktop' | 'mobile') => navSections.map((section) => (
        <section key={`section-${mode}-${section.id}`} className="space-y-1.5">
            {(mode === 'mobile' || !isSidebarCollapsed) && (
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {section.label}
                </div>
            )}
            <div className="space-y-1">
                {section.items.map((item) => (
                    <NavLink
                        key={`${mode}-item-${item.id}`}
                        to={item.path}
                        end={item.path === '/admin/ai-benchmark'}
                        title={isSidebarCollapsed && mode === 'desktop' ? item.label : undefined}
                        className={(nav) => mode === 'desktop'
                            ? buildDesktopNavClass(nav, isSidebarCollapsed)
                            : buildMobileNavClass(nav)}
                        onClick={() => {
                            emitMenuEvent(item.id);
                            if (mode === 'mobile') setIsMobileSidebarOpen(false);
                        }}
                        {...getAnalyticsDebugAttributes(`admin__menu--${item.id}`)}
                    >
                        {itemIcon(item.icon)}
                        {(mode === 'mobile' || !isSidebarCollapsed) && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </div>
        </section>
    ));

    return (
        <div className="min-h-dvh bg-slate-100 text-slate-900 [&_.rounded-full]:select-none">
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-50 bg-slate-950/45 lg:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-[60] flex w-72 flex-col border-r border-slate-200 bg-white p-4 shadow-2xl transition-transform duration-200 lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                aria-label="Admin navigation"
            >
                <div className="flex items-center justify-between">
                    <NavLink
                        to="/admin/dashboard"
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                        onClick={() => emitMenuEvent('brand')}
                        {...getAnalyticsDebugAttributes('admin__menu--brand')}
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                            <AirplaneTilt size={16} weight="duotone" />
                        </span>
                        <span className="text-base font-black tracking-tight text-slate-900">{APP_NAME}</span>
                    </NavLink>
                    <button
                        type="button"
                        onClick={() => setIsMobileSidebarOpen(false)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        aria-label="Close navigation"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
                    {renderNavItems('mobile')}
                </div>

                {isAdmin && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                        <AccountMenu
                            email={access?.email || null}
                            userId={access?.userId || null}
                            isAdmin
                            fullWidth
                            showLabel
                            menuPlacement="right-end"
                            className="w-full"
                        />
                    </div>
                )}
            </aside>

            <div className="flex min-h-dvh w-full">
                <div className="relative hidden lg:block z-50">
                    <aside className={`sticky top-0 flex h-dvh shrink-0 flex-col border-r border-slate-200 bg-white/95 p-4 transition-[width] duration-200 ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
                        <NavLink
                            to="/admin/dashboard"
                            className={`flex items-center rounded-xl border border-slate-200 bg-white ${isSidebarCollapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2'}`}
                            onClick={() => emitMenuEvent('brand')}
                            {...getAnalyticsDebugAttributes('admin__menu--brand')}
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                                <AirplaneTilt size={16} weight="duotone" />
                            </span>
                            {!isSidebarCollapsed && (
                                <span className="text-base font-black tracking-tight text-slate-900">{APP_NAME}</span>
                            )}
                        </NavLink>

                        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
                            {renderNavItems('desktop')}
                        </div>

                        {isAdmin && (
                            <div className="mt-3 border-t border-slate-200 pt-3">
                                {!isSidebarCollapsed && (
                                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                        Account
                                    </div>
                                )}
                                <AccountMenu
                                    email={access?.email || null}
                                    userId={access?.userId || null}
                                    isAdmin
                                    compact={isSidebarCollapsed}
                                    showLabel={!isSidebarCollapsed}
                                    fullWidth={!isSidebarCollapsed}
                                    menuPlacement="right-end"
                                    className={isSidebarCollapsed ? 'mx-auto' : 'w-full'}
                                />
                            </div>
                        )}
                    </aside>
                    <button
                        type="button"
                        onClick={() => setIsSidebarCollapsed((current) => !current)}
                        className="absolute -right-4 top-6 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent-300 bg-white text-accent-700 shadow-sm hover:bg-accent-50"
                        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        {...getAnalyticsDebugAttributes('admin__menu--collapse_toggle')}
                    >
                        {isSidebarCollapsed ? <CaretRight size={13} /> : <CaretLeft size={13} />}
                    </button>
                </div>

                <main className="min-w-0 flex-1 min-h-dvh">
                    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
                        <div className="flex flex-col gap-3 px-4 py-4 md:px-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(true)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
                                        aria-label="Open navigation"
                                    >
                                        <List size={16} />
                                    </button>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-700">Admin workspace</p>
                                </div>
                                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{title}</h1>
                                {description && (
                                    <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
                                )}
                            </div>
                            <div className="flex w-full flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 lg:w-auto lg:flex-nowrap mt-3 lg:mt-0">
                                {showGlobalSearch && (
                                    <div className="w-full sm:w-auto flex-1 lg:flex-none">
                                        <label className="sr-only" htmlFor="admin-global-search">Search</label>
                                        <input
                                            id="admin-global-search"
                                            type="search"
                                            value={searchValue}
                                            onChange={(event) => onSearchValueChange?.(event.target.value)}
                                            placeholder="Search"
                                            disabled={!onSearchValueChange}
                                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200 disabled:cursor-not-allowed disabled:bg-slate-100 lg:w-[280px]"
                                        />
                                    </div>
                                )}
                                {showDateRange && (
                                    <div className="w-full sm:w-auto shrink-0">
                                        <Select
                                            value={dateRange}
                                            onValueChange={(next) => onDateRangeChange?.(next as AdminDateRange)}
                                            disabled={!onDateRangeChange}
                                        >
                                            <SelectTrigger className="h-9 w-full sm:w-[170px]">
                                                <SelectValue placeholder="Date range" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DATE_RANGE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {actions && (
                                    <div className="w-full sm:w-auto shrink-0 flex items-center justify-end gap-2">
                                        {actions}
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {isSimulatedDebugLoginActive && (
                        <section className="mx-4 mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:mx-6">
                            <p className="font-semibold">Debug simulated-login mode is active.</p>
                            <p className="mt-1">
                                Admin pages are showing mock data because the browser debug toggle is on (`{SIMULATED_LOGIN_STORAGE_KEY}=1`).
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDisableSimulatedLogin}
                                    className="inline-flex h-8 items-center rounded-lg border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                                >
                                    Disable simulated login
                                </button>
                                <span className="text-xs text-amber-800">Reload data after disabling to confirm live backend records.</span>
                            </div>
                        </section>
                    )}

                    {!isSimulatedDebugLoginActive && isDevAdminBypassActive && (
                        <section className="mx-4 mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 md:mx-6">
                            <p className="font-semibold">Dev admin bypass is active in this tab.</p>
                            <p className="mt-1">
                                This session uses the local dev-admin identity instead of your real account.
                            </p>
                        </section>
                    )}

                    <div className="px-4 py-5 md:px-6 md:py-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
