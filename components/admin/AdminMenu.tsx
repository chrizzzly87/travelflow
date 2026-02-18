import React from 'react';
import { AirplaneTilt, ArrowSquareOut } from '@phosphor-icons/react';
import { NavLink } from 'react-router-dom';
import { APP_NAME } from '../../config/appGlobals';
import { buildPath } from '../../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const ADMIN_MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard' },
    { id: 'users', label: 'Users', path: '/admin/users' },
    { id: 'trips', label: 'Trips', path: '/admin/trips' },
    { id: 'tiers', label: 'Tiers', path: '/admin/tiers' },
    { id: 'audit', label: 'Audit Log', path: '/admin/audit' },
    { id: 'ai_benchmark', label: 'AI Benchmark', path: '/admin/ai-benchmark' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClass = 'relative font-semibold text-slate-500 transition-colors hover:text-slate-900 after:pointer-events-none after:absolute after:-bottom-4 after:left-0 after:h-0.5 after:w-full after:origin-center after:scale-x-0 after:rounded-full after:bg-accent-600 after:transition-transform';
    if (isActive) return `${baseClass} text-slate-900 after:scale-x-100`;
    return baseClass;
};

const mobileMenuLinkClass = ({ isActive }: { isActive: boolean }) => {
    const base = 'inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors';
    if (isActive) {
        return `${base} border-accent-300 bg-accent-50 text-accent-800`;
    }
    return `${base} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900`;
};

export const AdminMenu: React.FC = () => {
    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur" style={{ viewTransitionName: 'admin-header' }}>
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
                <NavLink
                    to={buildPath('adminDashboard')}
                    onClick={() => trackEvent('admin__menu--brand')}
                    className="flex items-center gap-2"
                    {...getAnalyticsDebugAttributes('admin__menu--brand')}
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                        <AirplaneTilt size={16} weight="duotone" />
                    </span>
                    <span className="flex flex-col leading-tight">
                        <span className="text-lg font-extrabold tracking-tight text-slate-900">{APP_NAME}</span>
                        <span className="text-[11px] font-light uppercase tracking-[0.14em] text-slate-500">
                            Admin Dashboard
                        </span>
                    </span>
                </NavLink>

                <nav className="hidden items-center gap-4 text-sm lg:flex xl:gap-6">
                    {ADMIN_MENU_ITEMS.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            className={navLinkClass}
                            onClick={() => trackEvent(`admin__menu--${item.id}`)}
                            {...getAnalyticsDebugAttributes(`admin__menu--${item.id}`)}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <NavLink
                    to={buildPath('createTrip')}
                    onClick={() => trackEvent('admin__menu--back_to_platform')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                    {...getAnalyticsDebugAttributes('admin__menu--back_to_platform')}
                >
                    Back to Platform
                    <ArrowSquareOut size={14} />
                </NavLink>
            </div>

            <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 border-t border-slate-200/70 px-5 py-3 lg:hidden lg:px-8">
                {ADMIN_MENU_ITEMS.map((item) => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={mobileMenuLinkClass}
                        onClick={() => trackEvent(`admin__menu--${item.id}`)}
                        {...getAnalyticsDebugAttributes(`admin__menu--${item.id}`)}
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </header>
    );
};
