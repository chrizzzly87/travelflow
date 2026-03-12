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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'nav.createTrip') return 'Create Trip';
      if (key === 'nav.myTrips') return 'My Trips';
      return key;
    },
  }),
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

  it('replaces the old planner/settings shortcuts with My Trips and Create Trip actions', async () => {
    const user = userEvent.setup();
    const onOpenTripManager = vi.fn();
    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: false,
      onOpenTripManager,
    }));

    await user.click(screen.getAllByRole('button', { name: /traveler/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'My Trips' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'My Trips' }));

    expect(onOpenTripManager).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu', { name: 'Account menu' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stamps' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View public profile' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Trip' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/create-trip');
    expect(mocks.trackEvent).toHaveBeenCalledWith('navigation__account_menu--create_trip');
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

  it('renders a stable Profile trigger label when requested', () => {
    render(React.createElement(AccountMenu, {
      email: 'traveler@example.com',
      userId: 'user-1',
      isAdmin: false,
      labelMode: 'profile',
    }));

    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /traveler/i })).toBeNull();
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

    const avatar = screen.getByText('CZ');
    expect(avatar).toBeInTheDocument();
    expect(avatar.className).toContain('rounded-full');
    expect(avatar.className).toContain('aspect-square');
    expect(avatar.className).toContain('shrink-0');
  });
});
