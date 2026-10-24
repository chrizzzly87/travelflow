import { describe, expect, it } from 'vitest';
import { rootRoute, layout, route, index, physical } from '@tanstack/virtual-file-routes';
import { collectIndexableRoutePaths } from '../../scripts/lib/sitemapRoutes';
import { routes } from '../../src/virtualRoutes';

describe('native route sitemap discovery', () => {
    it('includes canonical public routes and login without private workspaces, recovery URLs or unresolved parameters', () => {
        const paths = collectIndexableRoutePaths(routes);
        expect(paths).toEqual(expect.arrayContaining(['/', '/features', '/pricing', '/login', '/inspirations/countries', '/imprint']));
        expect(paths).not.toEqual(expect.arrayContaining(['/auth/reset-password', '/share-unavailable', '/profile', '/checkout', '/admin/dashboard', '/create-trip']));
        expect(paths.every(path => !path.includes('$') && !path.includes('{'))).toBe(true);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it('discovers newly added native leaves, pathless layouts and index routes without a parallel URL inventory', () => {
        const tree = rootRoute('__root.tsx', [
            layout('_public', 'public.tsx', [
                route('/{-$locale}', 'home.tsx'),
                route('/{-$locale}/new-page', 'new-page.tsx'),
                route('/{-$locale}/guides', [index('guides.tsx'), route('cities', 'cities.tsx'), route('$slug', 'guide.tsx')]),
            ]),
            layout('_account', 'account.tsx', [route('/profile', 'profile.tsx')]),
        ]);
        expect(collectIndexableRoutePaths(tree)).toEqual(['/', '/new-page', '/guides', '/guides/cities']);
    });

    it('fails clearly when a public physical subtree would otherwise be silently omitted', () => {
        const tree = rootRoute('__root.tsx', [layout('_public', 'public.tsx', [physical('pages')])]);
        expect(() => collectIndexableRoutePaths(tree)).toThrow('native virtual tree');
    });
});
