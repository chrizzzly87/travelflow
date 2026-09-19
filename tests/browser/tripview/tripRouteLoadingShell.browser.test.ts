// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  persistedViewSettings: undefined as Record<string, unknown> | undefined,
  previewDays: null as Array<Record<string, unknown>> | null,
  routeParams: {} as Record<string, string | undefined>,
}));

vi.mock('../../../services/tripViewSettingsService', () => ({
  readPersistedTripViewSettings: () => mocks.persistedViewSettings,
}));

vi.mock('../../../services/tripRouteShellPreview', () => ({
  readTripRouteShellPreviewDays: () => mocks.previewDays,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => mocks.routeParams,
}));

import { TripRouteLoadingShell } from '../../../components/tripview/TripRouteLoadingShell';

// RTL cleanup is global in test/setupTests.ts; only the mock needs resetting.
afterEach(() => {
  mocks.persistedViewSettings = undefined;
  mocks.previewDays = null;
  mocks.routeParams = {};
});

const renderShell = () => render(React.createElement(TripRouteLoadingShell));

describe('TripRouteLoadingShell', () => {
  it('lays the placeholder out like the planner: a timeline pane, a resize grip and a map pane', () => {
    const view = renderShell();
    const planner = view.container.querySelector('.tf-boot-planner');

    expect(planner).toBeTruthy();
    expect(planner?.querySelector('.tf-boot-planner-timeline')).toBeTruthy();
    expect(planner?.querySelector('.tf-boot-planner-grip')).toBeTruthy();
    expect(planner?.querySelector('.tf-boot-planner-map')).toBeTruthy();
  });

  it('shows the day grid, the city row and the control clusters', () => {
    const view = renderShell();
    const timeline = view.container.querySelector('.tf-boot-planner-timeline');

    expect(timeline?.querySelector('.tf-boot-tl-months')).toBeTruthy();
    expect(timeline?.querySelectorAll('.tf-boot-tl-day').length).toBeGreaterThan(12);
    expect(timeline?.querySelector('.tf-boot-tl-label--cities')).toBeTruthy();
    expect(timeline?.querySelectorAll('.tf-boot-tl-city').length).toBeGreaterThan(1);
    expect(timeline?.querySelectorAll('.tf-boot-tl-control-group').length).toBe(3);
  });

  it('leaves the transfer chips and activity columns out of the placeholder', () => {
    const view = renderShell();

    expect(view.container.querySelector('.tf-boot-tl-transfer')).toBeNull();
    expect(view.container.querySelector('.tf-boot-tl-activity')).toBeNull();
  });

  it('opens in the horizontal layout when nothing has been persisted', () => {
    const view = renderShell();

    expect(view.container.querySelector('.tf-boot-planner'))
      .toHaveAttribute('data-tf-boot-layout', 'horizontal');
  });

  it('mirrors the orientation and pane size the traveller last used', () => {
    mocks.persistedViewSettings = { layoutMode: 'vertical', timelineHeight: 320, sidebarWidth: 680 };

    const view = renderShell();
    const planner = view.container.querySelector('.tf-boot-planner') as HTMLElement;

    expect(planner).toHaveAttribute('data-tf-boot-layout', 'vertical');
    expect(planner.style.getPropertyValue('--tf-boot-timeline-height')).toBe('320px');
    expect(planner.style.getPropertyValue('--tf-boot-sidebar-width')).toBe('680px');
  });

  it('leaves the pane sizes to CSS when the traveller has never resized a pane', () => {
    mocks.persistedViewSettings = { layoutMode: 'horizontal' };

    const view = renderShell();
    const planner = view.container.querySelector('.tf-boot-planner') as HTMLElement;

    expect(planner.style.getPropertyValue('--tf-boot-sidebar-width')).toBe('');
    expect(planner.style.getPropertyValue('--tf-boot-timeline-height')).toBe('');
  });

  it('draws placeholder day bubbles when this device knows nothing about the trip', () => {
    const view = renderShell();

    expect(view.container.querySelectorAll('.tf-boot-sheet-day-bubble').length).toBeGreaterThan(1);
    expect(view.container.querySelector('.tf-boot-sheet-day-bubble--dated')).toBeNull();
  });

  it('shows the real dates in the phone day strip when the trip is already on this device', () => {
    mocks.routeParams = { tripId: 'trip-1' };
    mocks.previewDays = [
      { weekdayLabel: 'Sat', dayOfMonthLabel: '19', monthLabel: 'Sep', isMonthStart: true },
      { weekdayLabel: 'Sun', dayOfMonthLabel: '20', monthLabel: 'Sep', isMonthStart: false },
    ];

    const view = renderShell();
    const bubbles = view.container.querySelectorAll('.tf-boot-sheet-day-bubble--dated');

    expect(bubbles).toHaveLength(2);
    expect(bubbles[0].textContent).toContain('Sat');
    expect(bubbles[0].textContent).toContain('19');
    expect(bubbles[1].textContent).toContain('20');
    // The month is labelled once, on the day that starts it.
    const months = [...view.container.querySelectorAll('.tf-boot-sheet-day-month')].map((el) => el.textContent);
    expect(months).toEqual(['Sep', '']);
  });

  it('mirrors the phone sheet the planner opens with', () => {
    const view = renderShell();
    const sheet = view.container.querySelector('.tf-boot-sheet');

    expect(sheet).toBeTruthy();
    expect(sheet?.querySelector('.tf-boot-sheet-grip')).toBeTruthy();
    expect(sheet?.querySelectorAll('.tf-boot-sheet-segment')).toHaveLength(2);
    expect(sheet?.querySelector('.tf-boot-sheet-toggle')).toBeTruthy();
    expect(sheet?.querySelectorAll('.tf-boot-sheet-row').length).toBeGreaterThan(1);
  });

  it('keeps the placeholder out of the accessibility tree', () => {
    const view = renderShell();

    expect(view.getByTestId('trip-route-loading-shell')).toHaveAttribute('aria-hidden', 'true');
  });
});
