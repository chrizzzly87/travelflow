type BlogViewTransitionPart = 'card' | 'image' | 'title' | 'summary' | 'meta' | 'pills';
type BlogRouteKind = 'list' | 'post' | 'other';

const BLOG_VIEW_TRANSITION_PREFIX = 'blog-post';
const BLOG_ROUTE_PATTERN = /^\/(?:[a-z]{2}\/)?blog(?:\/([^/?#]+))?\/?$/i;
const BLOG_VIEW_TRANSITION_STYLE_ID = 'blog-view-transition-active';

export interface BlogTransitionTarget {
    language: string;
    slug: string;
}

export type BlogTransitionSource = 'list' | 'post';

export interface BlogTransitionNavigationState {
    blogTransitionSource: BlogTransitionSource;
    blogTransitionTarget: BlogTransitionTarget;
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
    summary: string;
    meta: string;
    pills: string;
}

export const BLOG_VIEW_TRANSITION_CLASSES = {
    card: 'blog-card-transition',
    image: 'blog-image-transition',
    title: 'blog-title-transition',
    summary: 'blog-summary-transition',
    meta: 'blog-meta-transition',
    pills: 'blog-pills-transition',
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
    summary: buildBlogPostViewTransitionName('summary', language, slug),
    meta: buildBlogPostViewTransitionName('meta', language, slug),
    pills: buildBlogPostViewTransitionName('pills', language, slug),
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

const buildScopedBlogTransitionStyles = (target: BlogTransitionTarget): string => {
    const names = getBlogPostViewTransitionNames(target.language, target.slug);
    return `
::view-transition-group(${names.card}),
::view-transition-group(${names.image}),
::view-transition-group(${names.title}),
::view-transition-group(${names.summary}),
::view-transition-group(${names.meta}),
::view-transition-group(${names.pills}) {
  animation-duration: 2s;
  animation-timing-function: cubic-bezier(0.22, 0.82, 0.24, 1);
}

::view-transition-old(${names.card}),
::view-transition-new(${names.card}),
::view-transition-old(${names.image}),
::view-transition-new(${names.image}),
::view-transition-old(${names.title}),
::view-transition-new(${names.title}),
::view-transition-old(${names.summary}),
::view-transition-new(${names.summary}),
::view-transition-old(${names.meta}),
::view-transition-new(${names.meta}),
::view-transition-old(${names.pills}),
::view-transition-new(${names.pills}) {
  mix-blend-mode: normal;
}

::view-transition-old(${names.card}),
::view-transition-old(${names.image}),
::view-transition-old(${names.title}),
::view-transition-old(${names.summary}),
::view-transition-old(${names.meta}),
::view-transition-old(${names.pills}) {
  z-index: 1;
}

::view-transition-new(${names.card}),
::view-transition-new(${names.image}),
::view-transition-new(${names.title}),
::view-transition-new(${names.summary}),
::view-transition-new(${names.meta}),
::view-transition-new(${names.pills}) {
  z-index: 2;
}

::view-transition-old(${names.card}),
::view-transition-new(${names.card}) {
  transform-origin: center top;
}

::view-transition-old(${names.image}),
::view-transition-new(${names.image}) {
  transform-origin: center center;
  overflow: clip;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

::view-transition-old(${names.title}),
::view-transition-new(${names.title}),
::view-transition-old(${names.summary}),
::view-transition-new(${names.summary}),
::view-transition-old(${names.meta}),
::view-transition-new(${names.meta}),
::view-transition-old(${names.pills}),
::view-transition-new(${names.pills}) {
  transform-origin: left top;
}

::view-transition-old(${names.title}),
::view-transition-new(${names.title}) {
  font-synthesis: none;
}

::view-transition-old(${names.card}) {
  animation: vt-blog-card-old 2s cubic-bezier(0.36, 0, 0.24, 1) both;
}

::view-transition-new(${names.card}) {
  animation: vt-blog-card-new 2s cubic-bezier(0.18, 0.9, 0.22, 1) both;
}

::view-transition-old(${names.image}) {
  animation: vt-blog-image-old 2s cubic-bezier(0.32, 0, 0.2, 1) both;
}

::view-transition-new(${names.image}) {
  animation: vt-blog-image-new 2s cubic-bezier(0.16, 0.86, 0.22, 1) both;
}

::view-transition-old(${names.title}) {
  animation: vt-blog-title-old 2s cubic-bezier(0.3, 0, 0.2, 1) both;
}

::view-transition-new(${names.title}) {
  animation: vt-blog-title-new 2s cubic-bezier(0.18, 0.9, 0.24, 1) both;
}

::view-transition-old(${names.summary}) {
  animation: vt-blog-summary-old 2s cubic-bezier(0.28, 0, 0.2, 1) both;
}

::view-transition-new(${names.summary}) {
  animation: vt-blog-summary-new 2s cubic-bezier(0.18, 0.88, 0.24, 1) both;
}

::view-transition-old(${names.meta}) {
  animation: vt-blog-meta-old 2s cubic-bezier(0.28, 0, 0.2, 1) both;
}

::view-transition-new(${names.meta}) {
  animation: vt-blog-meta-new 2s cubic-bezier(0.18, 0.88, 0.24, 1) both;
}

::view-transition-old(${names.pills}) {
  animation: vt-blog-pills-old 2s cubic-bezier(0.28, 0, 0.2, 1) both;
}

::view-transition-new(${names.pills}) {
  animation: vt-blog-pills-new 2s cubic-bezier(0.18, 0.88, 0.24, 1) both;
}
`;
};

const applyScopedBlogTransitionStyles = (): void => {
    if (typeof document === 'undefined') return;
    if (!pendingBlogTransitionTarget) return;

    const existingStyle = document.getElementById(BLOG_VIEW_TRANSITION_STYLE_ID) as HTMLStyleElement | null;
    const styleElement = existingStyle ?? document.createElement('style');
    styleElement.id = BLOG_VIEW_TRANSITION_STYLE_ID;
    styleElement.textContent = buildScopedBlogTransitionStyles(pendingBlogTransitionTarget);
    if (!existingStyle) {
        document.head.appendChild(styleElement);
    }
};

const clearScopedBlogTransitionState = (): void => {
    pendingBlogTransitionTarget = null;
    blogTransitionStateVersion += 1;
    blogTransitionStateListeners.forEach((listener) => listener());
    if (typeof document === 'undefined') return;
    const styleElement = document.getElementById(BLOG_VIEW_TRANSITION_STYLE_ID);
    styleElement?.remove();
};

type ViewTransitionCapableDocument = Document & {
    startViewTransition?: unknown;
};

export const supportsBlogViewTransitions = (): boolean => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const viewTransitionDocument = document as ViewTransitionCapableDocument;
    if (typeof viewTransitionDocument.startViewTransition !== 'function') return false;
    if (typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const resolveBlogRouteKind = (pathname: string): BlogRouteKind => {
    const match = pathname.match(BLOG_ROUTE_PATTERN);
    if (!match) return 'other';
    return match[1] ? 'post' : 'list';
};

export const isBlogListPath = (pathname: string): boolean =>
    resolveBlogRouteKind(pathname) === 'list';

export const isBlogRoutePath = (pathname: string): boolean =>
    resolveBlogRouteKind(pathname) !== 'other';

export const isBlogListDetailTransition = (
    fromPathname: string,
    toPathname: string
): boolean => {
    const fromKind = resolveBlogRouteKind(fromPathname);
    const toKind = resolveBlogRouteKind(toPathname);
    return (fromKind === 'list' && toKind === 'post') || (fromKind === 'post' && toKind === 'list');
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

const hasTransitionElement = (transitionName: string): boolean => {
    if (typeof document === 'undefined') return false;
    const elements = document.querySelectorAll<HTMLElement>('*');
    for (const element of elements) {
        if (element.style?.viewTransitionName === transitionName) {
            return true;
        }
    }
    return false;
};

const hasRouteMarker = (kind: Exclude<BlogRouteKind, 'other'>): boolean => {
    if (typeof document === 'undefined') return false;
    return !!document.querySelector(`[data-blog-route-kind="${kind}"]`);
};

const hasReadyTransitionTarget = (
    target: BlogTransitionTarget,
    expectedRouteKind?: Exclude<BlogRouteKind, 'other'>
): boolean => {
    const names = getBlogPostViewTransitionNames(target.language, target.slug);
    // Keep readiness strict on the key moving pieces, but don't block on the decorative card shell.
    const requiredNames = [names.image, names.title];
    const routeReady = expectedRouteKind ? hasRouteMarker(expectedRouteKind) : true;
    return routeReady && requiredNames.every((name) => hasTransitionElement(name));
};

export const waitForBlogTransitionTarget = async (
    target: BlogTransitionTarget,
    expectedRouteKind?: Exclude<BlogRouteKind, 'other'>,
    timeoutMs = 320
): Promise<void> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    await new Promise<void>((resolve) => {
        const settleAndResolve = () => {
            const fontSet = (document as Document & { fonts?: { status?: string; ready?: Promise<unknown> } }).fonts;
            const maybeReady = fontSet?.ready;
            if (fontSet?.status === 'loading' && maybeReady && typeof maybeReady.then === 'function') {
                void Promise.race([
                    maybeReady,
                    new Promise<void>((fontResolve) => window.setTimeout(fontResolve, 180)),
                ]).finally(() => {
                    window.requestAnimationFrame(() => {
                        window.requestAnimationFrame(() => {
                            resolve();
                        });
                    });
                });
                return;
            }

            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    resolve();
                });
            });
        };

        const tick = () => {
            if (hasReadyTransitionTarget(target, expectedRouteKind)) {
                settleAndResolve();
                return;
            }

            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (now - startedAt >= timeoutMs) {
                resolve();
                return;
            }

            window.requestAnimationFrame(tick);
        };

        tick();
    });
};

export const startBlogViewTransition = (applyUpdate?: () => void | Promise<void>): void => {
    if (!supportsBlogViewTransitions()) {
        applyUpdate?.();
        clearScopedBlogTransitionState();
        return;
    }
    const viewTransitionDocument = document as ViewTransitionCapableDocument;
    const startTransition = viewTransitionDocument.startViewTransition as
        | ((updateCallback: () => void | Promise<void>) => {
            finished?: Promise<unknown>;
        })
        | undefined;

    if (typeof startTransition !== 'function') {
        applyUpdate?.();
        clearScopedBlogTransitionState();
        return;
    }

    applyScopedBlogTransitionStyles();

    try {
        const transition = startTransition.call(viewTransitionDocument, () => {
            return applyUpdate?.();
        });

        if (transition && typeof transition.finished?.finally === 'function') {
            void transition.finished.finally(() => {
                clearScopedBlogTransitionState();
            });
            return;
        }

        clearScopedBlogTransitionState();
    } catch {
        applyUpdate?.();
        clearScopedBlogTransitionState();
    }
};
