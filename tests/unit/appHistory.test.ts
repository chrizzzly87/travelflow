// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const blogTransitionMocks = vi.hoisted(() => ({
    getCurrentBlogPostTransitionTarget: vi.fn(),
    getLastKnownBlogPostTransitionTarget: vi.fn(),
    getBlogRouteKindFromPath: vi.fn(),
    isBlogListDetailTransition: vi.fn(),
    setPendingBlogTransitionTarget: vi.fn(),
    startBlogViewTransition: vi.fn(),
    supportsBlogViewTransitions: vi.fn(),
}));

const reactDomMocks = vi.hoisted(() => ({
    flushSync: vi.fn((callback: () => void) => callback()),
}));

vi.mock('react-dom', () => ({
    flushSync: reactDomMocks.flushSync,
}));

vi.mock('../../shared/blogViewTransitions', () => ({
    getCurrentBlogPostTransitionTarget: blogTransitionMocks.getCurrentBlogPostTransitionTarget,
    getLastKnownBlogPostTransitionTarget: blogTransitionMocks.getLastKnownBlogPostTransitionTarget,
    getBlogRouteKindFromPath: blogTransitionMocks.getBlogRouteKindFromPath,
    isBlogListDetailTransition: blogTransitionMocks.isBlogListDetailTransition,
    setPendingBlogTransitionTarget: blogTransitionMocks.setPendingBlogTransitionTarget,
    startBlogViewTransition: blogTransitionMocks.startBlogViewTransition,
    supportsBlogViewTransitions: blogTransitionMocks.supportsBlogViewTransitions,
}));

import { createBlogTransitionAwareBrowserHistory } from '../../shared/appHistory';

interface FakeHistoryUpdate {
    action: string;
    location: {
        pathname: string;
    };
}

interface FakeHistory {
    action: string;
    location: {
        pathname: string;
    };
    listen: (listener: (update: FakeHistoryUpdate) => void) => () => void;
    createHref: (to: string) => string;
    push: (to: string) => void;
    replace: (to: string) => void;
    go: (delta: number) => void;
}

const createFakeHistory = (
    pathname: string
): FakeHistory & {
    emit: (update: FakeHistoryUpdate) => void;
} => {
    let listener: ((update: FakeHistoryUpdate) => void) | null = null;

    return {
        action: 'POP',
        location: { pathname },
        listen: (nextListener) => {
            listener = nextListener;
            return () => {
                listener = null;
            };
        },
        createHref: (to) => to,
        go: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
        emit: (update) => {
            listener?.(update);
        },
    };
};

describe('shared/appHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        blogTransitionMocks.supportsBlogViewTransitions.mockReturnValue(true);
        blogTransitionMocks.isBlogListDetailTransition.mockReturnValue(true);
        blogTransitionMocks.getBlogRouteKindFromPath.mockReturnValue('list');
    });

    it('wraps POP blog list/detail updates in a view transition and commits inside flushSync', () => {
        const fakeHistory = createFakeHistory('/blog/how-to-plan-multi-city-trip');
        const wrappedHistory = createBlogTransitionAwareBrowserHistory(fakeHistory as never);
        const listener = vi.fn();

        blogTransitionMocks.getCurrentBlogPostTransitionTarget.mockReturnValue({
            language: 'en',
            slug: 'how-to-plan-multi-city-trip',
        });
        blogTransitionMocks.getBlogRouteKindFromPath.mockReturnValue('list');

        wrappedHistory.listen(listener);
        fakeHistory.emit({
            action: 'POP',
            location: { pathname: '/blog' },
        });

        expect(blogTransitionMocks.setPendingBlogTransitionTarget).toHaveBeenCalledWith({
            language: 'en',
            slug: 'how-to-plan-multi-city-trip',
        });
        expect(blogTransitionMocks.startBlogViewTransition).toHaveBeenCalledTimes(1);

        const options = blogTransitionMocks.startBlogViewTransition.mock.calls[0][0] as {
            type: string;
            update: () => void;
        };
        expect(options.type).toBe('blog-collapse');

        options.update();
        expect(reactDomMocks.flushSync).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({
            action: 'POP',
            location: { pathname: '/blog' },
        });
    });

    it('passes through non-POP updates without starting a transition', () => {
        const fakeHistory = createFakeHistory('/blog');
        const wrappedHistory = createBlogTransitionAwareBrowserHistory(fakeHistory as never);
        const listener = vi.fn();

        wrappedHistory.listen(listener);
        fakeHistory.emit({
            action: 'PUSH',
            location: { pathname: '/blog/how-to-plan-multi-city-trip' },
        });

        expect(blogTransitionMocks.startBlogViewTransition).not.toHaveBeenCalled();
        expect(reactDomMocks.flushSync).not.toHaveBeenCalled();
        expect(listener).toHaveBeenCalledWith({
            action: 'PUSH',
            location: { pathname: '/blog/how-to-plan-multi-city-trip' },
        });
    });
});
