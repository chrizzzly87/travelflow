// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const route = vi.hoisted(() => ({ pending: false }));
vi.mock('@tanstack/react-router', () => ({ useRouterState: () => route.pending }));
import { RouteNavigationFeedback } from '../../app/routing/RouteNavigationFeedback';
afterEach(() => { cleanup(); vi.useRealTimers(); route.pending = false; });
describe('one-pass navigation progress', () => {
    it('grows without sliding, completes to full width, then hides and resets', () => {
        vi.useFakeTimers();
        const view = render(<RouteNavigationFeedback />);
        const bar = screen.getByTestId('route-navigation-progress');
        expect(bar).not.toHaveAttribute('data-visible');
        route.pending = true; view.rerender(<RouteNavigationFeedback />);
        expect(bar).toHaveAttribute('data-visible', 'true');
        expect(bar.firstElementChild).toHaveStyle({ transform: 'scaleX(0)' });
        act(() => { vi.advanceTimersByTime(250); });
        const first = Number((bar.firstElementChild as HTMLElement).dataset.progress);
        act(() => { vi.advanceTimersByTime(500); });
        expect(Number((bar.firstElementChild as HTMLElement).dataset.progress)).toBeGreaterThan(first);
        route.pending = false; view.rerender(<RouteNavigationFeedback />);
        expect(bar).toHaveAttribute('data-phase', 'complete');
        expect(bar.firstElementChild).toHaveStyle({ transform: 'scaleX(1)' });
        act(() => { vi.advanceTimersByTime(300); });
        expect(bar).not.toHaveAttribute('data-visible');
        expect(bar.firstElementChild).toHaveStyle({ transform: 'scaleX(1)' });
        route.pending = true; view.rerender(<RouteNavigationFeedback />);
        expect(bar.firstElementChild).toHaveStyle({ transform: 'scaleX(0)' });
    });
    it('cancels completion cleanup when a new navigation begins and releases timers on unmount', () => {
        vi.useFakeTimers(); route.pending = true;
        const view = render(<RouteNavigationFeedback />);
        act(() => { vi.advanceTimersByTime(250); });
        route.pending = false; view.rerender(<RouteNavigationFeedback />);
        route.pending = true; view.rerender(<RouteNavigationFeedback />);
        act(() => { vi.advanceTimersByTime(350); });
        expect(screen.getByTestId('route-navigation-progress')).toHaveAttribute('data-phase', 'loading');
        view.unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
