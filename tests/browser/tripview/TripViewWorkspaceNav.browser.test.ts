// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripViewWorkspaceNav } from '../../../components/tripview/TripViewWorkspaceNav';

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'tripView.workspaceNav.planner') return 'Planner';
      if (key === 'tripView.workspaceNav.prep') return 'Prep';
      return key;
    },
  }),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

describe('components/tripview/TripViewWorkspaceNav', () => {
  it('tracks workspace changes and calls back with the next mode', () => {
    const onModeChange = vi.fn();

    render(
      React.createElement(TripViewWorkspaceNav, {
        activeMode: 'planner',
        tripId: 'trip-1',
        onModeChange,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Prep' }));

    expect(onModeChange).toHaveBeenCalledWith('prep');
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__workspace_mode--change', {
      trip_id: 'trip-1',
      mode: 'prep',
      source: 'workspace_nav',
    });
  });
});
