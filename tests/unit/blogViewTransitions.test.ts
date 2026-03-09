// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BLOG_VIEW_TRANSITION_CLASSES,
    BLOG_VIEW_TRANSITION_DURATION,
    createBlogTransitionNavigationState,
    getBlogRouteKindFromPath,
    getBlogTransitionNavigationState,
    getBlogTransitionStateVersion,
    getBlogPostViewTransitionNames,
    hasWarmedBlogRouteKind,
    getCurrentBlogPostTransitionTarget,
    getCurrentBlogRouteKindFromDom,
    getLastKnownBlogPostTransitionTarget,
    getPendingBlogTransitionTarget,
    isBlogListDetailTransition,
    isBlogListPath,
    isBlogTransitionTargetMatch,
    isPendingBlogTransitionTarget,
    isPrimaryUnmodifiedClick,
    primeBlogTransitionSnapshot,
    resolveBlogTransitionNavigationHint,
    setCurrentBlogPostTransitionTarget,
    setPendingBlogTransitionTarget,
    markBlogRouteKindWarm,
    shouldDelayBlogCardProgressiveBlurReveal,
    startPreparedBlogViewTransition,
    startBlogViewTransition,
    subscribeBlogTransitionState,
    supportsBlogViewTransitions,
    waitForBlogTransitionTarget,
} from '../../shared/blogViewTransitions';

let originalStartViewTransition: unknown;
let originalMatchMedia: typeof window.matchMedia;
let originalRequestAnimationFrame: typeof window.requestAnimationFrame;

const createReducedMotionMediaQueryList = (matches: boolean): MediaQueryList => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(false),
});

beforeEach(() => {
    originalStartViewTransition = (document as Document & { startViewTransition?: unknown }).startViewTransition;
    originalMatchMedia = window.matchMedia;
    originalRequestAnimationFrame = window.requestAnimationFrame;
});

afterEach(() => {
    Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: originalStartViewTransition,
    });
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    document.body.innerHTML = '';
    setPendingBlogTransitionTarget(null);
    setCurrentBlogPostTransitionTarget(null);
});

