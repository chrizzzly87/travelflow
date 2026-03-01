// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TripFloatingMapPreview,
  resolveFloatingMapPresetWidths,
} from '../../../components/tripview/TripFloatingMapPreview';
import { readFloatingMapPreviewState, writeFloatingMapPreviewState } from '../../../components/tripview/floatingMapPreviewState';

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
    window.localStorage.clear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps floating map resize presets distinct at width clamp edges', () => {
    const minEdge = resolveFloatingMapPresetWidths(220);
    expect(minEdge.sm).toBeLessThan(minEdge.md);
    expect(minEdge.md).toBeLessThan(minEdge.lg);

    const maxEdge = resolveFloatingMapPresetWidths(420);
    expect(maxEdge.sm).toBeLessThan(maxEdge.md);
    expect(maxEdge.md).toBeLessThan(maxEdge.lg);
    expect(maxEdge.lg).toBe(420);
    expect(maxEdge.lg - maxEdge.sm).toBeGreaterThanOrEqual(90);
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

  it('keeps right and bottom edge anchoring when orientation is toggled from bottom-right', () => {
    const mapViewportRef = { current: null as HTMLDivElement | null };
    const dockedMapAnchorRef = { current: null as HTMLDivElement | null };

    render(
      React.createElement(
        TripFloatingMapPreview,
        {
          mapDockMode: 'floating',
          mapViewportRef,
          dockedMapAnchorRef,
          dockedGeometryKey: 'floating',
          tripId: 'trip-anchoring',
        },
        React.createElement('div', { 'data-testid': 'map-content' }, 'map'),
      ),
    );

    const toggleButton = document.querySelector('[data-testid=\"floating-map-orientation-toggle\"]') as HTMLButtonElement;
    expect(toggleButton).toBeTruthy();
    fireEvent.click(toggleButton);

    const state = readFloatingMapPreviewState();
    expect(state.orientation).toBe('landscape');
    expect(state.position).toBeTruthy();
    expect(state.sizePreset).toBe('lg');

    const baseWidth = Math.max(180, Math.min(420, window.innerWidth * 0.26));
    const shortEdge = resolveFloatingMapPresetWidths(baseWidth).lg;
    const expectedWidth = shortEdge * 1.5;
    const expectedHeight = shortEdge;
    const expectedX = Math.max(24, window.innerWidth - expectedWidth - 24);
    const expectedY = Math.max(92, window.innerHeight - expectedHeight - 24);

    expect(state.position?.x).toBeCloseTo(expectedX, 0);
    expect(state.position?.y).toBeCloseTo(expectedY, 0);
  });

  it('keeps bottom-right edge anchoring when viewport grows after resize', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    const mapViewportRef = { current: null as HTMLDivElement | null };
    const dockedMapAnchorRef = { current: null as HTMLDivElement | null };

    try {
      render(
        React.createElement(
          TripFloatingMapPreview,
          {
            mapDockMode: 'floating',
            mapViewportRef,
            dockedMapAnchorRef,
            dockedGeometryKey: 'floating',
            tripId: 'trip-resize-anchor',
          },
          React.createElement('div', { 'data-testid': 'map-content' }, 'map'),
        ),
      );

      const nextInnerWidth = originalInnerWidth + 320;
      const nextInnerHeight = originalInnerHeight + 240;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: nextInnerWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: nextInnerHeight });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const state = readFloatingMapPreviewState();
      expect(state.position).toBeTruthy();
      expect(state.sizePreset).toBe('lg');

      const baseWidth = Math.max(180, Math.min(420, nextInnerWidth * 0.26));
      const shortEdge = resolveFloatingMapPresetWidths(baseWidth).lg;
      const expectedWidth = shortEdge;
      const expectedHeight = shortEdge * 1.5;
      const expectedX = Math.max(24, nextInnerWidth - expectedWidth - 24);
      const expectedY = Math.max(92, nextInnerHeight - expectedHeight - 24);

      expect(state.position?.x).toBeCloseTo(expectedX, 0);
      expect(state.position?.y).toBeCloseTo(expectedY, 0);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    }
  });

  it('keeps bottom-center anchoring when viewport grows after resize', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    const mapViewportRef = { current: null as HTMLDivElement | null };
    const dockedMapAnchorRef = { current: null as HTMLDivElement | null };

    try {
      const initialBaseWidth = Math.max(180, Math.min(420, originalInnerWidth * 0.26));
      const initialShortEdge = resolveFloatingMapPresetWidths(initialBaseWidth).lg;
      const initialWidth = initialShortEdge;
      const initialHeight = initialShortEdge * 1.5;
      const initialX = 24 + ((Math.max(24, originalInnerWidth - initialWidth - 24) - 24) / 2);
      const initialY = Math.max(92, originalInnerHeight - initialHeight - 24);
      writeFloatingMapPreviewState({
        mode: 'floating',
        sizePreset: 'lg',
        orientation: 'portrait',
        position: { x: initialX, y: initialY },
      });

      render(
        React.createElement(
          TripFloatingMapPreview,
          {
            mapDockMode: 'floating',
            mapViewportRef,
            dockedMapAnchorRef,
            dockedGeometryKey: 'floating',
            tripId: 'trip-bottom-center-anchor',
          },
          React.createElement('div', { 'data-testid': 'map-content' }, 'map'),
        ),
      );

      const nextInnerWidth = originalInnerWidth + 360;
      const nextInnerHeight = originalInnerHeight + 220;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: nextInnerWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: nextInnerHeight });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const state = readFloatingMapPreviewState();
      expect(state.position).toBeTruthy();
      expect(state.sizePreset).toBe('lg');
      expect(state.orientation).toBe('portrait');

      const nextBaseWidth = Math.max(180, Math.min(420, nextInnerWidth * 0.26));
      const nextShortEdge = resolveFloatingMapPresetWidths(nextBaseWidth).lg;
      const nextWidth = nextShortEdge;
      const nextHeight = nextShortEdge * 1.5;
      const minX = 24;
      const maxX = Math.max(24, nextInnerWidth - nextWidth - 24);
      const expectedX = minX + ((maxX - minX) / 2);
      const expectedY = Math.max(92, nextInnerHeight - nextHeight - 24);

      expect(state.position?.x).toBeCloseTo(expectedX, 0);
      expect(state.position?.y).toBeCloseTo(expectedY, 0);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    }
  });
});
