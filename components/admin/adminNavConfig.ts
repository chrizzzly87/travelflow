export interface AdminNavItem {
    id: string;
    label: string;
    path: string;
    section: AdminNavSectionId;
    icon: AdminNavItemIconKey;
}

export type AdminNavSectionId = 'workspace' | 'operations' | 'tools';
export type AdminNavItemIconKey = 'overview' | 'users' | 'trips' | 'tiers' | 'audit' | 'benchmark' | 'telemetry';

export interface AdminNavSection {
    id: AdminNavSectionId;
    label: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    {
        id: 'overview',
        label: 'Overview',
        path: '/admin/dashboard',
        section: 'workspace',
        icon: 'overview',
    },
    {
        id: 'users',
        label: 'Users',
        path: '/admin/users',
        section: 'operations',
        icon: 'users',
    },
    {
        id: 'trips',
        label: 'Trips',
        path: '/admin/trips',
        section: 'operations',
        icon: 'trips',
    },
    {
        id: 'tiers',
        label: 'Tiers',
        path: '/admin/tiers',
        section: 'operations',
        icon: 'tiers',
    },
    {
        id: 'audit',
        label: 'Audit Log',
        path: '/admin/audit',
        section: 'operations',
        icon: 'audit',
    },
    {
        id: 'ai_benchmark',
        label: 'AI Benchmark',
        path: '/admin/ai-benchmark',
        section: 'tools',
        icon: 'benchmark',
    },
    {
        id: 'ai_telemetry',
        label: 'AI Telemetry',
        path: '/admin/ai-benchmark/telemetry',
        section: 'tools',
        icon: 'telemetry',
    },
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'operations', label: 'Operations' },
    { id: 'tools', label: 'Tools' },
];