describe('shared/blogViewTransitions', () => {
    it('creates stable view transition names with language + slug tokens', () => {
        expect(getBlogPostViewTransitionNames('de', 'weekend-getaway-tips')).toEqual({
            card: 'blog-post-card-de-weekend-getaway-tips',
            image: 'blog-post-image-de-weekend-getaway-tips',
            title: 'blog-post-title-de-weekend-getaway-tips',
        });
    });

    it('normalizes unsafe characters and applies fallbacks', () => {
        expect(getBlogPostViewTransitionNames('pt-BR', '  !!!  ')).toEqual({
            card: 'blog-post-card-pt-br-post',
            image: 'blog-post-image-pt-br-post',
            title: 'blog-post-title-pt-br-post',
        });
    });

    it('provides stable transition class names for blog elements', () => {
        expect(BLOG_VIEW_TRANSITION_CLASSES).toEqual({
            card: 'blog-card-transition',
            image: 'blog-image-transition',
            title: 'blog-title-transition',
        });
        expect(BLOG_VIEW_TRANSITION_DURATION).toBe('420ms');
    });

    it('creates and parses blog transition navigation state payloads', () => {
        const state = createBlogTransitionNavigationState('post', {
            language: 'en',
            slug: 'how-to-plan-multi-city-trip',
        });
        expect(getBlogTransitionNavigationState(state)).toEqual(state);
        expect(getBlogTransitionNavigationState({ blogTransitionSource: 'post' })).toBeNull();
        expect(getBlogTransitionNavigationState(null)).toBeNull();
    });

    it('resolves transition hint only during matching active post-to-list transitions', () => {
        const state = createBlogTransitionNavigationState('post', {
            language: 'en',
            slug: 'how-to-plan-multi-city-trip',
        });

        expect(resolveBlogTransitionNavigationHint(state, null)).toBeNull();
        expect(
            resolveBlogTransitionNavigationHint(state, {
                language: 'en',
                slug: 'different-post',
            })
        ).toBeNull();
        expect(
            resolveBlogTransitionNavigationHint(
                createBlogTransitionNavigationState('list', state.blogTransitionTarget),
                state.blogTransitionTarget
            )
        ).toBeNull();
        expect(resolveBlogTransitionNavigationHint(state, state.blogTransitionTarget)).toEqual(state.blogTransitionTarget);
    });

    it('matches transition targets with normalized language and slug tokens', () => {
        expect(
            isBlogTransitionTargetMatch(
                { language: 'pt-BR', slug: 'weekend getaway' },
                { language: 'pt-br', slug: 'weekend-getaway' }
            )
        ).toBe(true);
        expect(
            isBlogTransitionTargetMatch(
                { language: 'en', slug: 'weekend-getaway' },
                { language: 'de', slug: 'weekend-getaway' }
            )
        ).toBe(false);
    });

    it('delays the blog card blur reveal only for transition targets returning to the list', () => {
        expect(shouldDelayBlogCardProgressiveBlurReveal(false, true)).toBe(true);
        expect(shouldDelayBlogCardProgressiveBlurReveal(true, true)).toBe(false);
        expect(shouldDelayBlogCardProgressiveBlurReveal(false, false)).toBe(false);
    });

    it('tracks warmed blog route kinds for cold-start stabilization', () => {
        expect(hasWarmedBlogRouteKind('list')).toBe(false);
        expect(hasWarmedBlogRouteKind('post')).toBe(false);

        markBlogRouteKindWarm('list');

        expect(hasWarmedBlogRouteKind('list')).toBe(true);
        expect(hasWarmedBlogRouteKind('post')).toBe(false);
    });

    it('tracks pending and current transition targets with normalized matching', () => {
        const events: number[] = [];
        const unsubscribe = subscribeBlogTransitionState(() => {
            events.push(getBlogTransitionStateVersion());
        });
        setPendingBlogTransitionTarget({ language: 'pt-BR', slug: 'weekend getaway' });
        expect(getPendingBlogTransitionTarget()).toEqual({ language: 'pt-BR', slug: 'weekend getaway' });
        expect(isPendingBlogTransitionTarget('pt-br', 'weekend-getaway')).toBe(true);
        expect(isPendingBlogTransitionTarget('en', 'weekend-getaway')).toBe(false);
        expect(events.length).toBeGreaterThan(0);

        setCurrentBlogPostTransitionTarget({ language: 'de', slug: 'urlaub-tipps' });
        expect(getCurrentBlogPostTransitionTarget()).toEqual({ language: 'de', slug: 'urlaub-tipps' });
        expect(getLastKnownBlogPostTransitionTarget()).toEqual({ language: 'de', slug: 'urlaub-tipps' });

        setCurrentBlogPostTransitionTarget(null);
        expect(getCurrentBlogPostTransitionTarget()).toBeNull();
        expect(getLastKnownBlogPostTransitionTarget()).toEqual({ language: 'de', slug: 'urlaub-tipps' });
        unsubscribe();
    });

    it('matches localized blog list/detail route transitions', () => {
        expect(getBlogRouteKindFromPath('/blog')).toBe('list');
        expect(getBlogRouteKindFromPath('/de/blog')).toBe('list');
        expect(getBlogRouteKindFromPath('/de/blog/weekend-getaway-tips')).toBe('post');
        expect(getBlogRouteKindFromPath('/pricing')).toBe('other');

        expect(isBlogListPath('/blog')).toBe(true);
        expect(isBlogListPath('/de/blog')).toBe(true);
        expect(isBlogListPath('/de/blog/weekend-getaway-tips')).toBe(false);

        expect(isBlogListDetailTransition('/blog', '/blog/weekend-getaway-tips')).toBe(true);
        expect(isBlogListDetailTransition('/de/blog/weekend-getaway-tips', '/de/blog')).toBe(true);
        expect(isBlogListDetailTransition('/de/blog/a', '/de/blog/b')).toBe(false);
        expect(isBlogListDetailTransition('/pricing', '/blog')).toBe(false);
    });

    it('detects the current blog route kind from DOM markers', () => {
        expect(getCurrentBlogRouteKindFromDom()).toBeNull();

        const listRoute = document.createElement('section');
        listRoute.setAttribute('data-blog-route-kind', 'list');
        document.body.appendChild(listRoute);
        expect(getCurrentBlogRouteKindFromDom()).toBe('list');

        listRoute.remove();
        const postRoute = document.createElement('section');
        postRoute.setAttribute('data-blog-route-kind', 'post');
        document.body.appendChild(postRoute);
        expect(getCurrentBlogRouteKindFromDom()).toBe('post');
    });

    it('accepts only unmodified primary-button clicks for transition interception', () => {
        expect(isPrimaryUnmodifiedClick({
            altKey: false,
            button: 0,
            ctrlKey: false,
            defaultPrevented: false,
            metaKey: false,
            shiftKey: false,
        })).toBe(true);

        expect(isPrimaryUnmodifiedClick({
            altKey: false,
            button: 1,
            ctrlKey: false,
            defaultPrevented: false,
            metaKey: false,
            shiftKey: false,
        })).toBe(false);
    });

    it('enables transitions only when API is available and reduced motion is off', () => {
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: vi.fn(),
        });
        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(false)) as unknown as typeof window.matchMedia;
        expect(supportsBlogViewTransitions()).toBe(true);

        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(true)) as unknown as typeof window.matchMedia;
        expect(supportsBlogViewTransitions()).toBe(false);

        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: undefined,
        });
        expect(supportsBlogViewTransitions()).toBe(false);
    });

    it('starts a view transition with typed options when supported and falls back otherwise', async () => {
        const applyUpdate = vi.fn();
        let resolveFinished: (() => void) | null = null;
        const finished = new Promise<void>((resolve) => {
            resolveFinished = resolve;
        });

        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(false)) as unknown as typeof window.matchMedia;
        const startTransition = vi.fn((value: unknown) => {
            expect(typeof value).toBe('object');
            const options = value as { update?: () => void | Promise<void>; types?: string[] };
            expect(options.types).toEqual(['blog-expand']);
            void options.update?.();
            return { finished };
        });
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: startTransition,
        });

        setPendingBlogTransitionTarget({ language: 'en', slug: 'how-to-plan-multi-city-trip' });
        startBlogViewTransition({ type: 'blog-expand', update: applyUpdate });
        expect(startTransition).toHaveBeenCalledTimes(1);
        expect(applyUpdate).toHaveBeenCalledTimes(1);
        expect(getPendingBlogTransitionTarget()).toEqual({ language: 'en', slug: 'how-to-plan-multi-city-trip' });

        resolveFinished?.();
        await Promise.resolve();
        expect(getPendingBlogTransitionTarget()).toBeNull();

        startTransition.mockClear();
        applyUpdate.mockClear();

        const typesAdd = vi.fn();
        const legacyStartTransition = vi.fn((value: unknown) => {
            if (typeof value === 'object') {
                throw new TypeError('legacy signature');
            }
            const callback = value as () => void | Promise<void>;
            void callback();
            return { types: { add: typesAdd } };
        });
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: legacyStartTransition,
        });

        startBlogViewTransition({ type: 'blog-collapse', update: applyUpdate });
        expect(legacyStartTransition).toHaveBeenCalledTimes(2);
        expect(applyUpdate).toHaveBeenCalledTimes(1);
        expect(typesAdd).toHaveBeenCalledWith('blog-collapse');
    });

    it('primes blog transition snapshots with a deterministic layout read', () => {
        const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const rootLayoutReadSpy = vi.spyOn(document.documentElement, 'getBoundingClientRect');
        const bodyLayoutReadSpy = vi.spyOn(document.body, 'getBoundingClientRect');

        primeBlogTransitionSnapshot();

        expect(rootLayoutReadSpy).toHaveBeenCalledTimes(1);
        expect(bodyLayoutReadSpy).toHaveBeenCalledTimes(1);
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('invokes document.startViewTransition with document binding', () => {
        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(false)) as unknown as typeof window.matchMedia;
        const applyUpdate = vi.fn();
        const startTransition = vi.fn(function (this: unknown, value: unknown) {
            if (this !== document) {
                throw new TypeError('Illegal invocation');
            }

            if (typeof value === 'function') {
                return value();
            }

            return (value as { update?: () => void | Promise<void> }).update?.();
        });
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: startTransition,
        });

        expect(() => startBlogViewTransition({ update: applyUpdate })).not.toThrow();
        expect(startTransition).toHaveBeenCalledTimes(1);
        expect(applyUpdate).toHaveBeenCalledTimes(1);
    });

    it('prepares navigation before starting the transition without making the update async', async () => {
        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(false)) as unknown as typeof window.matchMedia;

        const callOrder: string[] = [];
        let transitionUpdateResult: unknown;
        const startTransition = vi.fn((value: unknown) => {
            const options = value as { update?: () => void | Promise<void>; types?: string[] };
            callOrder.push('start');
            transitionUpdateResult = options.update?.();
            return { finished: Promise.resolve() };
        });

        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: startTransition,
        });

        await startPreparedBlogViewTransition({
            prepare: async () => {
                callOrder.push('prepare');
            },
            beforeTransition: () => {
                callOrder.push('before');
            },
            type: 'blog-expand',
            update: () => {
                callOrder.push('update');
            },
        });

        expect(callOrder).toEqual(['prepare', 'before', 'start', 'update']);
        expect(transitionUpdateResult).toBeUndefined();
    });

    it('supports a bounded target-ready wait for cold-start transitions', async () => {
        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(false)) as unknown as typeof window.matchMedia;

        const callOrder: string[] = [];
        let transitionUpdateResult: unknown;
        const startTransition = vi.fn((value: unknown) => {
            const options = value as { update?: () => void | Promise<void>; types?: string[] };
            callOrder.push('start');
            transitionUpdateResult = options.update?.();
            return { finished: Promise.resolve() };
        });

        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: startTransition,
        });

        await startPreparedBlogViewTransition({
            type: 'blog-collapse',
            update: () => {
                callOrder.push('update');
            },
            waitForReady: async () => {
                callOrder.push('wait');
            },
        });

        expect(callOrder).toEqual(['start', 'update', 'wait']);
        expect(transitionUpdateResult).toBeInstanceOf(Promise);
        await transitionUpdateResult;
    });

    it('waits for route marker + shared elements before considering target ready', async () => {
        const names = getBlogPostViewTransitionNames('en', 'how-to-plan-multi-city-trip');
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            callback(16);
            return 1;
        }) as unknown as typeof window.requestAnimationFrame;

        const routeMarker = document.createElement('section');
        routeMarker.setAttribute('data-blog-route-kind', 'list');
        document.body.appendChild(routeMarker);

        const card = document.createElement('div');
        card.style.viewTransitionName = names.card;
        document.body.appendChild(card);

        const image = document.createElement('div');
        image.style.viewTransitionName = names.image;
        image.innerHTML = '<img alt="cover" src="/cover.webp">';
        document.body.appendChild(image);

        const title = document.createElement('h1');
        title.style.viewTransitionName = names.title;
        document.body.appendChild(title);

        await expect(
            waitForBlogTransitionTarget({ language: 'en', slug: 'how-to-plan-multi-city-trip' }, 'list', 120)
        ).resolves.toBeUndefined();
    });
});
