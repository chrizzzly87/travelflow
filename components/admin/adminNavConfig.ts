export interface AdminNavItem {
    id: string;
    label: string;
    path: string;
    section: 'workspace' | 'operations' | 'tools';
    description: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    {
        id: 'overview',
        label: 'Overview',
        path: '/admin/dashboard',
        section: 'workspace',
        description: 'Bento metrics and operational pulse.',
    },
    {
        id: 'users',
        label: 'Users',
        path: '/admin/users',
        section: 'operations',
        description: 'Provisioning, tiers, and profile controls.',
    },
    {
        id: 'trips',
        label: 'Trips',
        path: '/admin/trips',
        section: 'operations',
        description: 'Lifecycle and ownership management.',
    },
    {
        id: 'tiers',
        label: 'Tiers',
        path: '/admin/tiers',
        section: 'operations',
        description: 'Entitlement templates and reapply tools.',
    },
    {
        id: 'audit',
        label: 'Audit Log',
        path: '/admin/audit',
        section: 'operations',
        description: 'Admin action timeline and forensics.',
    },
    {
        id: 'ai_benchmark',
        label: 'AI Benchmark',
        path: '/admin/ai-benchmark',
        section: 'tools',
        description: 'Internal model benchmark tooling.',
    },
];

export const ADMIN_NAV_SECTIONS: Array<{ id: AdminNavItem['section']; label: string }> = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'operations', label: 'Operations' },
    { id: 'tools', label: 'Tools' },
];
