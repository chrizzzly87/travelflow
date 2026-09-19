// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  persistedViewSettings: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../../../services/tripViewSettingsService', () => ({
  readPersistedTripViewSettings: () => mocks.persistedViewSettings,
}));

import { TripRouteLoadingShell } from '../../../components/tripview/TripRouteLoadingShell';

afterEach(() => {
  cleanup();
  mocks.persistedViewSettings = undefined;
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

  it('mirrors the timeline sections the planner renders', () => {
    const view = renderShell();
    const timeline = view.container.querySelector('.tf-boot-planner-timeline');

    expect(timeline?.querySelector('.tf-boot-tl-months')).toBeTruthy();
    expect(timeline?.querySelectorAll('.tf-boot-tl-day').length).toBeGreaterThan(12);
    expect(timeline?.querySelector('.tf-boot-tl-label--cities')).toBeTruthy();
    expect(timeline?.querySelectorAll('.tf-boot-tl-city').length).toBeGreaterThan(1);
    expect(timeline?.querySelector('.tf-boot-tl-label--transfer')).toBeTruthy();
    expect(timeline?.querySelectorAll('.tf-boot-tl-transfer').length).toBeGreaterThan(1);
    expect(timeline?.querySelector('.tf-boot-tl-label--activities')).toBeTruthy();
    expect(timeline?.querySelectorAll('.tf-boot-tl-activity').length).toBeGreaterThan(1);
    expect(timeline?.querySelectorAll('.tf-boot-tl-control-group').length).toBe(3);
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

  it('keeps the placeholder out of the accessibility tree', () => {
    const view = renderShell();

    expect(view.getByTestId('trip-route-loading-shell')).toHaveAttribute('aria-hidden', 'true');
  });
});
