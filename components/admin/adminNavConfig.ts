export interface AdminNavItem {
    id: string;
    label: string;
    path: string;
    section: AdminNavSectionId;
    icon: AdminNavItemIconKey;
    /** One line for the command palette, so a search for "money" finds Billing. */
    keywords?: string[];
}

export type AdminNavSectionId = 'workspace' | 'operations' | 'content' | 'tools';
export type AdminNavItemIconKey = 'settings' | 'overview' | 'users' | 'trips' | 'tiers' | 'billing' | 'audit' | 'legal' | 'benchmark' | 'telemetry' | 'worker_health' | 'og_tools' | 'design_system' | 'airports' | 'destinations' | 'recommendations';

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
        keywords: ['dashboard', 'home', 'metrics'],
    },
    {
        id: 'global_settings',
        label: 'Settings',
        path: '/admin/settings',
        section: 'workspace',
        icon: 'settings',
        keywords: ['global', 'feature flags', 'runtime', 'ai model'],
    },
    {
        id: 'users',
        label: 'Users',
        path: '/admin/users',
        section: 'operations',
        icon: 'users',
        keywords: ['accounts', 'roles', 'provisioning'],
    },
    {
        id: 'trips',
        label: 'Trips',
        path: '/admin/trips',
        section: 'operations',
        icon: 'trips',
        keywords: ['itineraries', 'lifecycle'],
    },
    {
        id: 'tiers',
        label: 'Tiers',
        path: '/admin/tiers',
        section: 'operations',
        icon: 'tiers',
        keywords: ['plans', 'entitlements', 'limits'],
    },
    {
        id: 'billing',
        label: 'Billing',
        path: '/admin/billing',
        section: 'operations',
        icon: 'billing',
        keywords: ['subscriptions', 'paddle', 'revenue', 'money'],
    },
    {
        id: 'audit',
        label: 'Audit log',
        path: '/admin/audit',
        section: 'operations',
        icon: 'audit',
        keywords: ['history', 'changes', 'undo'],
    },
    {
        id: 'airports',
        label: 'Airports',
        path: '/admin/airports',
        section: 'content',
        icon: 'airports',
        keywords: ['flights', 'iata'],
    },
    {
        id: 'destinations',
        label: 'Destinations',
        path: '/admin/destinations',
        section: 'content',
        icon: 'destinations',
        keywords: ['countries', 'cities', 'guides'],
    },
    {
        id: 'recommendations',
        label: 'Recommendations',
        path: '/admin/recommendations',
        section: 'content',
        icon: 'recommendations',
        keywords: ['places', 'deck'],
    },
    {
        id: 'legal',
        label: 'Legal terms',
        path: '/admin/legal',
        section: 'content',
        icon: 'legal',
        keywords: ['terms', 'conditions', 'tos'],
    },
    {
        id: 'ai_benchmark',
        label: 'AI benchmark',
        path: '/admin/ai-benchmark',
        section: 'tools',
        icon: 'benchmark',
        keywords: ['models', 'evaluation'],
    },
    {
        id: 'ai_telemetry',
        label: 'AI telemetry',
        path: '/admin/ai-benchmark/telemetry',
        section: 'tools',
        icon: 'telemetry',
        keywords: ['cost', 'latency', 'tokens'],
    },
    {
        id: 'ai_worker_health',
        label: 'Worker health',
        path: '/admin/ai-benchmark/worker-health',
        section: 'tools',
        icon: 'worker_health',
        keywords: ['queue', 'jobs', 'status'],
    },
    {
        id: 'og_tools',
        label: 'OG tools',
        path: '/admin/og-tools',
        section: 'tools',
        icon: 'og_tools',
        keywords: ['open graph', 'sharing', 'preview images'],
    },
    {
        id: 'design_system_playground',
        label: 'Design system',
        path: '/admin/design-system-playground',
        section: 'tools',
        icon: 'design_system',
        keywords: ['components', 'playground', 'ui'],
    },
];

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'operations', label: 'Operations' },
    { id: 'content', label: 'Content' },
    { id: 'tools', label: 'Tools' },
];

/**
 * The nav item a pathname belongs to: the longest item path that is the
 * pathname itself or a parent segment of it, so `/admin/ai-benchmark/telemetry`
 * resolves to AI telemetry and not to AI benchmark.
 */
export const findActiveAdminNavItem = (pathname: string): AdminNavItem | null => {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    let match: AdminNavItem | null = null;
    for (const item of ADMIN_NAV_ITEMS) {
        const isMatch = normalized === item.path || normalized.startsWith(`${item.path}/`);
        if (isMatch && (!match || item.path.length > match.path.length)) {
            match = item;
        }
    }
    return match;
};

export const getAdminNavSectionLabel = (sectionId: AdminNavSectionId): string =>
    ADMIN_NAV_SECTIONS.find((section) => section.id === sectionId)?.label ?? '';
