// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TripFloatingMapPreview } from '../../../components/tripview/TripFloatingMapPreview';

const makeRect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
} as DOMRect);

describe('components/tripview/TripFloatingMapPreview', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('re-syncs docked geometry when layout key changes without toggling dock mode', async () => {
    const mapViewportRef = { current: null as HTMLDivElement | null };
    const anchor = document.createElement('div');
    const dockedMapAnchorRef = { current: anchor as HTMLDivElement | null };
    let currentRect = makeRect(120, 84, 420, 360);
    vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => currentRect);

    const { rerender } = render(
      React.createElement(
        TripFloatingMapPreview,
        {
          mapDockMode: 'docked',
          mapViewportRef,
          dockedMapAnchorRef,
          dockedGeometryKey: 'horizontal:420',
          tripId: 'trip-1',
        },
        React.createElement('div', { 'data-testid': 'map-content' }, 'map'),
      ),
    );

    await waitFor(() => {
      expect(mapViewportRef.current?.style.width).toContain('420');
      expect(mapViewportRef.current?.style.height).toContain('360');
    });

    currentRect = makeRect(48, 96, 680, 300);
    act(() => {
      rerender(
        React.createElement(
          TripFloatingMapPreview,
          {
            mapDockMode: 'docked',
            mapViewportRef,
            dockedMapAnchorRef,
            dockedGeometryKey: 'vertical:680',
            tripId: 'trip-1',
          },
          React.createElement('div', { 'data-testid': 'map-content' }, 'map'),
        ),
      );
    });

    await waitFor(() => {
      expect(mapViewportRef.current?.style.width).toContain('680');
      expect(mapViewportRef.current?.style.height).toContain('300');
    });
  });
});
