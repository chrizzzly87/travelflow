import type { CSSProperties } from 'react';
import { buildImageCdnUrl, buildImageSrcSet } from '../utils/imageDelivery';

type BlogViewTransitionPart = 'card' | 'image' | 'title';
type BlogRouteKind = 'list' | 'post' | 'other';

const BLOG_VIEW_TRANSITION_PREFIX = 'blog-post';
const BLOG_ROUTE_PATTERN = /^\/(?:[a-z]{2}\/)?blog(?:\/([^/?#]+))?\/?$/i;

export const BLOG_VIEW_TRANSITION_DURATION = '420ms';

type SeenBlogRouteKind = Exclude<BlogRouteKind, 'other'>;
type PendingBlogTransitionMode = 'full' | 'title-only';

export interface BlogTransitionTarget {
    language: string;
    slug: string;
}

export interface WarmResponsiveBlogImageOptions {
    src: string;
    sizes?: string;
    srcSetWidths?: number[];
    disableCdn?: boolean;
    fetchPriority?: 'high' | 'low' | 'auto';
}

export type BlogTransitionSource = 'list' | 'post';
export type BlogViewTransitionType = 'blog-expand' | 'blog-collapse';

export interface BlogTransitionNavigationState {
    blogTransitionSource: BlogTransitionSource;
    blogTransitionTarget: BlogTransitionTarget;
}

interface ViewTransitionWithFinished {
    finished?: Promise<unknown>;
    types?: {
        add?: (value: string) => void;
    };
}

type ViewTransitionCapableDocument = Document & {
    startViewTransition?: unknown;
};

interface StartViewTransitionOptions {
    update?: () => void | Promise<void>;
    type?: BlogViewTransitionType;
}

interface StartPreparedBlogViewTransitionOptions extends StartViewTransitionOptions {
    beforeTransition?: () => void;
    prepare?: () => Promise<unknown>;
}

const toTransitionToken = (value: string, fallback: string): string => {
    const normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return normalized || fallback;
};

const buildBlogPostViewTransitionName = (
    part: BlogViewTransitionPart,
    language: string,
    slug: string
): string => {
    const languageToken = toTransitionToken(language, 'lang');
    const slugToken = toTransitionToken(slug, 'post');
    return `${BLOG_VIEW_TRANSITION_PREFIX}-${part}-${languageToken}-${slugToken}`;
};

export interface BlogPostViewTransitionNames {
    card: string;
    image: string;
    title: string;
}

export const BLOG_VIEW_TRANSITION_CLASSES = {
    card: 'blog-card-transition',
    image: 'blog-image-transition',
    title: 'blog-title-transition',
} as const;

const supportsCssFeature = (query: string): boolean => {
    if (typeof window === 'undefined' || typeof window.CSS === 'undefined') return false;
    if (typeof window.CSS.supports !== 'function') return false;

    try {
        return window.CSS.supports(query);
    } catch {
        return false;
    }
};

let pendingBlogTransitionTarget: BlogTransitionTarget | null = null;
let currentBlogPostTransitionTarget: BlogTransitionTarget | null = null;
let lastKnownBlogPostTransitionTarget: BlogTransitionTarget | null = null;
let blogTransitionStateVersion = 0;
const blogTransitionStateListeners = new Set<() => void>();
const warmedResponsiveBlogImages = new Set<string>();
const seenBlogRouteKinds = new Set<SeenBlogRouteKind>();
let pendingBlogTransitionMode: PendingBlogTransitionMode = 'full';

const notifyBlogTransitionStateChange = (): void => {
    blogTransitionStateVersion += 1;
    blogTransitionStateListeners.forEach((listener) => listener());
};

export const getBlogPostViewTransitionNames = (
    language: string,
    slug: string
): BlogPostViewTransitionNames => ({
    card: buildBlogPostViewTransitionName('card', language, slug),
    image: buildBlogPostViewTransitionName('image', language, slug),
    title: buildBlogPostViewTransitionName('title', language, slug),
});

const resolveTransitionTargetToken = (value: string, fallback: string): string =>
    toTransitionToken(value, fallback);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isBlogTransitionSource = (value: unknown): value is BlogTransitionSource =>
    value === 'list' || value === 'post';

const isValidBlogTransitionTarget = (value: unknown): value is BlogTransitionTarget => {
    if (!isRecord(value)) return false;
    const language = value.language;
    const slug = value.slug;
    return typeof language === 'string' && language.trim().length > 0 &&
        typeof slug === 'string' && slug.trim().length > 0;
};

const isSameTransitionTarget = (
    a: BlogTransitionTarget,
    b: BlogTransitionTarget
): boolean =>
    resolveTransitionTargetToken(a.language, 'lang') === resolveTransitionTargetToken(b.language, 'lang') &&
    resolveTransitionTargetToken(a.slug, 'post') === resolveTransitionTargetToken(b.slug, 'post');

export const isBlogTransitionTargetMatch = (
    a: BlogTransitionTarget | null | undefined,
    b: BlogTransitionTarget | null | undefined
): boolean => {
    if (!a || !b) return false;
    return isSameTransitionTarget(a, b);
};

export const createBlogTransitionNavigationState = (
    source: BlogTransitionSource,
    target: BlogTransitionTarget
): BlogTransitionNavigationState => ({
    blogTransitionSource: source,
    blogTransitionTarget: target,
});

export const getBlogTransitionNavigationState = (
    value: unknown
): BlogTransitionNavigationState | null => {
    if (!isRecord(value)) return null;
    const source = value.blogTransitionSource;
    const target = value.blogTransitionTarget;
    if (!isBlogTransitionSource(source) || !isValidBlogTransitionTarget(target)) {
        return null;
    }
    return {
        blogTransitionSource: source,
        blogTransitionTarget: target,
    };
};

export const resolveBlogTransitionNavigationHint = (
    value: unknown,
    activeTransitionTarget: BlogTransitionTarget | null | undefined
): BlogTransitionTarget | null => {
    const navigationState = getBlogTransitionNavigationState(value);
    if (!navigationState || navigationState.blogTransitionSource !== 'post' || !activeTransitionTarget) {
        return null;
    }

    return isBlogTransitionTargetMatch(navigationState.blogTransitionTarget, activeTransitionTarget)
        ? navigationState.blogTransitionTarget
        : null;
};

export const primeBlogTransitionSnapshot = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
    }
    void document.documentElement.getBoundingClientRect();
    if (document.body) {
        void document.body.getBoundingClientRect();
    }
};

export const setPendingBlogTransitionTarget = (target: BlogTransitionTarget | null): void => {
    pendingBlogTransitionTarget = target;
    if (!target) {
        pendingBlogTransitionMode = 'full';
    }
    notifyBlogTransitionStateChange();
};

export const getPendingBlogTransitionTarget = (): BlogTransitionTarget | null =>
    pendingBlogTransitionTarget;

export const isPendingBlogTransitionTarget = (
    language: string,
    slug: string
): boolean => {
    if (!pendingBlogTransitionTarget) return false;
    return isBlogTransitionTargetMatch(pendingBlogTransitionTarget, { language, slug });
};

export const shouldDelayBlogCardProgressiveBlurReveal = (
    isTransitionSource: boolean,
    isTransitionTarget: boolean
): boolean => !isTransitionSource && isTransitionTarget;

export const setCurrentBlogPostTransitionTarget = (
    target: BlogTransitionTarget | null
): void => {
    currentBlogPostTransitionTarget = target;
    if (target) {
        lastKnownBlogPostTransitionTarget = target;
    }
};

export const getCurrentBlogPostTransitionTarget = (): BlogTransitionTarget | null =>
    currentBlogPostTransitionTarget;

export const getLastKnownBlogPostTransitionTarget = (): BlogTransitionTarget | null =>
    lastKnownBlogPostTransitionTarget;

export const getBlogTransitionStateVersion = (): number =>
    blogTransitionStateVersion;

export const markBlogRouteKindSeen = (kind: SeenBlogRouteKind): void => {
    if (seenBlogRouteKinds.has(kind)) return;
    seenBlogRouteKinds.add(kind);
};

export const shouldUseColdBlogTransitionFallbackForKind = (
    kind: SeenBlogRouteKind
): boolean => supportsNestedBlogViewTransitionGroups() && !seenBlogRouteKinds.has(kind);

export const setPendingBlogTransitionMode = (
    mode: PendingBlogTransitionMode
): void => {
    pendingBlogTransitionMode = mode;
    notifyBlogTransitionStateChange();
};

export const shouldUseTitleOnlyBlogTransition = (
    language: string,
    slug: string
): boolean =>
    pendingBlogTransitionMode === 'title-only' &&
    isPendingBlogTransitionTarget(language, slug);

export const resetBlogTransitionWarmStateForTests = (): void => {
    seenBlogRouteKinds.clear();
    pendingBlogTransitionMode = 'full';
    pendingBlogTransitionTarget = null;
    currentBlogPostTransitionTarget = null;
    lastKnownBlogPostTransitionTarget = null;
    notifyBlogTransitionStateChange();
};

export const subscribeBlogTransitionState = (
    listener: () => void
): (() => void) => {
    blogTransitionStateListeners.add(listener);
    return () => {
        blogTransitionStateListeners.delete(listener);
    };
};

export const supportsBlogViewTransitions = (): boolean => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const viewTransitionDocument = document as ViewTransitionCapableDocument;
    if (typeof viewTransitionDocument.startViewTransition !== 'function') return false;
    if (typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const supportsBlogViewTransitionClasses = (): boolean =>
    supportsBlogViewTransitions() &&
    supportsCssFeature('view-transition-class: blog-card-transition') &&
    supportsCssFeature('selector(::view-transition-group(.blog-card-transition))');

const supportsNestedBlogViewTransitionGroups = (): boolean =>
    supportsBlogViewTransitionClasses() &&
    supportsCssFeature('view-transition-group: contain') &&
    supportsCssFeature('view-transition-group: nearest') &&
    supportsCssFeature('selector(::view-transition-group-children(blog-card-transition))');

export const getBlogTransitionStyle = (
    transitionName: string,
    transitionClass?: string,
    transitionGroup?: string
): CSSProperties =>
    ({
        viewTransitionName: transitionName,
        ...(transitionClass && supportsBlogViewTransitionClasses()
            ? { ['viewTransitionClass' as any]: transitionClass }
            : {}),
        ...(transitionGroup && supportsNestedBlogViewTransitionGroups()
            ? { ['viewTransitionGroup' as any]: transitionGroup }
            : {}),
    } as CSSProperties);

export const warmResponsiveBlogImage = ({
    src,
    sizes,
    srcSetWidths = [480, 768, 1024, 1536],
    disableCdn = false,
    fetchPriority = 'auto',
}: WarmResponsiveBlogImageOptions): void => {
    if (typeof window === 'undefined' || typeof Image === 'undefined' || !src) return;

    const key = JSON.stringify([src, sizes || '', srcSetWidths.join(','), disableCdn]);
    if (warmedResponsiveBlogImages.has(key)) return;

    const preloadImage = new Image();
    const lastWidth = srcSetWidths[srcSetWidths.length - 1];
    const srcSet = disableCdn
        ? ''
        : buildImageSrcSet(src, srcSetWidths, { quality: 66 });
    const resolvedSrc = disableCdn || !lastWidth
        ? src
        : buildImageCdnUrl(src, { width: lastWidth, quality: 66 });

    warmedResponsiveBlogImages.add(key);

    if (sizes) preloadImage.sizes = sizes;
    if (srcSet) preloadImage.srcset = srcSet;
    preloadImage.decoding = 'async';
    if ('fetchPriority' in preloadImage) {
        (preloadImage as HTMLImageElement & { fetchPriority?: 'high' | 'low' | 'auto' }).fetchPriority = fetchPriority;
    }

    const reset = () => {
        preloadImage.onload = null;
        preloadImage.onerror = null;
    };

    preloadImage.onload = reset;
    preloadImage.onerror = () => {
        warmedResponsiveBlogImages.delete(key);
        reset();
    };
    preloadImage.src = resolvedSrc;
};

export const getBlogRouteKindFromPath = (pathname: string): BlogRouteKind => {
    const match = pathname.match(BLOG_ROUTE_PATTERN);
    if (!match) return 'other';
    return match[1] ? 'post' : 'list';
};

export const isBlogListPath = (pathname: string): boolean =>
    getBlogRouteKindFromPath(pathname) === 'list';

export const isBlogRoutePath = (pathname: string): boolean =>
    getBlogRouteKindFromPath(pathname) !== 'other';

export const isBlogListDetailTransition = (
    fromPathname: string,
    toPathname: string
): boolean => {
    const fromKind = getBlogRouteKindFromPath(fromPathname);
    const toKind = getBlogRouteKindFromPath(toPathname);
    return (fromKind === 'list' && toKind === 'post') || (fromKind === 'post' && toKind === 'list');
};

export const getCurrentBlogRouteKindFromDom = (): Exclude<BlogRouteKind, 'other'> | null => {
    if (typeof document === 'undefined') return null;
    if (document.querySelector('[data-blog-route-kind="list"]')) return 'list';
    if (document.querySelector('[data-blog-route-kind="post"]')) return 'post';
    return null;
};

export interface PrimaryClickLikeEvent {
    altKey: boolean;
    button: number;
    ctrlKey: boolean;
    defaultPrevented: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}

export const isPrimaryUnmodifiedClick = (
    event: PrimaryClickLikeEvent
): boolean =>
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.defaultPrevented;

const startTransitionWithTypes = (
    viewTransitionDocument: ViewTransitionCapableDocument,
    startTransition: (value: unknown) => ViewTransitionWithFinished | undefined,
    update?: () => void | Promise<void>,
    type?: BlogViewTransitionType
): ViewTransitionWithFinished | undefined => {
    const updateCallback = () => update?.();

    if (!type) {
        return startTransition.call(viewTransitionDocument, updateCallback);
    }

    try {
        return startTransition.call(viewTransitionDocument, {
            update: updateCallback,
            types: [type],
        });
    } catch {
        const transition = startTransition.call(viewTransitionDocument, updateCallback);
        transition?.types?.add?.(type);
        return transition;
    }
};

const clearBlogTransitionState = (): void => {
    pendingBlogTransitionTarget = null;
    pendingBlogTransitionMode = 'full';
    notifyBlogTransitionStateChange();
};

export const startBlogViewTransition = ({
    update,
    type,
}: StartViewTransitionOptions = {}): void => {
    if (!supportsBlogViewTransitions()) {
        update?.();
        clearBlogTransitionState();
        return;
    }

    const viewTransitionDocument = document as ViewTransitionCapableDocument;
    const startTransition = viewTransitionDocument.startViewTransition as
        | ((value: unknown) => ViewTransitionWithFinished | undefined)
        | undefined;

    if (typeof startTransition !== 'function') {
        update?.();
        clearBlogTransitionState();
        return;
    }

    try {
        const transition = startTransitionWithTypes(viewTransitionDocument, startTransition, update, type);

        if (transition && typeof transition.finished?.finally === 'function') {
            void transition.finished.finally(() => {
                clearBlogTransitionState();
            });
            return;
        }

        clearBlogTransitionState();
    } catch {
        update?.();
        clearBlogTransitionState();
    }
};

export const startPreparedBlogViewTransition = async ({
    beforeTransition,
    prepare,
    update,
    type,
}: StartPreparedBlogViewTransitionOptions = {}): Promise<void> => {
    try {
        await prepare?.();
    } catch {
        // Ignore preload failures and rely on the navigation fallback behavior.
    }

    beforeTransition?.();
    startBlogViewTransition({ update, type });
};
