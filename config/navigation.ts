export interface NavItem {
    id: 'features' | 'inspirations' | 'updates' | 'blog' | 'pricing';
    labelKey: string;
    routeKey: 'features' | 'inspirations' | 'updates' | 'blog' | 'pricing';
}

export const NAV_ITEMS: NavItem[] = [
    { id: 'features', labelKey: 'nav.features', routeKey: 'features' },
    { id: 'inspirations', labelKey: 'nav.inspirations', routeKey: 'inspirations' },
    { id: 'updates', labelKey: 'nav.updates', routeKey: 'updates' },
    { id: 'blog', labelKey: 'nav.blog', routeKey: 'blog' },
    { id: 'pricing', labelKey: 'nav.pricing', routeKey: 'pricing' },
];
