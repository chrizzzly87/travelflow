import React from 'react';
import { AirplaneTilt, ArrowSquareOut } from '@phosphor-icons/react';
import { Link, NavLink } from 'react-router-dom';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const ADMIN_MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard' },
    { id: 'ai_benchmark', label: 'AI Benchmark', path: '/admin/ai-benchmark' },
    { id: 'access', label: 'Access Control', path: '/admin/access' },
];

const menuLinkClass = ({ isActive }: { isActive: boolean }) => {
    const base = 'inline-flex items-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors';
    if (isActive) {
        return `${base} border-accent-300 bg-accent-50 text-accent-800`;
    }
    return `${base} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900`;
};

export const AdminMenu: React.FC = () => {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    to="/admin/dashboard"
                    onClick={() => trackEvent('admin__menu--brand')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:border-accent-300 hover:bg-accent-50"
                    {...getAnalyticsDebugAttributes('admin__menu--brand')}
                >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent-600 text-white">
                        <AirplaneTilt size={14} weight="duotone" />
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                        TravelFlow <span className="text-accent-700">Admin Dashboard</span>
                    </span>
                </Link>

                <Link
                    to="/create-trip"
                    onClick={() => trackEvent('admin__menu--back_to_platform')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    {...getAnalyticsDebugAttributes('admin__menu--back_to_platform')}
                >
                    <ArrowSquareOut size={14} />
                    Back to Platform
                </Link>
            </div>

            <nav className="mt-3 flex flex-wrap items-center gap-2">
                {ADMIN_MENU_ITEMS.map((item) => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={menuLinkClass}
                        onClick={() => trackEvent(`admin__menu--${item.id}`)}
                        {...getAnalyticsDebugAttributes(`admin__menu--${item.id}`)}
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </section>
    );
};
