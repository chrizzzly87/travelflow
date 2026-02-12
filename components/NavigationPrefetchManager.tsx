import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    clearHoverIntentTimer,
    isNavPrefetchEnabled,
    publishPrefetchStats,
    scheduleHoverIntentWarmup,
    scheduleIdleWarmups,
    warmRouteAssets,
} from '../services/navigationPrefetch';

interface PrefetchIntent {
    path: string;
    sourceElement: Element;
}

const INTERNAL_LINK_SELECTOR = 'a[href], [data-prefetch-href]';
const PREFETCH_OPTOUT_VALUE = 'off';
const MAX_VIEWPORT_WARMUPS_PER_VIEW = 4;

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

export const NavigationPrefetchManager: React.FC = () => {
    const location = useLocation();
    const prefetchEnabled = isNavPrefetchEnabled();

    if (!prefetchEnabled) {
        return null;
    }

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
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            if (intent.path === window.location.pathname) return;
            scheduleHoverIntentWarmup(intent.sourceElement, intent.path);
        };

        const onPointerLeave = (event: Event) => {
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            clearHoverIntentTimer(intent.sourceElement);
        };

        const onFocusIn = (event: FocusEvent) => {
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            if (intent.path === window.location.pathname) return;
            void warmRouteAssets(intent.path, 'focus');
            publishPrefetchStats();
        };

        const onPointerDown = (event: PointerEvent) => {
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            if (intent.path === window.location.pathname) return;
            void warmRouteAssets(intent.path, 'pointerdown');
            publishPrefetchStats();
        };

        const onTouchStart = (event: TouchEvent) => {
            const intent = resolvePrefetchIntent(event.target);
            if (!intent) return;
            if (intent.path === window.location.pathname) return;
            void warmRouteAssets(intent.path, 'touchstart');
            publishPrefetchStats();
        };

        document.addEventListener('pointerenter', onPointerEnter, true);
        document.addEventListener('pointerleave', onPointerLeave, true);
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('touchstart', onTouchStart, true);

        return () => {
            document.removeEventListener('pointerenter', onPointerEnter, true);
            document.removeEventListener('pointerleave', onPointerLeave, true);
            document.removeEventListener('focusin', onFocusIn, true);
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('touchstart', onTouchStart, true);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
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
