// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
});
