// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
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

import { DeferredAppRoutes } from '../../../app/routes/DeferredAppRoutes';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('div', { 'data-testid': 'location-probe' }, `${location.pathname}${location.search}`);
};

const renderDeferredRoutes = (initialPath: string) => {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(DeferredAppRoutes, {
        onAppLanguageLoaded: vi.fn(),
        onTripGenerated: vi.fn(),
        onOpenManager: vi.fn(),
      }),
      React.createElement(LocationProbe)
    )
  );
};

describe('app/routes/DeferredAppRoutes root auth gate', () => {
  beforeEach(() => {
    cleanup();
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = false;
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

  it('shows loading fallback while auth is resolving on root', () => {
    mocks.auth.isLoading = true;

    const { container, getByTestId } = renderDeferredRoutes('/');

    expect(getByTestId('location-probe').textContent).toBe('/');
    expect(container.querySelector('div[aria-hidden="true"]')).toBeTruthy();
  });

  it('supports public profile routes', async () => {
    const { getByTestId } = renderDeferredRoutes('/u/traveler');

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/u/traveler');
    });
  });

  it('supports profile stamps route for authenticated users', async () => {
    mocks.auth.isAuthenticated = true;

    const { getByTestId } = renderDeferredRoutes('/profile/stamps');

    await waitFor(() => {
      expect(getByTestId('location-probe').textContent).toBe('/profile/stamps');
    });
  });
});
