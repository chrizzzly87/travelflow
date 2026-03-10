// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: {
    pathname: '/es/pricing',
    search: '',
    hash: '',
  },
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  openLoginModal: vi.fn(),
  trackEvent: vi.fn(),
  onClose: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  NavLink: ({
    to,
    children,
    onClick,
    className,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string | ((state: { isActive: boolean }) => string);
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', {
    href: to,
    onClick,
    className: typeof className === 'function' ? className({ isActive: false }) : className,
    ...props,
  }, children),
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../hooks/useHasSavedTrips', () => ({
  useHasSavedTrips: () => false,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isAdmin: false,
    access: null,
    isLoading: false,
    logout: vi.fn().mockResolvedValue(undefined),
    profile: null,
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

vi.mock('../../../components/navigation/AppBrand', () => ({
  AppBrand: () => React.createElement('span', null, 'TravelFlow'),
}));

vi.mock('../../../components/navigation/LanguageSelect', () => ({
  LanguageSelect: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (nextLocale: string) => void;
  }) => React.createElement(
    'div',
    { 'data-testid': 'language-select', 'data-value': value },
    React.createElement('span', null, value),
    React.createElement('button', { type: 'button', onClick: () => onChange('en') }, 'Switch to English'),
    React.createElement('button', { type: 'button', onClick: () => onChange('es') }, 'Switch to Spanish')
  ),
}));

vi.mock('../../../components/navigation/AccountMenu', () => ({
  AccountMenu: () => React.createElement('div', { 'data-testid': 'account-menu' }, 'Account'),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const dictionary: Record<string, string> = {
          'nav.features': 'Features',
          'nav.inspirations': 'Inspirations',
          'nav.updates': 'News & Updates',
          'nav.blog': 'Blog',
          'nav.pricing': 'Pricing',
          'nav.login': 'Login',
          'nav.createTrip': 'Create Trip',
          'nav.openMenu': 'Open menu',
          'nav.myTrips': 'My Trips',
          'language.label': 'Language',
          'footer.imprint': 'Imprint',
          'footer.privacy': 'Privacy',
          'footer.terms': 'Terms',
          'footer.cookies': 'Cookies',
        };
        return dictionary[key] ?? key;
      },
      i18n: {
        language: 'es',
        resolvedLanguage: 'es',
        changeLanguage: mocks.changeLanguage,
      },
    }),
  };
});

import { SiteHeader } from '../../../components/navigation/SiteHeader';
import { MobileMenu } from '../../../components/navigation/MobileMenu';

describe('navigation locale switch handoff', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.location.pathname = '/es/pricing';
    mocks.location.search = '';
    mocks.location.hash = '';
  });

  it('keeps the header locale selection on English while the route handoff is still pending', async () => {
    const user = userEvent.setup();
    render(React.createElement(SiteHeader));

    expect(screen.getByTestId('language-select')).toHaveAttribute('data-value', 'es');

    await user.click(screen.getByRole('button', { name: 'Switch to English' }));

    await waitFor(() => {
      expect(screen.getByTestId('language-select')).toHaveAttribute('data-value', 'en');
    });
    expect(mocks.navigate).toHaveBeenCalledWith('/pricing');
    expect(mocks.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('keeps the mobile locale selection on English while the route handoff is still pending', async () => {
    const user = userEvent.setup();
    render(React.createElement(MobileMenu, {
      isOpen: true,
      onClose: mocks.onClose,
    }));

    expect(screen.getByTestId('language-select')).toHaveAttribute('data-value', 'es');

    await user.click(screen.getByRole('button', { name: 'Switch to English' }));

    await waitFor(() => {
      expect(screen.getByTestId('language-select')).toHaveAttribute('data-value', 'en');
    });
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/pricing');
    expect(mocks.changeLanguage).toHaveBeenCalledWith('en');
  });
});
