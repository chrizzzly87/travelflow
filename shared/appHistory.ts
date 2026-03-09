import { flushSync } from 'react-dom';
import { UNSAFE_createBrowserHistory } from 'react-router-dom';
import {
    getCurrentBlogPostTransitionTarget,
    getBlogRouteKindFromPath,
    getLastKnownBlogPostTransitionTarget,
    isBlogListDetailTransition,
    setPendingBlogTransitionMode,
    setPendingBlogTransitionTarget,
    shouldUseColdBlogTransitionFallbackForKind,
    startBlogViewTransition,
    supportsBlogViewTransitions,
    type BlogViewTransitionType,
} from './blogViewTransitions';

type AppBrowserHistory = ReturnType<typeof UNSAFE_createBrowserHistory>;
type HistoryListener = Parameters<AppBrowserHistory['listen']>[0];
type HistoryUpdate = Parameters<HistoryListener>[0];

const wrapHistoryListenerWithBlogTransitions = (
    listener: HistoryListener,
    fromPathname: string,
    update: HistoryUpdate
): void => {
    const toPathname = update.location.pathname;
    const currentTarget = getCurrentBlogPostTransitionTarget() ?? getLastKnownBlogPostTransitionTarget();

    if (
        String(update.action).toUpperCase() !== 'POP' ||
        !supportsBlogViewTransitions() ||
        !currentTarget ||
        !isBlogListDetailTransition(fromPathname, toPathname)
    ) {
        listener(update);
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
        update: () => {
            flushSync(() => {
                listener(update);
            });
        },
    });
};

export const createBlogTransitionAwareBrowserHistory = (
    history: AppBrowserHistory = UNSAFE_createBrowserHistory({ v5Compat: true })
): AppBrowserHistory => {
    let previousPathname = history.location.pathname;

    return new Proxy(history, {
        get(target, prop, receiver) {
            if (prop === 'listen') {
                return (listener: HistoryListener) =>
                    target.listen((update: HistoryUpdate) => {
                        const fromPathname = previousPathname;
                        previousPathname = update.location.pathname;
                        wrapHistoryListenerWithBlogTransitions(listener, fromPathname, update);
                    });
            }

            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    }) as AppBrowserHistory;
};

export const appHistory = createBlogTransitionAwareBrowserHistory();
