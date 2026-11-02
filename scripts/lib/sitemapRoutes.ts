import type { VirtualRootRoute, VirtualRouteNode } from '@tanstack/virtual-file-routes';

const INDEXABLE_AREAS = new Set(['_public', '_auth']);
const NON_INDEXABLE_PATHS = new Set(['/auth/reset-password', '/share-unavailable']);

/** Derive public static URLs from the same native tree that generates application routes. */
export function collectIndexableRoutePaths(tree: VirtualRootRoute): string[] {
    const paths = new Set<string>();
    const visit = (node: VirtualRouteNode, parentPath: string, indexable: boolean) => {
        if (node.type === 'physical') {
            if (indexable) throw new Error('Indexable sitemap areas must declare their routes in the native virtual tree.');
            return;
        }
        if (node.type === 'layout') {
            const areaIsIndexable = node.id ? INDEXABLE_AREAS.has(node.id) : indexable;
            node.children?.forEach(child => visit(child, parentPath, areaIsIndexable));
            return;
        }
        const routePath = node.type === 'index' ? parentPath : (
            node.path.startsWith('/') ? node.path : `${parentPath}/${node.path}`
        );
        const canonicalPath = routePath.replace('/{-$locale}', '').replace(/\/{2,}/g, '/') || '/';
        if (indexable && !canonicalPath.includes('$') && !NON_INDEXABLE_PATHS.has(canonicalPath)) {
            paths.add(canonicalPath);
        }
        if (node.type === 'route') node.children?.forEach(child => visit(child, routePath, indexable));
    };
    tree.children?.forEach(child => visit(child, '', false));
    if (paths.size === 0) throw new Error('No indexable static routes found in the native application tree.');
    return [...paths];
}
