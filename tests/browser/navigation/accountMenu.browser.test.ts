// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeTrip } from '../../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: {
    pathname: '/create-trip',
    search: '',
    hash: '',
  },
  profile: {
    firstName: 'Traveler',
    lastName: 'User',
    username: 'traveler',
  } as { firstName?: string; lastName?: string; username?: string | null } | null,
  logout: vi.fn().mockResolvedValue(undefined),
  getAllTrips: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    logout: mocks.logout,
    profile: mocks.profile,
  }),
}));

vi.mock('../../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

import { AccountMenu } from '../../../components/navigation/AccountMenu';

describe('components/navigation/AccountMenu recent trips', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.profile = {
      firstName: 'Traveler',
      lastName: 'User',
      username: 'traveler',
    };

    mocks.getAllTrips.mockReturnValue([
      makeTrip({ id: 'trip-1', title: 'Trip 1', createdAt: 100 }),
      makeTrip({ id: 'trip-2', title: 'Trip 2', createdAt: 200 }),
      makeTrip({ id: 'trip-3', title: 'Trip 3', createdAt: 300 }),
      makeTrip({ id: 'trip-4', title: 'Trip 4', createdAt: 400 }),
      makeTrip({ id: 'trip-5', title: 'Trip 5', createdAt: 500 }),
      makeTrip({ id: 'trip-6', title: 'Trip 6', createdAt: 600 }),
    ]);
  });

  it('shows top 5 recent trips by created date and quick-jumps to trip detail', async () => {
    const user = userEvent.setup();
    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: false,
    }));

    await user.click(screen.getAllByRole('button', { name: /traveler/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('Recent trips')).toBeInTheDocument();
    });

    expect(screen.queryByText('Trip 1')).not.toBeInTheDocument();
    expect(screen.getByText('Trip 6')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Trip 6/i }));

    expect(mocks.navigate).toHaveBeenCalledWith('/trip/trip-6');
    expect(mocks.trackEvent).toHaveBeenCalledWith('navigation__account_menu--recent_trip', { trip_id: 'trip-6' });
  });

  it('opens the profile recent tab from view all trips shortcut', async () => {
    const user = userEvent.setup();
    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: false,
    }));

    await user.click(screen.getAllByRole('button', { name: /traveler/i })[0]);
    await user.click(screen.getByRole('button', { name: 'View all trips' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/profile?tab=recent');
    expect(mocks.trackEvent).toHaveBeenCalledWith('navigation__account_menu--recent_view_all');
  });

  it('opens public profile shortcut when username is available', async () => {
    const user = userEvent.setup();
    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: false,
    }));

    await user.click(screen.getAllByRole('button', { name: /traveler/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View public profile' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'View public profile' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/u/traveler');
    expect(mocks.trackEvent).toHaveBeenCalledWith('navigation__account_menu--public_profile');
  });

  it('opens stamp collection shortcut', async () => {
    const user = userEvent.setup();
    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: false,
    }));

    await user.click(screen.getAllByRole('button', { name: /traveler/i })[0]);
    await user.click(screen.getByRole('button', { name: 'Stamps' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/profile/stamps');
    expect(mocks.trackEvent).toHaveBeenCalledWith('navigation__account_menu--stamps');
  });

  it('supports admin identity label mode without recent trips section', async () => {
    const user = userEvent.setup();
    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: true,
      labelMode: 'identity',
      showRecentTripsSection: false,
      showCurrentPageSummary: false,
    }));

    await user.click(screen.getAllByRole('button', { name: /traveler/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText('@traveler').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Recent trips')).not.toBeInTheDocument();
    expect(screen.queryByText(/Current page:/i)).not.toBeInTheDocument();
  });

  it('uses profile first/last-name initials for avatar when available', () => {
    mocks.profile = {
      firstName: 'Chris',
      lastName: 'Zimmer',
      username: 'traveler',
    };

    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: false,
    }));

    expect(screen.getByText('CZ')).toBeInTheDocument();
  });
});
