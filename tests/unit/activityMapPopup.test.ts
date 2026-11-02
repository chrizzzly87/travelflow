// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ITimelineItem } from '../../types';
import { ActivityMapPopup } from '../../components/maps/ActivityMapPopup';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

afterEach(() => {
  cleanup();
});

const activity: ITimelineItem = {
  id: 'act-1',
  type: 'activity',
  title: 'Taipei 101',
  startDateOffset: 0,
  duration: 0.5,
  color: 'bg-sky-500',
  location: 'Xinyi District, Taipei',
  activityType: ['sightseeing'],
  coordinates: { lat: 25.033964, lng: 121.564468 },
  placeId: 'place-1',
};

const renderPopup = (overrides: Partial<React.ComponentProps<typeof ActivityMapPopup>> = {}) => {
  const props: React.ComponentProps<typeof ActivityMapPopup> = {
    item: activity,
    anchor: { x: 200, top: 400, bottom: 440 },
    containerSize: { width: 800, height: 600 },
    markerCoordinatesSource: 'activity',
    onClose: vi.fn(),
    onOpenDetails: vi.fn(),
    ...overrides,
  };
  render(React.createElement(ActivityMapPopup, props));
  return props;
};

describe('components/maps/ActivityMapPopup', () => {
  it('offers both map apps, pointed at the stored position', () => {
    renderPopup();

    const google = screen.getByRole('link', { name: 'tripView.mapLinks.google' });
    const apple = screen.getByRole('link', { name: 'tripView.mapLinks.apple' });

    expect(google).toHaveAttribute('href', expect.stringContaining('query=25.033964%2C121.564468'));
    expect(google).toHaveAttribute('href', expect.stringContaining('query_place_id=place-1'));
    expect(apple).toHaveAttribute('href', expect.stringContaining('ll=25.033964%2C121.564468'));
    // Opening a maps app must never hand the referrer to it.
    expect(google).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says so when the pin is only the city fallback', () => {
    renderPopup({ markerCoordinatesSource: 'city' });
    expect(screen.getByText('tripView.mapLinks.approximate')).toBeInTheDocument();
  });

  it('does not claim an approximate position once the activity resolved its own', () => {
    renderPopup();
    expect(screen.queryByText('tripView.mapLinks.approximate')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const props = renderPopup();

    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('is reachable as a labelled dialog and hands the id back for the details panel', async () => {
    const user = userEvent.setup();
    const props = renderPopup();

    expect(screen.getByRole('dialog', { name: 'tripView.mapLinks.popupLabel' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'tripView.mapLinks.openDetails' }));
    expect(props.onOpenDetails).toHaveBeenCalledWith('act-1');
  });
});
