// @vitest-environment jsdom
import React from 'react';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
  },
  pendingModules: new Set<string>(),
}));

vi.mock('../../../services/lazyImportRecovery', () => ({
  loadLazyComponentWithRecovery: (moduleKey: string, importer: () => Promise<unknown>) => {
    if (mocks.pendingModules.has(moduleKey)) {
      return new Promise(() => {});
    }
    return importer();
  },
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../../pages/ProfilePage', () => ({
  ProfilePage: () => React.createElement('div', { 'data-testid': 'mock-profile-page' }, 'Profile page'),
}));

vi.mock('../../../pages/ProfileStampsPage', () => ({
  ProfileStampsPage: () => React.createElement('div', { 'data-testid': 'mock-profile-stamps-page' }, 'Profile stamps page'),
}));

vi.mock('../../../pages/PublicProfilePage', () => ({
  PublicProfilePage: () => React.createElement('div', { 'data-testid': 'mock-public-profile-page' }, 'Public profile page'),
}));

vi.mock('../../../pages/PublicProfileStampsPage', () => ({
  PublicProfileStampsPage: () => React.createElement('div', { 'data-testid': 'mock-public-profile-stamps-page' }, 'Public profile stamps page'),
}));

vi.mock('../../../pages/PricingPage', () => ({
  PricingPage: () => React.createElement('div', { 'data-testid': 'mock-pricing-page' }, 'Pricing page'),
}));

vi.mock('../../../pages/MarketingHomePage', () => ({
  MarketingHomePage: () => React.createElement('div', { 'data-testid': 'mock-marketing-home-page' }, 'Marketing home page'),
}));

import { DeferredAppRoutes } from '../../../app/routes/DeferredAppRoutes';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('div', { 'data-testid': 'location-probe' }, `${location.pathname}${location.search}`);
};

const createDeferredRoutesElement = (initialPath: string) =>
  React.createElement(
    MemoryRouter,
    { initialEntries: [initialPath] },
    React.createElement(DeferredAppRoutes, {
      onAppLanguageLoaded: vi.fn(),
      onTripGenerated: vi.fn(),
      onOpenManager: vi.fn(),
    }),
    React.createElement(LocationProbe)
  );

const renderDeferredRoutes = (initialPath: string) => {
  return render(createDeferredRoutesElement(initialPath));
};

describe('app/routes/DeferredAppRoutes root auth gate', () => {
  beforeEach(() => {
    cleanup();
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    mocks.pendingModules.clear();
  });

  afterEach(() => {
    mocks.pendingModules.clear();
  });

  it('redirects authenticated users from root to /profile', async () => {
    mocks.auth.isAuthenticated = true;

    const { getByTestId } = renderDeferredRoutes('/');

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/profile');
    });
  });

  it('redirects authenticated users from localized root to /profile', async () => {
    mocks.auth.isAuthenticated = true;

    const { getByTestId } = renderDeferredRoutes('/de');

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/profile');
    });
  });

  it('renders the marketing homepage immediately while auth bootstrap is pending (anonymous)', async () => {
    mocks.auth.isLoading = true;
    mocks.auth.isAuthenticated = false;

    const { getByTestId, queryByTestId } = renderDeferredRoutes('/');

    await waitFor(() => {
      expect(getByTestId('mock-marketing-home-page')).toBeInTheDocument();
    });
    expect(getByTestId('location-probe').textContent).toBe('/');
    expect(queryByTestId('route-loading-shell')).toBeNull();
  });

  it('holds a non-suspending shell for hint-authenticated visitors, then redirects to /profile once auth settles', async () => {
    mocks.auth.isLoading = true;
    mocks.auth.isAuthenticated = true;

    const { getByTestId, queryByTestId, rerender } = renderDeferredRoutes('/');

    const shell = getByTestId('route-loading-shell');
    expect(getByTestId('location-probe').textContent).toBe('/');
    expect(shell).toHaveAttribute('data-shell-variant', 'marketing');
    expect(queryByTestId('mock-marketing-home-page')).toBeNull();

    mocks.auth.isLoading = false;
    rerender(createDeferredRoutesElement('/'));

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/profile');
    });
  });

  it('falls back to the marketing homepage when a stale auth hint settles as anonymous', async () => {
    mocks.auth.isLoading = true;
    mocks.auth.isAuthenticated = true;

    const { getByTestId, queryByTestId, rerender } = renderDeferredRoutes('/');

    expect(getByTestId('route-loading-shell')).toBeInTheDocument();

    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
    rerender(createDeferredRoutesElement('/'));

    await waitFor(() => {
      expect(getByTestId('mock-marketing-home-page')).toBeInTheDocument();
    });
    expect(getByTestId('location-probe').textContent).toBe('/');
    expect(queryByTestId('route-loading-shell')).toBeNull();
  });

  it('supports public profile routes', async () => {
    const { getByTestId } = renderDeferredRoutes('/u/traveler');

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/u/traveler');
    });
  });

  it('keeps public profile routes eager even when their old lazy key is marked pending', async () => {
    mocks.pendingModules.add('PublicProfilePage');

    const { getByTestId, queryByTestId } = renderDeferredRoutes('/u/traveler');

    await waitFor(() => {
      expect(getByTestId('mock-public-profile-page')).toBeInTheDocument();
    });
    expect(getByTestId('location-probe').textContent).toBe('/u/traveler');
    expect(queryByTestId('route-loading-shell')).toBeNull();
  });

  it('supports public profile stamps routes', async () => {
    const { getByTestId } = renderDeferredRoutes('/u/traveler/stamps');

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/u/traveler/stamps');
    });
  });

  it('keeps public profile stamps routes eager even when their old lazy key is marked pending', async () => {
    mocks.pendingModules.add('PublicProfileStampsPage');

    const { getByTestId, queryByTestId } = renderDeferredRoutes('/u/traveler/stamps');

    await waitFor(() => {
      expect(getByTestId('mock-public-profile-stamps-page')).toBeInTheDocument();
    });
    expect(getByTestId('location-probe').textContent).toBe('/u/traveler/stamps');
    expect(queryByTestId('route-loading-shell')).toBeNull();
  });

  it('supports profile stamps route for authenticated users', async () => {
    mocks.auth.isAuthenticated = true;

    const { getByTestId } = renderDeferredRoutes('/profile/stamps');

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/profile/stamps');
    });
  });

  it('lets a parent suspense boundary handle pending deferred routes when wrapInSuspense is disabled', () => {
    mocks.pendingModules.add('PricingPage');

    const { getByTestId, queryByTestId } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/pricing'] },
        React.createElement(
          Suspense,
          { fallback: React.createElement('div', { 'data-testid': 'outer-route-fallback' }, 'Outer fallback') },
          React.createElement(DeferredAppRoutes, {
            wrapInSuspense: false,
            onAppLanguageLoaded: vi.fn(),
            onTripGenerated: vi.fn(),
            onOpenManager: vi.fn(),
          })
        ),
        React.createElement(LocationProbe)
      )
    );

    expect(getByTestId('location-probe').textContent).toBe('/pricing');
    expect(getByTestId('outer-route-fallback').textContent).toBe('Outer fallback');
    expect(queryByTestId('route-loading-shell')).toBeNull();
  });
});
