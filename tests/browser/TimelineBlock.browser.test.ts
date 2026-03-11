// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TimelineBlock } from '../../components/TimelineBlock';
import type { ITimelineItem } from '../../types';

const buildCityItem = (): ITimelineItem => ({
  id: 'city-1',
  type: 'city',
  title: 'Bangkok',
  startDateOffset: 0,
  duration: 3,
  color: 'border',
  description: '',
});

describe('components/TimelineBlock keyboard city navigation', () => {
  it('moves between selected city panels with arrow keys and tab, and toggles the details panel with enter or space', () => {
    const onNavigatePreviousCity = vi.fn();
    const onNavigateNextCity = vi.fn();
    const onToggleDetailsPanel = vi.fn();

    const { container } = render(
      React.createElement(TimelineBlock, {
        item: buildCityItem(),
        isSelected: true,
        isCity: true,
        isDetailsPanelVisible: true,
        pixelsPerDay: 120,
        onSelect: vi.fn(),
        onResizeStart: vi.fn(),
        onMoveStart: vi.fn(),
        onNavigatePreviousCity,
        onNavigateNextCity,
        onToggleDetailsPanel,
      }),
    );

    const cityBlock = container.querySelector<HTMLElement>('[data-city-id="city-1"]');
    expect(cityBlock).not.toBeNull();
    expect(cityBlock).toHaveAttribute('tabindex', '0');
    expect(cityBlock).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(cityBlock!, { key: 'ArrowRight' });
    fireEvent.keyDown(cityBlock!, { key: 'Tab' });
    fireEvent.keyDown(cityBlock!, { key: 'ArrowLeft' });
    fireEvent.keyDown(cityBlock!, { key: 'Tab', shiftKey: true });
    fireEvent.keyDown(cityBlock!, { key: 'Enter' });
    fireEvent.keyDown(cityBlock!, { key: ' ' });

    expect(onNavigateNextCity).toHaveBeenCalledTimes(2);
    expect(onNavigatePreviousCity).toHaveBeenCalledTimes(2);
    expect(onToggleDetailsPanel).toHaveBeenCalledTimes(2);
  });
});
