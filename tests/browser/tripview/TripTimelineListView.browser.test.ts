// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripTimelineListView } from '../../../components/tripview/TripTimelineListView';
import { makeActivityItem, makeCityItem, makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

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

describe('components/tripview/TripTimelineListView', () => {
  it('renders timeline interactions with hover affordances and analytics events', () => {
    analyticsMocks.trackEvent.mockReset();

    const travel = makeTravelItem('travel-a-b', 2.05, 'Morning transfer');
    travel.description = 'Transfer from **Kabul** to _Herat_.';

    const activity = makeActivityItem('activity-b-1', 'Herat', 2.5);
    activity.title = 'Citadel of Herat';
    activity.description = 'Visit the **Citadel** and [book ahead](https://example.com).';

    const heratCity = makeCityItem({ id: 'city-b', title: 'Herat', startDateOffset: 2.3, duration: 2, color: 'bg-amber-400' });
    heratCity.countryName = 'Iran';
    heratCity.description = 'Historic center with **old citadel walls**.';
    const kabulCity = makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' });
    kabulCity.countryName = 'Afghanistan';

    const trip = makeTrip({
      startDate: '2026-03-01',
      items: [
        kabulCity,
        travel,
        heratCity,
        makeActivityItem('activity-a-1', 'Kabul', 0.5),
        activity,
      ],
    });

    const onSelect = vi.fn();

    const { rerender } = render(
      React.createElement(TripTimelineListView, {
        trip,
        selectedItemId: null,
        onSelect,
      }),
    );

    const transferButton = screen.getByLabelText('Open Train transfer details');
    expect(transferButton).toBeInTheDocument();
    expect(transferButton).toHaveAttribute('data-tf-track-event', 'trip_view__timeline_transfer--open');

    fireEvent.click(transferButton);
    expect(onSelect).toHaveBeenCalledWith('travel-a-b');
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__timeline_transfer--open', {
      trip_id: 'trip-1',
      item_id: 'travel-a-b',
      city_id: 'city-b',
      mode: 'train',
    });

    rerender(
      React.createElement(TripTimelineListView, {
        trip,
        selectedItemId: 'travel-a-b',
        onSelect,
      }),
    );
    expect(screen.getByLabelText('Open Train transfer details')).toHaveClass('ring-2');
    expect(screen.getByLabelText('Open Train transfer details')).toHaveClass('border-accent-500');

    const cityButton = screen.getByRole('heading', { name: 'Herat' }).closest('button');
    if (!cityButton) {
      throw new Error('Expected Herat heading button to exist');
    }
    fireEvent.click(cityButton);
    expect(onSelect).toHaveBeenCalledWith('city-b', { isCity: true });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__timeline_city--open', {
      trip_id: 'trip-1',
      city_id: 'city-b',
    });

    expect(screen.queryByText('From Kabul via Train')).not.toBeInTheDocument();
    expect(screen.getByText('old citadel walls', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('**Citadel**')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'book ahead' })).toHaveAttribute('href', 'https://example.com');

    const heratHeading = screen.getByRole('heading', { name: 'Herat' });
    expect(heratHeading.closest('header')).toHaveClass('sticky');
    expect(screen.getByText('old citadel walls', { exact: false }).closest('header')).toBeNull();

    expect(screen.getByText('Iran')).toBeInTheDocument();

    const activityTitle = screen.getByText('Citadel of Herat');
    expect(activityTitle).toHaveClass('cursor-pointer');
    expect(activityTitle.className).toContain('group-hover:underline');
    expect(activityTitle.className).toContain('group-hover:translate-x-1');

    fireEvent.click(activityTitle);
    expect(onSelect).toHaveBeenCalledWith('activity-b-1');
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__timeline_activity--open', {
      trip_id: 'trip-1',
      item_id: 'activity-b-1',
      city_id: 'city-b',
    });
  });

  it('selects the active city when scrolling into a new section', () => {
    const kabulCity = makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' });
    const heratCity = makeCityItem({ id: 'city-b', title: 'Herat', startDateOffset: 2.2, duration: 2, color: 'bg-amber-400' });
    const trip = makeTrip({
      startDate: '2026-03-01',
      items: [kabulCity, makeTravelItem('travel-a-b', 2.05, 'Morning transfer'), heratCity],
    });
    const onSelect = vi.fn();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    try {
      const { container } = render(
        React.createElement(TripTimelineListView, {
          trip,
          selectedItemId: 'city-a',
          onSelect,
        }),
      );

      const viewport = container.querySelector('.h-full.overflow-y-auto') as HTMLDivElement | null;
      expect(viewport).not.toBeNull();

      const cityASection = container.querySelector('[data-city-section-id="city-a"]') as HTMLElement | null;
      const cityBSection = container.querySelector('[data-city-section-id="city-b"]') as HTMLElement | null;
      expect(cityASection).not.toBeNull();
      expect(cityBSection).not.toBeNull();

      if (!viewport || !cityASection || !cityBSection) {
        throw new Error('Expected viewport and city sections to render');
      }

      Object.defineProperty(viewport, 'clientHeight', {
        configurable: true,
        value: 600,
      });
      viewport.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 900,
        bottom: 600,
        width: 900,
        height: 600,
        toJSON: () => ({}),
      })) as any;
      cityASection.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: -260,
        top: -260,
        left: 0,
        right: 900,
        bottom: 120,
        width: 900,
        height: 380,
        toJSON: () => ({}),
      })) as any;
      cityBSection.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 40,
        top: 40,
        left: 0,
        right: 900,
        bottom: 420,
        width: 900,
        height: 380,
        toJSON: () => ({}),
      })) as any;

      fireEvent.wheel(viewport);
      fireEvent.scroll(viewport);

      expect(onSelect).toHaveBeenCalledWith('city-b', { isCity: true });
    } finally {
      rafSpy.mockRestore();
      cancelRafSpy.mockRestore();
    }
  });

  it('does not auto-select a city while scrolling when no details panel is open', () => {
    const kabulCity = makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' });
    const heratCity = makeCityItem({ id: 'city-b', title: 'Herat', startDateOffset: 2.2, duration: 2, color: 'bg-amber-400' });
    const trip = makeTrip({
      startDate: '2026-03-01',
      items: [kabulCity, makeTravelItem('travel-a-b', 2.05, 'Morning transfer'), heratCity],
    });
    const onSelect = vi.fn();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    try {
      const { container } = render(
        React.createElement(TripTimelineListView, {
          trip,
          selectedItemId: null,
          onSelect,
        }),
      );

      const viewport = container.querySelector('.h-full.overflow-y-auto') as HTMLDivElement | null;
      const cityASection = container.querySelector('[data-city-section-id="city-a"]') as HTMLElement | null;
      const cityBSection = container.querySelector('[data-city-section-id="city-b"]') as HTMLElement | null;
      if (!viewport || !cityASection || !cityBSection) {
        throw new Error('Expected viewport and city sections to render');
      }

      Object.defineProperty(viewport, 'clientHeight', {
        configurable: true,
        value: 600,
      });
      viewport.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 900,
        bottom: 600,
        width: 900,
        height: 600,
        toJSON: () => ({}),
      })) as any;
      cityASection.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: -260,
        top: -260,
        left: 0,
        right: 900,
        bottom: 120,
        width: 900,
        height: 380,
        toJSON: () => ({}),
      })) as any;
      cityBSection.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 40,
        top: 40,
        left: 0,
        right: 900,
        bottom: 420,
        width: 900,
        height: 380,
        toJSON: () => ({}),
      })) as any;

      fireEvent.wheel(viewport);
      fireEvent.scroll(viewport);

      expect(onSelect).not.toHaveBeenCalled();
    } finally {
      rafSpy.mockRestore();
      cancelRafSpy.mockRestore();
    }
  });

  it('auto-scrolls to the selected item when opening timeline list with an existing selection', () => {
    const kabulCity = makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' });
    const activity = makeActivityItem('activity-a-1', 'Kabul', 0.5);
    activity.title = 'Museum visit';
    const trip = makeTrip({
      startDate: '2026-03-01',
      items: [kabulCity, activity],
    });
    const onSelect = vi.fn();
    const scrollSpy = vi.fn();

    const { container, rerender } = render(
      React.createElement(TripTimelineListView, {
        trip,
        selectedItemId: 'city-a',
        onSelect,
      }),
    );

    const activityMarker = container.querySelector('[data-activity-marker-id="activity-a-1"]') as HTMLElement | null;
    const viewport = container.querySelector('.h-full.overflow-y-auto') as HTMLDivElement | null;
    if (!activityMarker || !viewport) {
      throw new Error('Expected selected activity marker and viewport to render');
    }

    viewport.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 900,
      bottom: 300,
      width: 900,
      height: 300,
      toJSON: () => ({}),
    })) as any;
    activityMarker.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 640,
      top: 640,
      left: 0,
      right: 900,
      bottom: 720,
      width: 900,
      height: 80,
      toJSON: () => ({}),
    })) as any;
    (activityMarker as any).scrollIntoView = scrollSpy;

    rerender(
      React.createElement(TripTimelineListView, {
        trip,
        selectedItemId: 'activity-a-1',
        onSelect,
      }),
    );

    expect(scrollSpy).toHaveBeenCalled();
  });

  it('renders today pills with red uppercase styling', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

    try {
      const city = makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' });
      const trip = makeTrip({
        startDate: '2026-03-01',
        items: [city, makeActivityItem('activity-a-1', 'Kabul', 0.5)],
      });
      render(
        React.createElement(TripTimelineListView, {
          trip,
          selectedItemId: null,
          onSelect: vi.fn(),
        }),
      );

      const todayPills = screen.getAllByText('Today');
      expect(todayPills.length).toBeGreaterThan(0);
      for (const pill of todayPills) {
        expect(pill).toHaveClass('uppercase');
        expect(pill).toHaveClass('text-red-700');
        expect(pill).toHaveClass('bg-red-50');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('smooth-scrolls to today marker on initial load when today is out of view', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));

    const domRect = (
      top: number,
      bottom: number,
      left = 0,
      right = 900,
      width = 900,
      height = bottom - top,
    ): DOMRect => ({
      x: left,
      y: top,
      top,
      bottom,
      left,
      right,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect);

    const previousScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    const scrollIntoViewSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewSpy,
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(this: HTMLElement) {
      if (this.classList.contains('h-full') && this.classList.contains('overflow-y-auto')) {
        return domRect(0, 320);
      }
      if (this.dataset.cityMarkerId === 'city-a') {
        return domRect(640, 660);
      }
      return domRect(0, 0, 0, 0, 0, 0);
    });

    try {
      const city = makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 3, color: 'bg-rose-400' });
      const trip = makeTrip({
        startDate: '2026-03-01',
        items: [city, makeActivityItem('activity-a-1', 'Kabul', 0.5)],
      });

      render(
        React.createElement(TripTimelineListView, {
          trip,
          selectedItemId: null,
          onSelect: vi.fn(),
        }),
      );

      expect(scrollIntoViewSpy).toHaveBeenCalled();
    } finally {
      rectSpy.mockRestore();
      if (previousScrollIntoViewDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previousScrollIntoViewDescriptor);
      } else {
        delete (HTMLElement.prototype as HTMLElement & { scrollIntoView?: unknown }).scrollIntoView;
      }
      vi.useRealTimers();
    }
  });
});
