import React from 'react';
import { NavLink } from 'react-router-dom';
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
        <nav className="flex flex-wrap items-center gap-2">
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
    );
};
