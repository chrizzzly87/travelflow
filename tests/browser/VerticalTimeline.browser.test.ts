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

  it('shows a compact horizontal weekday-date row and a month rail at very small zoom levels', () => {
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

    expect(screen.getByLabelText('March')).toBeInTheDocument();
    expect(screen.getByLabelText('April')).toBeInTheDocument();
    expect(container.querySelector('[class*=\"gap-1.5\"]')).not.toBeNull();
  });
});
