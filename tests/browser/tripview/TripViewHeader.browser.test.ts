// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TripViewHeader } from '../../../components/tripview/TripViewHeader';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'tripView.header.titleTooltipEditable') return 'Open trip details and edit the title';
      if (key === 'tripView.header.editTitleCta') return 'Edit title';
      if (key === 'tripView.header.openDetailsCta') return 'Open trip details';
      if (key === 'tripView.header.share') return 'Share';
      if (key === 'nav.login') return 'Login';
      return key;
    },
  }),
}));

const accountMenuMocks = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../../components/navigation/AccountMenu', () => ({
  AccountMenu: (props: Record<string, unknown>) => {
    accountMenuMocks.props.push(props);
    return React.createElement(
      'div',
      { 'data-testid': 'account-menu' },
      React.createElement('button', {
        type: 'button',
        onClick: () => (props.onOpenTripManager as (() => void) | undefined)?.(),
      }, 'Open My Trips'),
    );
  },
}));

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: (eventName: string, payload?: Record<string, unknown>) => {
    const attributes: Record<string, string> = {
      'data-tf-track-event': eventName,
    };
    if (payload) {
      attributes['data-tf-track-payload'] = JSON.stringify(payload);
    }
    return attributes;
  },
}));

const buildProps = (): React.ComponentProps<typeof TripViewHeader> => ({
  isMobile: false,
  tripTitle: 'Thailand Food Trail',
  tripSummary: '22 Feb 2026 – 25 Mar 2026 · 8 cities · 3,754 km',
  titleViewTransitionName: null,
  canManageTripMetadata: true,
  onHeaderAuthAction: vi.fn(),
  isHeaderAuthSubmitting: false,
  canUseAuthenticatedSession: true,
  accountEmail: 'traveler@example.com',
  accountUserId: 'user-1',
  isAdminSession: false,
  onOpenTripInfo: vi.fn(),
  onPrewarmTripInfo: vi.fn(),
  onOpenManager: vi.fn(),
  canShare: true,
  onShare: vi.fn(),
  isTripLockedByExpiry: false,
});

describe('components/tripview/TripViewHeader', () => {
  afterEach(() => {
    cleanup();
    analyticsMocks.trackEvent.mockReset();
    accountMenuMocks.props = [];
  });

  it('uses the title as the trip details trigger and moves the trips entry into the account menu', () => {
    const props = buildProps();

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(TripViewHeader, props),
      ),
    );

    const titleButton = screen.getByRole('button', { name: 'Open trip details and edit the title' });
    expect(titleButton).toHaveAttribute('data-no-press-scale', 'true');
    fireEvent.mouseEnter(titleButton);
    fireEvent.click(titleButton);
    fireEvent.click(screen.getByRole('button', { name: 'Open My Trips' }));

    expect(props.onPrewarmTripInfo).toHaveBeenCalledTimes(1);
    expect(props.onOpenTripInfo).toHaveBeenCalledTimes(1);
    expect(props.onOpenManager).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('account-menu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trips' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__trip_info--open', { source: 'header_title' });
  });

  it('hides the account label on mobile while keeping the profile menu available', () => {
    const props = buildProps();
    props.isMobile = true;

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(TripViewHeader, props),
      ),
    );

    expect(accountMenuMocks.props.at(-1)?.showLabel).toBe(false);
    expect(accountMenuMocks.props.at(-1)?.showCaret).toBe(false);
  });

  it('falls back to the login button for guests', () => {
    const props = buildProps();
    props.canUseAuthenticatedSession = false;
    props.accountEmail = null;
    props.accountUserId = null;

    render(
      React.createElement(MemoryRouter, null,
        React.createElement(TripViewHeader, props),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(props.onHeaderAuthAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('account-menu')).not.toBeInTheDocument();
  });
});
