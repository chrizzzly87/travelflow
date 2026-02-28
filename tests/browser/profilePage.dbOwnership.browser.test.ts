// @vitest-environment jsdom
import React, { Suspense } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { makeTrip } from '../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: true,
    isAdmin: false,
    isProfileLoading: false,
    refreshProfile: vi.fn(),
    session: {
      user: {
        user_metadata: {},
      },
    },
    profile: {
      id: 'user-1',
      email: 'owner@example.com',
      displayName: 'Owner User',
      firstName: 'Owner',
      lastName: 'User',
      username: 'owner_user',
      bio: '',
      gender: '',
      country: 'US',
      city: 'Austin',
      preferredLanguage: 'en',
      onboardingCompletedAt: null,
      accountStatus: 'active',
      publicProfileEnabled: true,
      defaultPublicTripVisibility: true,
      usernameChangedAt: null,
    },
    access: {
      email: 'owner@example.com',
      tierKey: 'tier_free',
      role: 'user',
      userId: 'user-1',
    },
  },
  getCurrentUserProfile: vi.fn(),
  getAllTrips: vi.fn(),
  saveTrip: vi.fn(),
  deleteTrip: vi.fn(),
  dbUpsertTrip: vi.fn(),
  dbArchiveTrip: vi.fn(),
  syncTripsFromDb: vi.fn(),
  confirmDialog: vi.fn(),
  showAppToast: vi.fn(() => 'toast-id'),
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
  deleteTrip: mocks.deleteTrip,
}));

vi.mock('../../services/dbService', () => ({
  DB_ENABLED: true,
  dbUpsertTrip: mocks.dbUpsertTrip,
  dbArchiveTrip: mocks.dbArchiveTrip,
  syncTripsFromDb: mocks.syncTripsFromDb,
}));

vi.mock('../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: mocks.confirmDialog,
  }),
}));

vi.mock('../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
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

const renderProfilePage = (initialPath: string) => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: [initialPath] },
    React.createElement(
      Suspense,
      { fallback: React.createElement('div', null, 'loading') },
      React.createElement(ProfilePage)
    )
  )
);

describe('pages/ProfilePage DB ownership sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.dbArchiveTrip.mockResolvedValue(true);
  });

  it('replaces stale local trips with DB-owned trips on mount', async () => {
    const staleTrip = makeTrip({ id: 'trip-stale', title: 'Stale Trip', updatedAt: 100 });
    const ownedTrip = makeTrip({ id: 'trip-owned', title: 'Owned Trip', updatedAt: 200 });
    let currentTrips = [staleTrip];

    mocks.getAllTrips.mockImplementation(() => currentTrips);
    mocks.syncTripsFromDb.mockImplementation(async () => {
      currentTrips = [ownedTrip];
    });

    renderProfilePage('/profile?tab=all&recentSort=updated');

    await waitFor(() => {
      expect(screen.getByText('Owned Trip')).toBeInTheDocument();
    });
    expect(screen.queryByText('Stale Trip')).not.toBeInTheDocument();
    expect(mocks.syncTripsFromDb).toHaveBeenCalledTimes(1);
  });
});
