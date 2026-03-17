// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: {
    pathname: '/de/terms',
    search: '?accept=required&next=%2Ftrip%2Ftrip-123',
    hash: '',
    state: null,
    key: 'test',
  },
  searchParams: new URLSearchParams('?accept=required&next=%2Ftrip%2Ftrip-123'),
  auth: {
    isAuthenticated: true,
    isAnonymous: false,
    access: {
      termsCurrentVersion: '2026-03-03',
      termsAcceptedVersion: '2026-02-01',
      termsAcceptanceRequired: true,
    },
    refreshAccess: vi.fn().mockResolvedValue(undefined),
  },
  acceptCurrentTerms: vi.fn().mockResolvedValue({
    data: { termsVersion: '2026-03-03', acceptedAt: '2026-03-03T10:00:00Z' },
    error: null,
  }),
  getCurrentLegalTermsVersion: vi.fn().mockResolvedValue({
    version: '2026-03-03',
    title: 'Terms of Service / AGB',
    summary: 'Initial terms',
    bindingLocale: 'de',
    lastUpdated: '2026-03-03',
    effectiveAt: '2026-03-03T00:00:00Z',
    requiresReaccept: true,
    isCurrent: true,
    contentDe: '## 1. Geltungsbereich\\nDies ist die deutsche Fassung.',
    contentEn: '## 1. Scope\\nThis is the helper translation.',
    createdAt: '2026-03-03T00:00:00Z',
    createdBy: null,
  }),
  trackEvent: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.searchParams, vi.fn()],
}));

vi.mock('../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../services/authService', () => ({
  acceptCurrentTerms: mocks.acceptCurrentTerms,
}));

vi.mock('../../services/legalTermsService', () => ({
  getCurrentLegalTermsVersion: mocks.getCurrentLegalTermsVersion,
}));

vi.mock('../../services/authNavigationService', () => ({
  resolvePreferredNextPath: (value: string | null) => value || '/create-trip',
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const dictionary: Record<string, string> = {
        'termsPage.heroEyebrow': 'Terms of Service · AGB',
        'termsPage.heroTitle': 'Terms of Service / Allgemeine Geschäftsbedingungen',
        'termsPage.heroIntro': `These Terms govern your use of ${options?.appName || 'TravelFlow'}.`,
        'termsPage.heroBindingNote': 'The German text below is the legally binding version. The English text is provided for convenience only.',
        'termsPage.versionLabel': 'Version',
        'termsPage.lastUpdatedLabel': 'Last updated',
        'termsPage.controllerInfoLead': 'Controller information is available in the',
        'termsPage.imprintLinkLabel': 'Imprint',
        'termsPage.privacyInfoLead': 'Data processing details are available in the',
        'termsPage.privacyLinkLabel': 'Privacy Policy',
        'termsPage.acceptRequiredTitle': 'Action required: please accept the current Terms to continue using your account.',
        'termsPage.acceptRequiredDescription': 'You can review both versions below before confirming.',
        'termsPage.acceptSubmit': 'Accept current Terms and continue',
        'termsPage.acceptSubmitting': 'Saving acceptance...',
        'termsPage.acceptError': 'We could not save your Terms acceptance right now. Please try again.',
        'termsPage.bindingSectionTitle': 'Binding Version (German)',
        'termsPage.helperSectionTitle': 'Convenience Translation (English, non-binding)',
      };
      return dictionary[key] || key;
    },
  }),
}));

import { TermsPage } from '../../pages/TermsPage';

describe('pages/TermsPage acceptance flow', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.location.pathname = '/de/terms';
    mocks.location.search = '?accept=required&next=%2Ftrip%2Ftrip-123';
    mocks.searchParams = new URLSearchParams('?accept=required&next=%2Ftrip%2Ftrip-123');
    mocks.auth.isAuthenticated = true;
    mocks.auth.isAnonymous = false;
    mocks.auth.access = {
      termsCurrentVersion: '2026-03-03',
      termsAcceptedVersion: '2026-02-01',
      termsAcceptanceRequired: true,
    };
    mocks.auth.refreshAccess.mockResolvedValue(undefined);
    mocks.getCurrentLegalTermsVersion.mockResolvedValue({
      version: '2026-03-03',
      title: 'Terms of Service / AGB',
      summary: 'Initial terms',
      bindingLocale: 'de',
      lastUpdated: '2026-03-03',
      effectiveAt: '2026-03-03T00:00:00Z',
      requiresReaccept: true,
      isCurrent: true,
      contentDe: '## 1. Geltungsbereich\\nDies ist die deutsche Fassung.',
      contentEn: '## 1. Scope\\nThis is the helper translation.',
      createdAt: '2026-03-03T00:00:00Z',
      createdBy: null,
    });
    mocks.acceptCurrentTerms.mockResolvedValue({
      data: { termsVersion: '2026-03-03', acceptedAt: '2026-03-03T10:00:00Z' },
      error: null,
    });
  });

  it('submits acceptance and continues to the intended route when acceptance is required', async () => {
    const user = userEvent.setup();

    render(React.createElement(TermsPage));

    expect(screen.getByText('Version: 2026-03-03')).toBeInTheDocument();
    expect(screen.getByText('Last updated: 2026-03-03')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept current Terms and continue' }));

    await waitFor(() => {
      expect(mocks.acceptCurrentTerms).toHaveBeenCalledWith({
        locale: 'de',
        source: 'terms_page',
      });
    });
    expect(mocks.auth.refreshAccess).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/trip/trip-123', { replace: true });
  });

  it('hides acceptance CTA for users who already accepted the current terms', () => {
    mocks.auth.access = {
      termsCurrentVersion: '2026-03-03',
      termsAcceptedVersion: '2026-03-03',
      termsAcceptanceRequired: false,
    };

    render(React.createElement(TermsPage));

    expect(screen.queryByRole('button', { name: 'Accept current Terms and continue' })).not.toBeInTheDocument();
  });

  it('keeps the acceptance CTA available for forced checkout recovery links even when access state is stale', async () => {
    const user = userEvent.setup();
    mocks.location.search = '?accept=required&next=%2Fcheckout%3Ftier%3Dtier_mid%26source%3Dpricing_page%26return_to%3D%252Fpricing';
    mocks.searchParams = new URLSearchParams(mocks.location.search);
    mocks.auth.access = {
      termsCurrentVersion: '2026-03-03',
      termsAcceptedVersion: '2026-03-03',
      termsAcceptanceRequired: true,
    };

    render(React.createElement(TermsPage));

    await user.click(screen.getByRole('button', { name: 'Accept current Terms and continue' }));

    await waitFor(() => {
      expect(mocks.acceptCurrentTerms).toHaveBeenCalledWith({
        locale: 'de',
        source: 'terms_page',
      });
    });
    expect(mocks.navigate).toHaveBeenCalledWith('/checkout?tier=tier_mid&source=pricing_page&return_to=%2Fpricing', { replace: true });
  });
});
