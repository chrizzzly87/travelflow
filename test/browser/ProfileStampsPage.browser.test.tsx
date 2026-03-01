// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    isProfileLoading: false,
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    access: {
      email: 'traveler@example.com',
      tierKey: 'tier_free',
      role: 'user',
      userId: 'user-1',
    },
    session: {
      user: {
        user_metadata: {},
      },
    },
    profile: null as null | {
      id: string;
      displayName: string;
      firstName: string;
      lastName: string;
      username: string;
      passportStickerPositions: Record<string, { x: number; y: number }>;
      passportStickerSelection: string[];
    },
  },
  getAllTrips: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => {
      if (key === 'stamps.description') return `desc ${options?.name || ''}`;
      if (key === 'fallback.displayName') return 'Traveler';
      if (key === 'stamps.pageIndicator') return '{page}/{total}';
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { ProfileStampsPage } from '../../pages/ProfileStampsPage';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('div', { 'data-testid': 'location-probe' }, `${location.pathname}${location.search}`);
};

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/profile/stamps'] },
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: '/profile/stamps',
        element: React.createElement(React.Fragment, null, React.createElement(ProfileStampsPage), React.createElement(LocationProbe)),
      }),
      React.createElement(Route, {
        path: '/login',
        element: React.createElement('div', { 'data-testid': 'login-route' }, 'Login'),
      }),
    ),
  ),
);

describe('pages/ProfileStampsPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    mocks.auth.isProfileLoading = false;
    mocks.auth.access.email = 'traveler@example.com';
    mocks.auth.profile = {
      id: 'user-1',
      displayName: 'Traveler One',
      firstName: 'Traveler',
      lastName: 'One',
      username: 'traveler',
      passportStickerPositions: {},
      passportStickerSelection: [],
    };

    mocks.getAllTrips.mockReturnValue([
      {
        id: 'trip-1',
        title: 'Trip one',
        startDate: '2026-01-10',
        items: [],
        createdAt: 100,
        updatedAt: 120,
      },
    ]);
  });

  it('renders grouped stamp-book navigation and tracks page changes', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'stamps.nextPage' }).length).toBeGreaterThanOrEqual(2);
    });

    const nextButtons = screen.getAllByRole('button', { name: 'stamps.nextPage' });
    await user.click(nextButtons[nextButtons.length - 1]);

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith('profile__stamps_page--change', { page: 2 });
    });
  });

  it('uses email fallback for new users while profile is not cached yet', async () => {
    mocks.auth.profile = null;
    mocks.auth.access.email = 'new.user@example.com';
    mocks.getAllTrips.mockReturnValue([]);

    renderPage();

    await waitFor(() => {
      expect(mocks.auth.refreshProfile).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('desc new.user')).toBeInTheDocument();
  });

  it('redirects guests to login', async () => {
    mocks.auth.isAuthenticated = false;

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('login-route')).toBeInTheDocument();
    });
  });
});
