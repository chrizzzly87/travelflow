// @vitest-environment jsdom
import React, { Suspense } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { makeTrip } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    isAdmin: false,
    access: {
      email: 'traveler@example.com',
      tierKey: 'tier_free',
      role: 'user',
      userId: 'user-1',
    },
  },
  getCurrentUserProfile: vi.fn(),
  getAllTrips: vi.fn(),
  saveTrip: vi.fn(),
  dbUpsertTrip: vi.fn(),
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/profileService', () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
}));

vi.mock('../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
  saveTrip: mocks.saveTrip,
}));

vi.mock('../../services/dbService', () => ({
  DB_ENABLED: false,
  dbUpsertTrip: mocks.dbUpsertTrip,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'sections.highlightsCount') {
        return `${options?.count ?? 0}/3 pinned`;
      }
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { ProfilePage } from '../../pages/ProfilePage';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return React.createElement('div', { 'data-testid': 'location-probe' }, `${location.pathname}${location.search}`);
};

const renderProfilePage = (initialPath: string) => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: [initialPath] },
    React.createElement(
      Suspense,
      { fallback: React.createElement('div', null, 'loading') },
      React.createElement(ProfilePage),
      React.createElement(LocationProbe)
    )
  )
);

describe('pages/ProfilePage query-driven tabs and sort', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    mocks.auth.isAdmin = false;

    mocks.getCurrentUserProfile.mockResolvedValue({
      id: 'user-1',
      email: 'traveler@example.com',
      displayName: 'Traveler One',
      firstName: 'Traveler',
      lastName: 'One',
      username: 'traveler',
      gender: '',
      country: 'Germany',
      city: 'Berlin',
      preferredLanguage: 'en',
      onboardingCompletedAt: '2026-01-01T00:00:00Z',
      accountStatus: 'active',
    });

    mocks.getAllTrips.mockReturnValue([
      makeTrip({ id: 'trip-a', title: 'Trip A', isFavorite: true, createdAt: 300, updatedAt: 100 }),
      makeTrip({ id: 'trip-b', title: 'Trip B', isFavorite: false, createdAt: 100, updatedAt: 500 }),
    ]);
  });

  it('uses tab query state and switches tabs via URL updates', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=favorites&recentSort=updated');

    await waitFor(() => {
      expect(screen.getByText('Trip A')).toBeInTheDocument();
    });

    expect(screen.queryByText('Trip B')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-probe').textContent).toContain('tab=favorites');

    await user.click(screen.getByRole('tab', { name: /tabs\.all/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toContain('tab=all');
    });
    expect(screen.getByText('Trip B')).toBeInTheDocument();
  });

  it('updates recent sort query parameter from the sort toggle', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=recent&recentSort=created');

    await waitFor(() => {
      expect(screen.getAllByText('Trip A').length).toBeGreaterThan(0);
    });

    expect(screen.getByTestId('location-probe').textContent).toContain('recentSort=created');

    await user.click(screen.getByRole('button', { name: /recentSort\.updated/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toContain('recentSort=updated');
    });
  });
});
