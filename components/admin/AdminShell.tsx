import React from 'react';
import { NavLink } from 'react-router-dom';
import { AirplaneTilt } from '@phosphor-icons/react';
import { APP_NAME } from '../../config/appGlobals';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS } from './adminNavConfig';

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
}

const sectionLabelClass = 'px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500';

const buildDesktopNavClass = ({ isActive }: { isActive: boolean }) => {
    if (isActive) {
        return 'rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-900';
    }
    return 'rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900';
};

const buildMobileNavClass = ({ isActive }: { isActive: boolean }) => {
    if (isActive) {
        return 'inline-flex items-center rounded-lg border border-accent-300 bg-accent-50 px-2.5 py-1.5 text-xs font-semibold text-accent-900';
    }
    return 'inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900';
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
}) => {
    const emitMenuEvent = (id: string) => {
        trackEvent(`admin__menu--${id}`);
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <div className="flex min-h-screen w-full">
                <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/95 p-4 lg:flex lg:flex-col lg:gap-6">
                    <NavLink
                        to="/admin/dashboard"
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                        onClick={() => emitMenuEvent('brand')}
                        {...getAnalyticsDebugAttributes('admin__menu--brand')}
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                            <AirplaneTilt size={17} weight="duotone" />
                        </span>
                        <span className="flex flex-col">
                            <span className="text-base font-black tracking-tight text-slate-900">{APP_NAME}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Admin workspace</span>
                        </span>
                    </NavLink>

                    <div className="space-y-4">
                        {ADMIN_NAV_SECTIONS.map((section) => {
                            const sectionItems = ADMIN_NAV_ITEMS.filter((item) => item.section === section.id);
                            if (sectionItems.length === 0) return null;
                            return (
                                <section key={`section-${section.id}`} className="space-y-2">
                                    <h2 className={sectionLabelClass}>{section.label}</h2>
                                    <div className="space-y-1">
                                        {sectionItems.map((item) => (
                                            <NavLink
                                                key={item.id}
                                                to={item.path}
                                                className={buildDesktopNavClass}
                                                onClick={() => emitMenuEvent(item.id)}
                                                {...getAnalyticsDebugAttributes(`admin__menu--${item.id}`)}
                                            >
                                                <div className="text-sm">{item.label}</div>
                                                <div className="mt-0.5 text-[11px] font-normal text-slate-500">{item.description}</div>
                                            </NavLink>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
                        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 md:px-6">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-700">Admin dashboard</p>
                                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{title}</h1>
                                {description && (
                                    <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="sr-only" htmlFor="admin-global-search">Search</label>
                                <input
                                    id="admin-global-search"
                                    type="search"
                                    value={searchValue}
                                    onChange={(event) => onSearchValueChange?.(event.target.value)}
                                    placeholder="Search users, trips, emails..."
                                    disabled={!onSearchValueChange}
                                    className="h-9 w-[min(44vw,320px)] rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                                />
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
                                {actions}
                            </div>
                        </div>

                        <div className="border-t border-slate-200 px-4 py-2 lg:hidden">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {ADMIN_NAV_ITEMS.map((item) => (
                                    <NavLink
                                        key={`mobile-${item.id}`}
                                        to={item.path}
                                        className={buildMobileNavClass}
                                        onClick={() => emitMenuEvent(item.id)}
                                        {...getAnalyticsDebugAttributes(`admin__menu--${item.id}`)}
                                    >
                                        {item.label}
                                    </NavLink>
                                ))}
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
