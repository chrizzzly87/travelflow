import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    clearHoverIntentTimer,
    isNavPrefetchEnabled,
    PREFETCH_LINK_HIGHLIGHT_DEBUG_EVENT,
    publishPrefetchStats,
    scheduleHoverIntentWarmup,
    scheduleIdleWarmups,
    type PrefetchLinkHighlightDebugDetail,
    type PrefetchReason,
    warmRouteAssets,
} from '../services/navigationPrefetch';
import { stripLocalePrefix } from '../config/routes';

interface PrefetchIntent {
    path: string;
    sourceElement: Element;
}

interface NavigationPrefetchManagerProps {
    enabled?: boolean;
}

const INTERNAL_LINK_SELECTOR = 'a[href], [data-prefetch-href]';
const PREFETCH_OPTOUT_VALUE = 'off';
const MAX_VIEWPORT_WARMUPS_PER_VIEW = 4;
const shouldSuppressPassivePrefetchForPath = (pathname: string): boolean => {
    const normalizedPathname = stripLocalePrefix(pathname || '/');
    return (
        normalizedPathname === '/'
        || normalizedPathname.startsWith('/create-trip')
        || normalizedPathname.startsWith('/trip')
        || normalizedPathname.startsWith('/example')
    );
};

const resolvePrefetchIntent = (target: EventTarget | null): PrefetchIntent | null => {
    if (!target || !(target instanceof Element)) return null;
    const trigger = target.closest(INTERNAL_LINK_SELECTOR);
    if (!trigger) return null;

    if ((trigger as HTMLElement).dataset.prefetch === PREFETCH_OPTOUT_VALUE) {
        return null;
    }

    const explicitHref = (trigger as HTMLElement).dataset.prefetchHref;
    const rawHref = explicitHref || trigger.getAttribute('href') || '';
    if (!rawHref) return null;
    if (rawHref.startsWith('#')) return null;

    try {
        const url = new URL(rawHref, window.location.origin);
        if (url.origin !== window.location.origin) return null;
        return {
            path: url.pathname,
            sourceElement: trigger,
        };
    } catch {
        return null;
    }
};

