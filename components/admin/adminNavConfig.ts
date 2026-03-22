export interface AdminNavItem {
    id: string;
    label: string;
    path: string;
    section: AdminNavSectionId;
    icon: AdminNavItemIconKey;
}

export type AdminNavSectionId = 'workspace' | 'operations' | 'tools';
export type AdminNavItemIconKey = 'overview' | 'users' | 'trips' | 'tiers' | 'billing' | 'audit' | 'legal' | 'benchmark' | 'telemetry' | 'og_tools' | 'design_system' | 'airports';

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
        id: 'airports',
        label: 'Airports',
        path: '/admin/airports',
        section: 'operations',
        icon: 'airports',
    },
    {
        id: 'tiers',
        label: 'Tiers',
        path: '/admin/tiers',
        section: 'operations',
        icon: 'tiers',
    },
    {
        id: 'billing',
        label: 'Billing',
        path: '/admin/billing',
        section: 'operations',
        icon: 'billing',
    },
    {
        id: 'audit',
        label: 'Audit Log',
        path: '/admin/audit',
        section: 'operations',
        icon: 'audit',
    },
    {
        id: 'legal',
        label: 'Legal Terms',
        path: '/admin/legal',
        section: 'operations',
        icon: 'legal',
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
    {
        id: 'ai_worker_health',
        label: 'Worker Health',
        path: '/admin/ai-benchmark/worker-health',
        section: 'tools',
        icon: 'telemetry',
    },
    {
        id: 'og_tools',
        label: 'OG Tools',
        path: '/admin/og-tools',
        section: 'tools',
        icon: 'og_tools',
    },
    {
        id: 'design_system_playground',
        label: 'Design Playground',
        path: '/admin/design-system-playground',
        section: 'tools',
        icon: 'design_system',
    },
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'operations', label: 'Operations' },
    { id: 'tools', label: 'Tools' },
];
