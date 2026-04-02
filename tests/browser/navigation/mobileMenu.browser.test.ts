// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  profile: null as { username?: string | null } | null,
  logout: vi.fn().mockResolvedValue(undefined),
  openLoginModal: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../../hooks/useHasSavedTrips', () => ({
  useHasSavedTrips: () => false,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mocks.isAuthenticated,
    isAdmin: mocks.isAdmin,
    isLoading: mocks.isLoading,
    profile: mocks.profile,
    logout: mocks.logout,
  }),
}));

vi.mock('../../../hooks/useLoginModal', () => ({
  useLoginModal: () => ({
    openLoginModal: mocks.openLoginModal,
  }),
}));

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => undefined,
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        if (key === 'footer.imprint') return 'Imprint';
        if (key === 'footer.privacy') return 'Privacy';
        if (key === 'footer.terms') return 'Terms';
        if (key === 'footer.cookies') return 'Cookies';
        if (key === 'nav.login') return 'Login';
        return key;
      },
      i18n: {
        language: 'en',
        resolvedLanguage: 'en',
        changeLanguage: vi.fn().mockResolvedValue(undefined),
      },
    }),
  };
});

import { MobileMenu } from '../../../components/navigation/MobileMenu';

describe('components/navigation/MobileMenu legal links', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.isAuthenticated = false;
    mocks.isAdmin = false;
    mocks.isLoading = false;
    mocks.profile = null;
  });

  it('shows legal links in the mobile menu for anonymous users', () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/trip/example'] },
        React.createElement(MobileMenu, {
          isOpen: true,
          onClose: vi.fn(),
        })
      )
    );

    expect(screen.getByRole('link', { name: 'Imprint' })).toHaveAttribute('href', '/imprint');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Cookies' })).toHaveAttribute('href', '/cookies');
  });

  it('shows only the admin dashboard shortcut on mobile for admins', () => {
    mocks.isAuthenticated = true;
    mocks.isAdmin = true;
    mocks.profile = { username: 'owner' };

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/profile'] },
        React.createElement(MobileMenu, {
          isOpen: true,
          onClose: vi.fn(),
        })
      )
    );

    expect(screen.getByRole('link', { name: 'Admin dashboard' })).toHaveAttribute('href', '/admin');
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Trips' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'AI Telemetry' })).toBeNull();
  });

  it('keeps the mobile menu close controls interactive above the sticky header layer', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/trip/example'] },
        React.createElement(MobileMenu, {
          isOpen: true,
          onClose,
        })
      )
    );

    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toHaveClass('z-[1700]');

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    await user.click(screen.getByRole('button', { name: 'Close navigation menu', hidden: true }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('hides stamps and public-profile shortcuts from the authenticated mobile account section', () => {
    mocks.isAuthenticated = true;
    mocks.isAdmin = false;
    mocks.profile = { username: 'owner' };

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/profile'] },
        React.createElement(MobileMenu, {
          isOpen: true,
          onClose: vi.fn(),
        })
      )
    );

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'Recent trips' })).toHaveAttribute('href', '/profile?tab=recent');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/profile/settings');
    expect(screen.queryByRole('link', { name: 'Stamps' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'View public profile' })).toBeNull();
  });
});
