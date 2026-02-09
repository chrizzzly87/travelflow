export interface NavItem {
    label: string;
    to: string;
}

export const NAV_ITEMS: NavItem[] = [
    { label: 'Features', to: '/features' },
    { label: 'Inspirations', to: '/inspirations' },
    { label: 'News & Updates', to: '/updates' },
    { label: 'Blog', to: '/blog' },
    { label: 'Pricing', to: '/pricing' },
];
