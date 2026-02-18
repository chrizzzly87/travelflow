import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    AirplaneTilt,
    ArrowSquareOut,
    CaretLeft,
    CaretRight,
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
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS } from './adminNavConfig';
import { AccountMenu } from '../navigation/AccountMenu';
import { useAuth } from '../../hooks/useAuth';

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

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'tf_admin_sidebar_collapsed_v1';

const getStoredSidebarCollapseState = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === '1';
};

const persistSidebarCollapseState = (next: boolean): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? '1' : '0');
};

const itemIcon = (icon: (typeof ADMIN_NAV_ITEMS)[number]['icon']) => {
    if (icon === 'overview') return <ChartPieSlice size={16} weight="duotone" />;
    if (icon === 'users') return <UsersThree size={16} weight="duotone" />;
    if (icon === 'trips') return <SuitcaseRolling size={16} weight="duotone" />;
    if (icon === 'tiers') return <StackSimple size={16} weight="duotone" />;
    if (icon === 'audit') return <Scroll size={16} weight="duotone" />;
    return <Flask size={16} weight="duotone" />;
};

const sectionIcon = (icon: (typeof ADMIN_NAV_SECTIONS)[number]['icon']) => {
    if (icon === 'workspace') return <ChartPieSlice size={14} weight="duotone" />;
    if (icon === 'operations') return <StackSimple size={14} weight="duotone" />;
    return <Flask size={14} weight="duotone" />;
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
            <div className="px-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {sectionIcon(section.icon)}
                    {(mode === 'mobile' || !isSidebarCollapsed) && <span>{section.label}</span>}
                </div>
            </div>
            <div className="space-y-1">
                {section.items.map((item) => (
                    <NavLink
                        key={`${mode}-item-${item.id}`}
                        to={item.path}
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
        <div className="min-h-screen bg-slate-100 text-slate-900">
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-50 bg-slate-950/45 lg:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-[60] w-72 border-r border-slate-200 bg-white p-4 shadow-2xl transition-transform duration-200 lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
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

                <div className="mt-4 space-y-4">
                    {renderNavItems('mobile')}
                </div>
            </aside>

            <div className="flex min-h-screen w-full">
                <aside className={`hidden shrink-0 border-r border-slate-200 bg-white/95 p-4 transition-[width] duration-200 lg:flex lg:flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
                    <div className="flex items-center justify-between">
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
                        <button
                            type="button"
                            onClick={() => setIsSidebarCollapsed((current) => !current)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            {...getAnalyticsDebugAttributes('admin__menu--collapse_toggle')}
                        >
                            {isSidebarCollapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
                        </button>
                    </div>

                    <div className="mt-4 space-y-4">
                        {renderNavItems('desktop')}
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
                        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 md:px-6">
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
                            <div className="flex flex-wrap items-center gap-2">
                                {showGlobalSearch && (
                                    <>
                                        <label className="sr-only" htmlFor="admin-global-search">Search</label>
                                        <input
                                            id="admin-global-search"
                                            type="search"
                                            value={searchValue}
                                            onChange={(event) => onSearchValueChange?.(event.target.value)}
                                            placeholder="Search"
                                            disabled={!onSearchValueChange}
                                            className="h-9 w-[min(44vw,280px)] rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                                        />
                                    </>
                                )}
                                {showDateRange && (
                                    <>
                                        <label className="sr-only" htmlFor="admin-date-range">Date range</label>
                                        <select
                                            id="admin-date-range"
                                            value={dateRange}
                                            onChange={(event) => onDateRangeChange?.(event.target.value as AdminDateRange)}
                                            disabled={!onDateRangeChange}
                                            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                                        >
                                            {DATE_RANGE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                )}
                                {actions}
                                <NavLink
                                    to="/create-trip"
                                    onClick={() => emitMenuEvent('back_to_platform')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                                    {...getAnalyticsDebugAttributes('admin__menu--back_to_platform')}
                                >
                                    <ArrowSquareOut size={14} />
                                    Platform
                                </NavLink>
                                {isAdmin && (
                                    <AccountMenu email={access?.email || null} isAdmin compact />
                                )}
                            </div>
                        </div>
                    </header>

                    <div className="px-4 py-5 md:px-6 md:py-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
