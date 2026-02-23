type BlogViewTransitionPart = 'card' | 'image' | 'title';
type BlogRouteKind = 'list' | 'post' | 'other';

const BLOG_VIEW_TRANSITION_PREFIX = 'blog-post';
const BLOG_ROUTE_PATTERN = /^\/(?:[a-z]{2}\/)?blog(?:\/([^/?#]+))?\/?$/i;
const BLOG_VIEW_TRANSITION_STYLE_ID = 'blog-view-transition-active';
const BLOG_VIEW_TRANSITION_DURATION = '350ms';

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
    content?: string;
}

export const BLOG_VIEW_TRANSITION_CLASSES = {
    card: 'blog-card-transition',
    image: 'blog-image-transition',
    title: 'blog-title-transition',
    content: 'blog-content-transition',
} as const;

let pendingBlogTransitionTarget: BlogTransitionTarget | null = null;
let currentBlogPostTransitionTarget: BlogTransitionTarget | null = null;
let lastKnownBlogPostTransitionTarget: BlogTransitionTarget | null = null;
let blogTransitionStateVersion = 0;
let isFirstBlogTransition = true;
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

export const getIsFirstBlogTransition = (): boolean => isFirstBlogTransition;

export const subscribeBlogTransitionState = (
    listener: () => void
): (() => void) => {
    blogTransitionStateListeners.add(listener);
    return () => {
        blogTransitionStateListeners.delete(listener);
    };
};

const buildScopedBlogTransitionStyles = (target: BlogTransitionTarget, direction: 'list-to-post' | 'post-to-list'): string => {
    const names = getBlogPostViewTransitionNames(target.language, target.slug);
    
    const isListToPost = direction === 'list-to-post';
    const imageIsolationCSS = isListToPost ? `
/* List -> Post: hide the incoming slow-loading small thumb, show the new big image */
::view-transition-old(${names.image}) { display: none !important; }
::view-transition-new(${names.image}) { 
  animation: none !important; 
  opacity: 1 !important; 
  mix-blend-mode: normal !important; 
}
` : `
/* Post -> List: hide the incoming small thumb, hold onto the fading big old image */
::view-transition-old(${names.image}) { 
  animation: none !important; 
  opacity: 1 !important; 
  mix-blend-mode: normal !important; 
}
::view-transition-new(${names.image}) { display: none !important; }
`;

    return `
::view-transition-group(${names.card}),
::view-transition-group(${names.image}),
::view-transition-group(${names.title}) {
  animation-duration: ${BLOG_VIEW_TRANSITION_DURATION};
  animation-timing-function: cubic-bezier(0.22, 0.82, 0.24, 1);
}

::view-transition-group(${names.card}) { z-index: 10 !important; }
::view-transition-group(${names.image}) { z-index: 20 !important; }
::view-transition-group(${names.title}) { z-index: 30 !important; }

::view-transition-old(${names.image}) img[src^="data:image/"],
::view-transition-new(${names.image}) img[src^="data:image/"] { 
  opacity: 0 !important; 
  visibility: hidden !important; 
}

${names.content ? `
::view-transition-group(${names.content}) { z-index: 15 !important; }
::view-transition-old(${names.content}),
::view-transition-new(${names.content}) {
  animation-duration: ${BLOG_VIEW_TRANSITION_DURATION};
  animation-timing-function: cubic-bezier(0.22, 0.82, 0.24, 1);
  mix-blend-mode: normal;
}
::view-transition-old(${names.content}) { z-index: 1 !important; }
::view-transition-new(${names.content}) { z-index: 3 !important; }
` : ''}

::view-transition-old(${names.card}),
::view-transition-new(${names.card}) {
  mix-blend-mode: normal;
}

::view-transition-old(${names.card}),
::view-transition-old(${names.title}) {
  z-index: 1;
}

::view-transition-old(${names.image}) {
  z-index: 2;
}

::view-transition-new(${names.card}),
::view-transition-new(${names.title}) {
  z-index: 2;
}

::view-transition-new(${names.image}) {
  z-index: 10;
}

::view-transition-old(${names.card}),
::view-transition-new(${names.card}) {
  transform-origin: center top;
}

::view-transition-old(${names.image}),
::view-transition-new(${names.image}) {
  transform-origin: center center;
  border-radius: 1rem;
  height: 100%;
  width: 100%;
  object-fit: cover;
  object-position: center;
  overflow: hidden !important;
}

::view-transition-old(${names.title}),
::view-transition-new(${names.title}) {
  transform-origin: left top;
  font-synthesis: none;
}

${imageIsolationCSS}
`;
};

const applyScopedBlogTransitionStyles = (direction: 'list-to-post' | 'post-to-list'): void => {
    if (typeof document === 'undefined') return;
    if (!pendingBlogTransitionTarget) return;

    const existingStyle = document.getElementById(BLOG_VIEW_TRANSITION_STYLE_ID) as HTMLStyleElement | null;
    const styleElement = existingStyle ?? document.createElement('style');
    styleElement.id = BLOG_VIEW_TRANSITION_STYLE_ID;
    styleElement.textContent = buildScopedBlogTransitionStyles(pendingBlogTransitionTarget, direction);
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
            const finish = () => {
                window.setTimeout(() => {
                    resolve();
                }, 10);
            };

            const checkImageAndFinish = () => {
                const names = getBlogPostViewTransitionNames(target.language, target.slug);
                const container = document.querySelector(`[style*="${names.image}"]`);
                const img = container?.tagName === 'IMG' ? container : container?.querySelector('img:not([aria-hidden="true"])');
                
                const ensureOpacity = () => {
                    // Also wait for React to actually apply the opacity-100 class after load
                    if (img && img.classList.contains('opacity-0')) {
                        window.requestAnimationFrame(ensureOpacity);
                        return;
                    }
                    finish();
                };

                if (img instanceof HTMLImageElement && typeof img.decode === 'function') {
                    void img.decode().catch(() => {}).finally(ensureOpacity);
                    return;
                }
                ensureOpacity();
            };

            const fontSet = (document as Document & { fonts?: { status?: string; ready?: Promise<unknown> } }).fonts;
            const maybeReady = fontSet?.ready;

            if (fontSet?.status === 'loading' && maybeReady && typeof maybeReady.then === 'function') {
                void Promise.race([
                    maybeReady,
                    new Promise<void>((fontResolve) => window.setTimeout(fontResolve, isFirstBlogTransition ? 400 : 180)),
                ]).finally(checkImageAndFinish);
                return;
            }

            checkImageAndFinish();
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

            window.setTimeout(tick, 10);
        };

        tick();
    });
};

export const startBlogViewTransition = (
    applyUpdate?: () => void | Promise<void>,
    sourcePathnameOverride?: string
): void => {
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

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    const sourceKind = resolveBlogRouteKind(sourcePathnameOverride || currentPath);
    const direction = sourceKind === 'list' ? 'list-to-post' : 'post-to-list';
    applyScopedBlogTransitionStyles(direction);

    try {
        const transition = startTransition.call(viewTransitionDocument, () => {
            return applyUpdate?.();
        });

        if (transition && typeof transition.finished?.finally === 'function') {
            void transition.finished.finally(() => {
                isFirstBlogTransition = false;
                clearScopedBlogTransitionState();
            });
            return;
        }

        isFirstBlogTransition = false;
        clearScopedBlogTransitionState();
    } catch {
        isFirstBlogTransition = false;
        applyUpdate?.();
        clearScopedBlogTransitionState();
    }
};
