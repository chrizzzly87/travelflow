// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  clearHoverIntentTimer: vi.fn(),
  isNavPrefetchEnabled: vi.fn(() => true),
  publishPrefetchStats: vi.fn(),
  scheduleHoverIntentWarmup: vi.fn(),
  scheduleIdleWarmups: vi.fn(),
  warmRouteAssets: vi.fn(),
}));

vi.mock('../../../services/navigationPrefetch', () => ({
  clearHoverIntentTimer: mocks.clearHoverIntentTimer,
  isNavPrefetchEnabled: mocks.isNavPrefetchEnabled,
  PREFETCH_LINK_HIGHLIGHT_DEBUG_EVENT: 'tf:prefetch-link-highlight-debug',
  publishPrefetchStats: mocks.publishPrefetchStats,
  scheduleHoverIntentWarmup: mocks.scheduleHoverIntentWarmup,
  scheduleIdleWarmups: mocks.scheduleIdleWarmups,
  warmRouteAssets: mocks.warmRouteAssets,
}));

const marketingRouteShellStateMocks = vi.hoisted(() => ({
  hasCompletedInitialRouteHandoff: vi.fn(() => false),
}));

vi.mock('../../../services/marketingRouteShellState', () => ({
  hasCompletedInitialRouteHandoff: marketingRouteShellStateMocks.hasCompletedInitialRouteHandoff,
}));

import { NavigationPrefetchManager } from '../../../components/NavigationPrefetchManager';

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MockMutationObserver {
  observe() {}
  disconnect() {}
}

describe('components/NavigationPrefetchManager', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    marketingRouteShellStateMocks.hasCompletedInitialRouteHandoff.mockReturnValue(false);
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('MutationObserver', MockMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderAtPath = (path: string, href = '/create-trip', label = 'Create Trip') => {
    window.history.replaceState({}, '', path);
    return render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(NavigationPrefetchManager),
        React.createElement('a', { href }, label)
      )
    );
  };

  it('keeps pointerdown warmups enabled on first-load-critical homepage visits', () => {
    renderAtPath('/');

    fireEvent.pointerDown(screen.getByRole('link', { name: 'Create Trip' }));

    expect(mocks.warmRouteAssets).toHaveBeenCalledWith('/create-trip', 'pointerdown');
    expect(mocks.publishPrefetchStats).toHaveBeenCalled();
  });

  it('still suppresses passive hover warmups on first-load-critical homepage visits', () => {
    renderAtPath('/');

    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Create Trip' }));

    expect(mocks.scheduleHoverIntentWarmup).not.toHaveBeenCalled();
  });

  it('re-enables passive hover warmups on critical routes after the initial handoff completes', () => {
    marketingRouteShellStateMocks.hasCompletedInitialRouteHandoff.mockReturnValue(true);

    renderAtPath('/create-trip', '/pricing', 'Pricing');

    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Pricing' }));

    expect(mocks.scheduleHoverIntentWarmup).toHaveBeenCalled();
  });
});
