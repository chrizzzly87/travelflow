// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Timeline } from '../../components/Timeline';
import { VerticalTimeline } from '../../components/VerticalTimeline';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

// A view-only trip used to render every "+" in the planner as a disabled,
// half-faded button: it advertised an action the viewer could never take.
// These must not be rendered at all without edit rights.
const trip = makeTrip({
  startDate: '2026-03-28',
  items: [
    makeCityItem({ id: 'city-1', title: 'Taipei', startDateOffset: 0, duration: 3 }),
    makeCityItem({ id: 'city-2', title: 'Tainan', startDateOffset: 3, duration: 3 }),
  ],
});

const baseProps = {
  trip,
  selectedItemId: null,
  onSelect: vi.fn(),
  onUpdateItems: vi.fn(),
  onAddActivity: vi.fn(),
  onAddCity: vi.fn(),
  pixelsPerDay: 60,
};

describe('timeline add buttons on view-only trips', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the horizontal lane and day add buttons for editors', () => {
    render(React.createElement(Timeline, { ...baseProps, readOnly: false }));

    expect(screen.getByRole('button', { name: 'Add city to end' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add transfer' })).toBeEnabled();
    // One "+" for the whole activities lane, like cities and transfers — not one per day.
    expect(screen.getAllByRole('button', { name: 'Add activity' })).toHaveLength(1);
    expect(screen.queryAllByRole('button', { name: /^Add activity for / })).toHaveLength(0);
  });

  it('adds an activity on the selected stay\'s first day, or on day 1 without a selection', () => {
    // Selecting a stay scrolls it into view, which jsdom does not implement.
    Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
    const onAddActivity = vi.fn();
    const { unmount } = render(React.createElement(Timeline, { ...baseProps, onAddActivity, readOnly: false }));
    screen.getByRole('button', { name: 'Add activity' }).click();
    expect(onAddActivity).toHaveBeenLastCalledWith(0);
    unmount();

    render(React.createElement(Timeline, { ...baseProps, onAddActivity, selectedItemId: 'city-2', readOnly: false }));
    screen.getByRole('button', { name: 'Add activity' }).click();
    expect(onAddActivity).toHaveBeenLastCalledWith(3);
  });

  it('renders no add buttons at all in the horizontal timeline when read-only', () => {
    render(React.createElement(Timeline, { ...baseProps, readOnly: true }));

    expect(screen.queryByRole('button', { name: 'Add city to end' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add transfer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add activity' })).toBeNull();
  });

  it('renders no add buttons in the vertical timeline when read-only', () => {
    const { unmount } = render(React.createElement(VerticalTimeline, { ...baseProps, readOnly: false }));
    expect(screen.getByRole('button', { name: 'Add transfer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add activity' })).toBeEnabled();
    unmount();

    render(React.createElement(VerticalTimeline, { ...baseProps, readOnly: true }));
    expect(screen.queryByRole('button', { name: 'Add transfer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add activity' })).toBeNull();
  });
});
