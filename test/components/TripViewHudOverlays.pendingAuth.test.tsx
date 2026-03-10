// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TripViewHudOverlays } from '../../components/tripview/TripViewHudOverlays';

const trackEventMock = vi.fn();

vi.mock('../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    React.createElement('a', { href: to, ...props }, children)
  ),
}));

const messages: Record<string, string> = {
  'tripView.pendingAuth.eyebrowLoading': 'Trip setup in progress',
  'tripView.pendingAuth.titleLoading': 'Preparing your trip',
  'tripView.pendingAuth.descriptionLoading': 'Saving your selections and checking the best way to build your itinerary.',
  'tripView.pendingAuth.eyebrowLocked': 'Account required',
  'tripView.pendingAuth.titleLocked': 'Creating trips is only for registered users',
  'tripView.pendingAuth.descriptionLocked': 'Sign in or create an account to claim this draft and start full trip generation.',
  'tripView.pendingAuth.cta': 'Sign in or create account',
  'tripView.pendingAuth.benefitsTitle': 'Why create an account',
  'tripView.pendingAuth.benefits.keep': 'Keep this trip and come back to it later.',
  'tripView.pendingAuth.benefits.background': 'Let generation finish in the background.',
  'tripView.pendingAuth.benefits.sync': 'Edit, retry, and sync it across devices.',
  'shared.perMonth': '/mo',
  'shared.days': '{count} days',
  'shared.unlimited': 'Unlimited',
  'shared.noExpiry': 'No expiry',
  'shared.enabled': 'Included',
  'shared.disabled': 'Not included',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = messages[key] ?? key;
      if (!options) return template;
      return Object.entries(options).reduce((result, [name, value]) => (
        result.replaceAll(`{${name}}`, String(value))
      ), template);
    },
  }),
}));

type TripViewHudOverlaysProps = React.ComponentProps<typeof TripViewHudOverlays>;

const makeProps = (overrides?: Partial<TripViewHudOverlaysProps>): TripViewHudOverlaysProps => ({
  shareStatus: undefined,
  onCopyTrip: undefined,
  isPaywallLocked: false,
  expirationLabel: null,
  tripId: 'trip-1',
  paywallActivationMode: 'login_modal',
  onPaywallActivateClick: () => undefined,
  paywallOverlayUpgradeCheckoutPath: null,
  showGenerationOverlay: false,
  generationProgressMessage: 'Checking timing',
  loadingDestinationSummary: 'Japan',
  tripDateRange: 'Mar 10, 2026 – Mar 20, 2026',
  tripTotalDaysLabel: '10',
  pendingAuthModalStage: 'hidden',
  onContinuePendingAuth: () => undefined,
  isPendingAuthContinueDisabled: false,
  ...overrides,
});

describe('TripViewHudOverlays pending auth modal', () => {
  afterEach(() => {
    cleanup();
    trackEventMock.mockClear();
  });

  it('shows the staged loading modal before the account lock copy', () => {
    render(
      <TripViewHudOverlays
        {...makeProps({
          pendingAuthModalStage: 'loading',
        })}
      />,
    );

    expect(screen.getByText('Preparing your trip')).toBeInTheDocument();
    expect(screen.getByText(/Japan/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in or create account' })).not.toBeInTheDocument();
  });

  it('shows the locked conversion modal and opens the auth CTA', () => {
    const onContinuePendingAuth = vi.fn();
    render(
      <TripViewHudOverlays
        {...makeProps({
          pendingAuthModalStage: 'locked',
          onContinuePendingAuth,
        })}
      />,
    );

    expect(screen.getByText('Creating trips is only for registered users')).toBeInTheDocument();
    expect(screen.getByText('Why create an account')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in or create account' }));
    expect(onContinuePendingAuth).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalled();
  });
});