export const NavigationPrefetchManager: React.FC<NavigationPrefetchManagerProps> = ({ enabled = true }) => {
    const location = useLocation();
    const prefetchEnabled = isNavPrefetchEnabled();

    if (!prefetchEnabled || !enabled) {
        return null;
    }

    const emitPrefetchLinkHighlight = (element: Element, path: string, reason: PrefetchReason) => {
        if (typeof window === 'undefined') return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return;

        const top = Math.max(0, rect.top);
        const left = Math.max(0, rect.left);
        const width = Math.max(0, Math.min(rect.width, window.innerWidth - left));
        const height = Math.max(0, Math.min(rect.height, window.innerHeight - top));
        if (width <= 0 || height <= 0) return;

        const detail: PrefetchLinkHighlightDebugDetail = {
            path,
            reason,
            top,
            left,
            width,
            height,
        };
        window.dispatchEvent(new CustomEvent<PrefetchLinkHighlightDebugDetail>(PREFETCH_LINK_HIGHLIGHT_DEBUG_EVENT, {
            detail,
        }));
    };

    const toInternalPath = (rawHref: string): string | null => {
        if (!rawHref) return null;
        try {
            const url = new URL(rawHref, window.location.origin);
            if (url.origin !== window.location.origin) return null;
            return url.pathname;
        } catch {
            return null;
        }
    };

    const collectIdleCandidatesForPath = (pathname: string): string[] => {
        if (typeof document === 'undefined') return [];
        const candidates: string[] = [];
        const seen = new Set<string>();

        const pushCandidate = (candidate: string | null) => {
            if (!candidate) return;
            if (candidate === pathname) return;
            if (seen.has(candidate)) return;
            seen.add(candidate);
            candidates.push(candidate);
        };

        if (pathname === '/blog') {
            const blogLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/blog/"]'));
            blogLinks.slice(0, 2).forEach((link) => pushCandidate(toInternalPath(link.getAttribute('href') || '')));
        }

        if (pathname.startsWith('/inspirations')) {
            const createTripLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/create-trip"]'));
            createTripLinks.slice(0, 2).forEach((link) => pushCandidate(toInternalPath(link.getAttribute('href') || '')));

            if (candidates.length < 2) {
                const inspirationLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/inspirations/"]'));
                inspirationLinks.slice(0, 2).forEach((link) => pushCandidate(toInternalPath(link.getAttribute('href') || '')));
            }
        }

        if (pathname === '/') {
            const exampleLinks = Array.from(document.querySelectorAll<HTMLElement>('[data-prefetch-href^="/example/"]'));
            exampleLinks.slice(0, 2).forEach((element) => pushCandidate(element.dataset.prefetchHref || null));
        }

        return candidates;
    };

    useEffect(() => {
        const onPointerEnter = (event: Event) => {
            if (shouldSuppressPassivePrefetchForPath(window.location.pathname)) return;
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            if (intent.path === window.location.pathname) return;
            scheduleHoverIntentWarmup(intent.sourceElement, intent.path, () => {
                emitPrefetchLinkHighlight(intent.sourceElement, intent.path, 'hover');
            });
        };

        const onPointerLeave = (event: Event) => {
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            clearHoverIntentTimer(intent.sourceElement);
        };

        const onPointerDown = (event: PointerEvent) => {
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            if (intent.path === window.location.pathname) return;
            emitPrefetchLinkHighlight(intent.sourceElement, intent.path, 'pointerdown');
            void warmRouteAssets(intent.path, 'pointerdown');
            publishPrefetchStats();
        };

        const onTouchStart = (event: TouchEvent) => {
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            if (intent.path === window.location.pathname) return;
            emitPrefetchLinkHighlight(intent.sourceElement, intent.path, 'touchstart');
            void warmRouteAssets(intent.path, 'touchstart');
            publishPrefetchStats();
        };

        document.addEventListener('pointerenter', onPointerEnter, true);
        document.addEventListener('pointerleave', onPointerLeave, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('touchstart', onTouchStart, true);

        return () => {
            document.removeEventListener('pointerenter', onPointerEnter, true);
            document.removeEventListener('pointerleave', onPointerLeave, true);
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('touchstart', onTouchStart, true);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (shouldSuppressPassivePrefetchForPath(location.pathname)) {
            return;
        }

        let viewportWarmups = 0;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                if (viewportWarmups >= MAX_VIEWPORT_WARMUPS_PER_VIEW) return;
                const element = entry.target as Element;
                const intent = resolvePrefetchIntent(element);
                if (!intent) return;
                if (intent.path === window.location.pathname) return;
                viewportWarmups += 1;
                emitPrefetchLinkHighlight(intent.sourceElement, intent.path, 'viewport');
                void warmRouteAssets(intent.path, 'viewport');
                observer.unobserve(element);
                publishPrefetchStats();
            });
        }, {
            rootMargin: '120px 0px',
            threshold: 0.01,
        });

        const refreshObservedLinks = () => {
            const elements = Array.from(document.querySelectorAll(INTERNAL_LINK_SELECTOR));
            elements.forEach((element) => {
                if ((element as HTMLElement).dataset.prefetch === PREFETCH_OPTOUT_VALUE) return;
                observer.observe(element);
            });
        };

        refreshObservedLinks();

        const mutationObserver = new MutationObserver(() => {
            refreshObservedLinks();
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });

        return () => {
            mutationObserver.disconnect();
            observer.disconnect();
        };
    }, [location.pathname]);

    useEffect(() => {
        const extraCandidates = collectIdleCandidatesForPath(location.pathname);
        scheduleIdleWarmups(location.pathname, extraCandidates);
        publishPrefetchStats();
    }, [location.pathname]);

    return null;
};
