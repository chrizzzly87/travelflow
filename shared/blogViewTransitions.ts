type BlogViewTransitionPart = 'card' | 'image' | 'title';
type BlogRouteKind = 'list' | 'post' | 'other';

const BLOG_VIEW_TRANSITION_PREFIX = 'blog-post';
const BLOG_ROUTE_PATTERN = /^\/(?:[a-z]{2}\/)?blog(?:\/([^/?#]+))?\/?$/i;

export const BLOG_VIEW_TRANSITION_DURATION = '420ms';

export interface BlogTransitionTarget {
    language: string;
    slug: string;
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

let pendingBlogTransitionTarget: BlogTransitionTarget | null = null;
let currentBlogPostTransitionTarget: BlogTransitionTarget | null = null;
let lastKnownBlogPostTransitionTarget: BlogTransitionTarget | null = null;
let blogTransitionStateVersion = 0;
const blogTransitionStateListeners = new Set<() => void>();

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
    blogTransitionStateVersion += 1;
    blogTransitionStateListeners.forEach((listener) => listener());
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
    blogTransitionStateVersion += 1;
    blogTransitionStateListeners.forEach((listener) => listener());
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
