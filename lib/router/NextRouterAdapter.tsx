'use client';

// Bridges next/navigation into the router compat layer. This module is the
// only place the compat layer touches Next.js APIs — tests use MemoryRouter
// instead and never load next/navigation.

import React, { useEffect, useMemo, useRef } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { NavigateOptions, RouterAdapter, RouterAdapterContext } from './context';
import { setPendingNavigationState } from './locationStore';
import {
    getBlogRouteKindFromPath,
    getCurrentBlogPostTransitionTarget,
    getLastKnownBlogPostTransitionTarget,
    isBlogListDetailTransition,
    setPendingBlogTransitionMode,
    setPendingBlogTransitionTarget,
    shouldUseColdBlogTransitionFallbackForKind,
    startBlogViewTransition,
    supportsBlogViewTransitions,
    type BlogViewTransitionType,
} from '../../shared/blogViewTransitions';

const PATHNAME_SETTLE_TIMEOUT_MS = 600;

/**
 * Back/forward (POP) navigations between the blog list and a post keep their
 * view transition: popstate fires before Next re-renders, so we open a view
 * transition whose async update resolves once the app has painted the target
 * pathname (with a timeout so a slow render can never wedge navigation).
 *
 * This replaces the legacy history-Proxy in shared/appHistory.ts.
 */
const useBlogPopTransitionBridge = (pathname: string, pathnameRef: React.MutableRefObject<string>) => {
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname, pathnameRef]);

    useEffect(() => {
        const waitForPathname = (target: string): Promise<void> => new Promise((resolve) => {
            const startedAt = Date.now();
            const check = () => {
                if (pathnameRef.current === target || Date.now() - startedAt > PATHNAME_SETTLE_TIMEOUT_MS) {
                    // One more frame so the committed DOM is painted into the
                    // transition's "new" snapshot.
                    requestAnimationFrame(() => resolve());
                    return;
                }
                requestAnimationFrame(check);
            };
            check();
        });

        const handlePopState = () => {
            const fromPathname = pathnameRef.current;
            const toPathname = window.location.pathname;
            const currentTarget = getCurrentBlogPostTransitionTarget() ?? getLastKnownBlogPostTransitionTarget();

            if (
                !supportsBlogViewTransitions()
                || !currentTarget
                || !isBlogListDetailTransition(fromPathname, toPathname)
            ) {
                return;
            }

            const toKind = getBlogRouteKindFromPath(toPathname);
            setPendingBlogTransitionMode(
                toKind !== 'other' && shouldUseColdBlogTransitionFallbackForKind(toKind) ? 'title-only' : 'full'
            );
            setPendingBlogTransitionTarget(currentTarget);
            const type: BlogViewTransitionType = toKind === 'post' ? 'blog-expand' : 'blog-collapse';

            startBlogViewTransition({
                type,
                update: () => waitForPathname(toPathname),
            });
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [pathnameRef]);
};

export const NextRouterAdapter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname() ?? '/';
    const params = useParams() ?? {};
    const pathnameRef = useRef(pathname);

    useBlogPopTransitionBridge(pathname, pathnameRef);

    const adapter = useMemo<RouterAdapter>(() => ({
        pathname,
        params: params as Record<string, string | string[] | undefined>,
        navigate: (href: string, options?: NavigateOptions) => {
            setPendingNavigationState(options?.state ?? null);
            const scroll = options?.preventScrollReset !== true;
            if (options?.replace) {
                router.replace(href, { scroll });
            } else {
                router.push(href, { scroll });
            }
        },
        go: (delta: number) => {
            if (typeof window === 'undefined') return;
            window.history.go(delta);
        },
        prefetch: (href: string) => {
            try {
                router.prefetch(href);
            } catch {
                // Prefetch is best-effort.
            }
        },
    }), [params, pathname, router]);

    return (
        <RouterAdapterContext.Provider value={adapter}>
            {children}
        </RouterAdapterContext.Provider>
    );
};
