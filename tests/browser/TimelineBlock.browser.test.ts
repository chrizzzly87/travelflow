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

const buildActivityItem = (id: string, duration: number, startDateOffset = 0): ITimelineItem => ({
  id,
  type: 'activity',
  title: 'Colosseum & Forum',
  startDateOffset,
  duration,
  color: 'border',
  description: '',
  activityType: ['culture'],
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

  it('renders horizontal activity cards as full touched-day spans with roomier sizing', () => {
    const compact = render(
      React.createElement(TimelineBlock, {
        item: buildActivityItem('activity-compact', 0.5, 1.4),
        isSelected: false,
        pixelsPerDay: 40,
        onSelect: vi.fn(),
        onResizeStart: vi.fn(),
        onMoveStart: vi.fn(),
      }),
    );

    const compactBlock = compact.container.querySelector<HTMLElement>('.timeline-block-item');
    const compactContent = compact.container.querySelector<HTMLElement>('.timeline-block-item > div');
    const compactRotatedFrame = Array.from(compact.container.querySelectorAll<HTMLElement>('.timeline-block-item div'))
      .find((element) => element.style.transform.includes('rotate(-90deg)'));
    const compactTitle = compact.container.querySelector<HTMLElement>('.timeline-block-item span');

    expect(compactBlock?.style.left).toBe('40px');
    expect(compactBlock?.style.width).toBe('40px');
    expect(compactBlock?.style.height).toBe('160px');
    expect(compactContent?.className).toContain('relative');
    expect(compactRotatedFrame?.style.transform).toContain('rotate(-90deg)');
    expect(compactRotatedFrame?.style.width).toBe('128px');
    expect(compactRotatedFrame?.style.height).toBe('32px');
    expect(compactTitle?.className).toContain('w-full');
    expect(Number.parseFloat(compactTitle?.style.fontSize || '0')).toBeGreaterThanOrEqual(11);

    compact.unmount();

    const regular = render(
      React.createElement(TimelineBlock, {
        item: buildActivityItem('activity-regular', 0.4, 3.2),
        isSelected: false,
        pixelsPerDay: 120,
        onSelect: vi.fn(),
        onResizeStart: vi.fn(),
        onMoveStart: vi.fn(),
      }),
    );

    const regularBlock = regular.container.querySelector<HTMLElement>('.timeline-block-item');
    const regularContent = regular.container.querySelector<HTMLElement>('.timeline-block-item > div');
    const regularTitle = regular.container.querySelector<HTMLElement>('.timeline-block-item span');

    expect(regularBlock?.style.left).toBe('360px');
    expect(regularBlock?.style.width).toBe('120px');
    expect(regularBlock?.style.height).toBe('112px');
    expect(regularContent?.className).toContain('justify-start');
    expect(regularTitle?.className).toContain('text-[15px]');
  });
});
