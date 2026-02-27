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
    isProfileLoading: false,
    refreshProfile: vi.fn(),
    session: {
      user: {
        user_metadata: {},
      },
    },
    profile: null,
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
  deleteTrip: vi.fn(),
  dbUpsertTrip: vi.fn(),
  dbArchiveTrip: vi.fn(),
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
  DB_ENABLED: false,
  dbUpsertTrip: mocks.dbUpsertTrip,
  dbArchiveTrip: mocks.dbArchiveTrip,
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
    mocks.auth.isProfileLoading = false;
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.dbArchiveTrip.mockResolvedValue(true);
    mocks.auth.profile = {
      id: 'user-1',
      email: 'traveler@example.com',
      displayName: 'Traveler One',
      firstName: 'Traveler',
      lastName: 'One',
      username: 'traveler',
      bio: 'Bio',
      gender: '',
      country: 'Germany',
      city: 'Berlin',
      preferredLanguage: 'en',
      onboardingCompletedAt: '2026-01-01T00:00:00Z',
      accountStatus: 'active',
      publicProfileEnabled: true,
      defaultPublicTripVisibility: true,
      usernameChangedAt: '2026-01-10T00:00:00Z',
    };

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

  it('filters private trips out when show-only-public preview is enabled', async () => {
    const user = userEvent.setup();
    mocks.getAllTrips.mockReturnValue([
      makeTrip({ id: 'trip-public', title: 'Trip Public', showOnPublicProfile: true, updatedAt: 300 }),
      makeTrip({ id: 'trip-private', title: 'Trip Private', showOnPublicProfile: false, updatedAt: 200 }),
    ]);

    renderProfilePage('/profile?tab=all&recentSort=updated');

    await waitFor(() => {
      expect(screen.getByText('Trip Public')).toBeInTheDocument();
      expect(screen.getByText('Trip Private')).toBeInTheDocument();
    });

    const publicOnlyToggle = screen.getByRole('switch', { name: /filters\.showOnlyPublic/i });
    expect(publicOnlyToggle).toHaveAttribute('aria-checked', 'false');

    await user.click(publicOnlyToggle);

    await waitFor(() => {
      expect(screen.getByText('Trip Public')).toBeInTheDocument();
      expect(screen.queryByText('Trip Private')).not.toBeInTheDocument();
    });
  });

  it('uses the shared page content grid width', async () => {
    renderProfilePage('/profile');

    await waitFor(() => {
      expect(screen.getByTestId('profile-page-container')).toBeInTheDocument();
    });

    const container = screen.getByTestId('profile-page-container');
    expect(container.className).toContain('max-w-7xl');
    expect(container.className).toContain('px-5');
    expect(container.className).toContain('md:px-8');
  });

  it('copies the public profile URL from the share action', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    renderProfilePage('/profile');

    const shareButton = await screen.findByRole('button', { name: /summary\.shareProfile/i });
    await waitFor(() => {
      expect(shareButton).toBeEnabled();
    });

    await user.click(shareButton);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(String(openSpy.mock.calls[0][0])).toContain('/u/traveler');
    openSpy.mockRestore();
  });

  it('defers hero rendering while profile session data is hydrating', () => {
    mocks.auth.isProfileLoading = true;
    mocks.auth.profile = null;

    renderProfilePage('/profile');

    expect(screen.queryByText('fallback.displayName')).not.toBeInTheDocument();
    expect(mocks.auth.refreshProfile).not.toHaveBeenCalled();
  });

  it('renders trip cards in lazy chunks before loading additional pages', async () => {
    const originalIntersectionObserver = (window as Window & { IntersectionObserver?: unknown }).IntersectionObserver;
    (window as Window & { IntersectionObserver?: unknown }).IntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    try {
      mocks.getAllTrips.mockReturnValue(Array.from({ length: 8 }).map((_, index) => (
        makeTrip({
          id: `trip-${index + 1}`,
          title: `Trip ${index + 1}`,
          createdAt: 900 - index,
          updatedAt: 900 - index,
        })
      )));

      renderProfilePage('/profile?tab=all&recentSort=updated');

      await waitFor(() => {
        expect(screen.getByText('Trip 1')).toBeInTheDocument();
        expect(screen.getByText('Trip 6')).toBeInTheDocument();
      });

      expect(screen.queryByText('Trip 8')).not.toBeInTheDocument();
    } finally {
      (window as Window & { IntersectionObserver?: unknown }).IntersectionObserver = originalIntersectionObserver;
    }
  });

  it('opens the passport dialog via query state without leaving the profile route', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile');

    const openPassportButton = await screen.findByRole('button', { name: /summary\.stampsOpen/i });
    await user.click(openPassportButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toContain('passport=open');
    });
    expect(screen.getByText('stamps.title')).toBeInTheDocument();
  });

  it('archives a single trip from profile cards after confirmation', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    await waitFor(() => {
      expect(screen.getByText('Trip A')).toBeInTheDocument();
      expect(screen.getByText('Trip B')).toBeInTheDocument();
    });

    const archiveButtons = screen.getAllByRole('button', { name: /cards\.actions\.archive/i });
    await user.click(archiveButtons[0]);

    await waitFor(() => {
      expect(mocks.confirmDialog).toHaveBeenCalled();
      expect(mocks.deleteTrip).toHaveBeenCalledTimes(1);
    });
  });

  it('does not archive a trip when single archive confirmation is canceled', async () => {
    const user = userEvent.setup();
    mocks.confirmDialog.mockResolvedValueOnce(false);
    renderProfilePage('/profile?tab=all&recentSort=updated');

    await waitFor(() => {
      expect(screen.getByText('Trip A')).toBeInTheDocument();
      expect(screen.getByText('Trip B')).toBeInTheDocument();
    });

    const archiveButtons = screen.getAllByRole('button', { name: /cards\.actions\.archive/i });
    await user.click(archiveButtons[0]);

    await waitFor(() => {
      expect(mocks.confirmDialog).toHaveBeenCalledTimes(1);
      expect(mocks.deleteTrip).toHaveBeenCalledTimes(0);
    });
  });

  it('archives selected trips from selection mode via Delete hotkey', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    const checkboxes = screen.getAllByRole('checkbox', { name: /cards\.actions\.selectTrip/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    await waitFor(() => {
      expect(mocks.confirmDialog).toHaveBeenCalled();
      expect(mocks.deleteTrip).toHaveBeenCalledTimes(2);
    });
  });

  it('archives selected trips from selection mode via archive toolbar button', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    const checkboxes = screen.getAllByRole('checkbox', { name: /cards\.actions\.selectTrip/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: /selection\.archiveSelected/i }));

    await waitFor(() => {
      expect(mocks.confirmDialog).toHaveBeenCalled();
      expect(mocks.deleteTrip).toHaveBeenCalledTimes(2);
    });
  });

  it('archives selected trips from selection mode via Backspace hotkey', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    const checkbox = screen.getAllByRole('checkbox', { name: /cards\.actions\.selectTrip/i })[0];
    await user.click(checkbox);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    await waitFor(() => {
      expect(mocks.confirmDialog).toHaveBeenCalled();
      expect(mocks.deleteTrip).toHaveBeenCalledTimes(1);
    });
  });

  it('clears selected trips via Escape key', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    const checkbox = screen.getAllByRole('checkbox', { name: /cards\.actions\.selectTrip/i })[0];
    await user.click(checkbox);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /selection\.archiveSelected/i })).not.toBeInTheDocument();
    });
    expect(mocks.confirmDialog).not.toHaveBeenCalled();
  });

  it('does not trigger delete hotkey archive while typing in input', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    const checkbox = screen.getAllByRole('checkbox', { name: /cards\.actions\.selectTrip/i })[0];
    await user.click(checkbox);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    await waitFor(() => {
      expect(mocks.confirmDialog).toHaveBeenCalledTimes(0);
      expect(mocks.deleteTrip).toHaveBeenCalledTimes(0);
    });
    input.remove();
  });

  it('toggles favorite state for selected trips from the selection toolbar', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    const checkboxes = screen.getAllByRole('checkbox', { name: /cards\.actions\.selectTrip/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: /selection\.toggleFavorites/i }));

    await waitFor(() => {
      expect(mocks.saveTrip).toHaveBeenCalledTimes(2);
    });
  });

  it('toggles visibility state for selected trips from the selection toolbar', async () => {
    const user = userEvent.setup();
    renderProfilePage('/profile?tab=all&recentSort=updated');

    const checkboxes = screen.getAllByRole('checkbox', { name: /cards\.actions\.selectTrip/i });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole('button', { name: /selection\.toggleVisibility/i }));

    await waitFor(() => {
      expect(mocks.saveTrip).toHaveBeenCalledTimes(2);
    });
  });

  it('replaces the selection with expired trips from the quick action', async () => {
    const user = userEvent.setup();
    mocks.getAllTrips.mockReturnValue([
      makeTrip({ id: 'trip-a', title: 'Trip A', status: 'active', updatedAt: 100 }),
      makeTrip({ id: 'trip-b', title: 'Trip B', status: 'expired', updatedAt: 500 }),
    ]);

    renderProfilePage('/profile?tab=all&recentSort=updated');

    const tripACheckbox = await screen.findByRole('checkbox', { name: /Trip A/i });
    await user.click(tripACheckbox);
    await user.click(screen.getByRole('button', { name: /selection\.selectExpired/i }));

    const tripAAfter = screen.getByRole('checkbox', { name: /Trip A/i });
    const tripBAfter = screen.getByRole('checkbox', { name: /Trip B/i });
    expect(tripAAfter).not.toBeChecked();
    expect(tripBAfter).toBeChecked();
  });
});
