/**
 * Admin screen names by route, for the document title. Mirrors the navigation
 * labels in components/admin/adminNavConfig.ts as a literal map, so the page
 * metadata resolver (shared with the edge runtime) does not import admin UI
 * config. tests/unit/pageTitleService.test.ts keeps the two in step.
 */
export const ADMIN_SCREEN_TITLES: Readonly<Record<string, string>> = {
    '/admin/dashboard': 'Overview',
    '/admin/settings': 'Settings',
    '/admin/users': 'Users',
    '/admin/trips': 'Trips',
    '/admin/trip-drafts': 'AI trip drafts',
    '/admin/tiers': 'Plans',
    '/admin/billing': 'Billing',
    '/admin/audit': 'Audit log',
    '/admin/airports': 'Airports',
    '/admin/destinations': 'Destinations',
    '/admin/recommendations': 'Recommendations',
    '/admin/legal': 'Legal terms',
    '/admin/ai-benchmark': 'AI benchmark',
    '/admin/ai-benchmark/telemetry': 'AI telemetry',
    '/admin/ai-benchmark/worker-health': 'Worker health',
    '/admin/og-tools': 'OG tools',
    '/admin/design-system-playground': 'Design system',
    '/admin/component-playground': 'Component playground',
    '/admin/component-canvas': 'Component canvas',
};

/** "Users · Admin" for a known screen, plain "Admin" otherwise. */
export const resolveAdminDocumentTitle = (pathname: string): string => {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    const screen = ADMIN_SCREEN_TITLES[normalized];
    return screen ? `${screen} · Admin` : 'Admin';
};
