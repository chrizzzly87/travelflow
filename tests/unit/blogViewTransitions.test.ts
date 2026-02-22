// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BLOG_VIEW_TRANSITION_CLASSES,
    createBlogTransitionNavigationState,
    getBlogTransitionStateVersion,
    getBlogTransitionNavigationState,
    getCurrentBlogPostTransitionTarget,
    getLastKnownBlogPostTransitionTarget,
    getBlogPostViewTransitionNames,
    getPendingBlogTransitionTarget,
    isBlogTransitionTargetMatch,
    isBlogListDetailTransition,
    isBlogListPath,
    isPendingBlogTransitionTarget,
    isPrimaryUnmodifiedClick,
    primeBlogTransitionSnapshot,
    subscribeBlogTransitionState,
    setCurrentBlogPostTransitionTarget,
    setPendingBlogTransitionTarget,
    startBlogViewTransition,
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
    setPendingBlogTransitionTarget(null);
    setCurrentBlogPostTransitionTarget(null);
});

describe('shared/blogViewTransitions', () => {
    it('creates stable view transition names with language + slug tokens', () => {
        expect(getBlogPostViewTransitionNames('de', 'weekend-getaway-tips')).toEqual({
            card: 'blog-post-card-de-weekend-getaway-tips',
            image: 'blog-post-image-de-weekend-getaway-tips',
            title: 'blog-post-title-de-weekend-getaway-tips',
            summary: 'blog-post-summary-de-weekend-getaway-tips',
            meta: 'blog-post-meta-de-weekend-getaway-tips',
            pills: 'blog-post-pills-de-weekend-getaway-tips',
        });
    });

    it('normalizes unsafe characters and applies fallbacks', () => {
        expect(getBlogPostViewTransitionNames('pt-BR', '  !!!  ')).toEqual({
            card: 'blog-post-card-pt-br-post',
            image: 'blog-post-image-pt-br-post',
            title: 'blog-post-title-pt-br-post',
            summary: 'blog-post-summary-pt-br-post',
            meta: 'blog-post-meta-pt-br-post',
            pills: 'blog-post-pills-pt-br-post',
        });
    });

    it('provides stable transition class names for blog elements', () => {
        expect(BLOG_VIEW_TRANSITION_CLASSES).toEqual({
            card: 'blog-card-transition',
            image: 'blog-image-transition',
            title: 'blog-title-transition',
            summary: 'blog-summary-transition',
            meta: 'blog-meta-transition',
            pills: 'blog-pills-transition',
        });
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
        expect(isBlogListPath('/blog')).toBe(true);
        expect(isBlogListPath('/de/blog')).toBe(true);
        expect(isBlogListPath('/de/blog/weekend-getaway-tips')).toBe(false);

        expect(isBlogListDetailTransition('/blog', '/blog/weekend-getaway-tips')).toBe(true);
        expect(isBlogListDetailTransition('/de/blog/weekend-getaway-tips', '/de/blog')).toBe(true);
        expect(isBlogListDetailTransition('/de/blog/a', '/de/blog/b')).toBe(false);
        expect(isBlogListDetailTransition('/pricing', '/blog')).toBe(false);
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

    it('starts a view transition wrapper when supported and falls back otherwise', () => {
        const applyUpdate = vi.fn();
        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(false)) as unknown as typeof window.matchMedia;
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            callback(16);
            return 1;
        }) as unknown as typeof window.requestAnimationFrame;
        const startTransition = vi.fn((callback: () => void | Promise<void>) => callback());
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: startTransition,
        });

        startBlogViewTransition(applyUpdate);
        expect(startTransition).toHaveBeenCalledTimes(1);
        expect(applyUpdate).toHaveBeenCalledTimes(1);

        startTransition.mockClear();
        applyUpdate.mockClear();
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: undefined,
        });
        startBlogViewTransition(applyUpdate);
        expect(startTransition).not.toHaveBeenCalled();
        expect(applyUpdate).toHaveBeenCalledTimes(1);
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
        window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
            callback(16);
            return 1;
        }) as unknown as typeof window.requestAnimationFrame;
        const applyUpdate = vi.fn();
        const startTransition = vi.fn(function (this: unknown, callback: () => void | Promise<void>) {
            if (this !== document) {
                throw new TypeError('Illegal invocation');
            }
            return callback();
        });
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: startTransition,
        });

        expect(() => startBlogViewTransition(applyUpdate)).not.toThrow();
        expect(startTransition).toHaveBeenCalledTimes(1);
        expect(applyUpdate).toHaveBeenCalledTimes(1);
    });

    it('applies and clears scoped blog transition styles around the active target', async () => {
        window.matchMedia = vi.fn().mockReturnValue(createReducedMotionMediaQueryList(false)) as unknown as typeof window.matchMedia;

        let resolveFinished: (() => void) | null = null;
        const finished = new Promise<void>((resolve) => {
            resolveFinished = resolve;
        });
        const startTransition = vi.fn((callback: () => void | Promise<void>) => {
            callback();
            return { finished };
        });
        Object.defineProperty(document, 'startViewTransition', {
            configurable: true,
            writable: true,
            value: startTransition,
        });
        setPendingBlogTransitionTarget({ language: 'en', slug: 'how-to-plan-multi-city-trip' });

        startBlogViewTransition();
        const styleElement = document.getElementById('blog-view-transition-active');
        expect(styleElement).not.toBeNull();
        expect(styleElement?.textContent).toContain('animation-duration: 2s;');
        expect(styleElement?.textContent).toContain('font-synthesis: none;');
        expect(getPendingBlogTransitionTarget()).toEqual({ language: 'en', slug: 'how-to-plan-multi-city-trip' });

        resolveFinished?.();
        await Promise.resolve();

        expect(document.getElementById('blog-view-transition-active')).toBeNull();
        expect(getPendingBlogTransitionTarget()).toBeNull();
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
        document.body.appendChild(image);

        const title = document.createElement('h1');
        title.style.viewTransitionName = names.title;
        document.body.appendChild(title);

        await expect(
            waitForBlogTransitionTarget({ language: 'en', slug: 'how-to-plan-multi-city-trip' }, 'list', 120)
        ).resolves.toBeUndefined();

        routeMarker.remove();
        card.remove();
        image.remove();
        title.remove();
    });
});
