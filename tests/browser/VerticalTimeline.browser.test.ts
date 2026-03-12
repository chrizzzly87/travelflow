// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { VerticalTimeline } from '../../components/VerticalTimeline';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

describe('components/VerticalTimeline', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows centered full month labels when the visible month span is large enough', () => {
    const trip = makeTrip({
      startDate: '2026-03-28',
      items: [
        makeCityItem({
          id: 'city-1',
          title: 'Manila',
          startDateOffset: 0,
          duration: 8,
        }),
      ],
    });

    const { container } = render(
      React.createElement(VerticalTimeline, {
        trip,
        selectedItemId: null,
        onSelect: vi.fn(),
        onUpdateItems: vi.fn(),
        onAddActivity: vi.fn(),
        onAddCity: vi.fn(),
        pixelsPerDay: 24,
      }),
    );

    expect(screen.getByLabelText('March')).toHaveTextContent('March');
    expect(screen.getByLabelText('April')).toHaveTextContent('April');
    expect(container.querySelector('[class*=\"gap-1.5\"]')).not.toBeNull();
  });

  it('falls back to the short month label when the visible month span is too small for the full name', () => {
    const trip = makeTrip({
      startDate: '2026-03-31',
      items: [
        makeCityItem({
          id: 'city-1',
          title: 'Manila',
          startDateOffset: 0,
          duration: 2,
        }),
      ],
    });

    render(
      React.createElement(VerticalTimeline, {
        trip,
        selectedItemId: null,
        onSelect: vi.fn(),
        onUpdateItems: vi.fn(),
        onAddActivity: vi.fn(),
        onAddCity: vi.fn(),
        pixelsPerDay: 18,
      }),
    );

    expect(screen.getByLabelText('March')).toHaveTextContent('Mar');
    expect(screen.getByLabelText('April')).toHaveTextContent('Apr');
  });
});
