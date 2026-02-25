// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTripResizeControls } from '../../../components/tripview/useTripResizeControls';

const makeHookOptions = (
  overrides: Partial<Parameters<typeof useTripResizeControls>[0]> = {},
): Parameters<typeof useTripResizeControls>[0] => ({
  layoutMode: 'horizontal',
  timelineView: 'horizontal',
  horizontalTimelineDayCount: 10,
  clampZoomLevel: (value: number) => value,
  setZoomLevel: vi.fn(),
  sidebarWidth: 640,
  setSidebarWidth: vi.fn(),
  detailsWidth: 333.8,
  setDetailsWidth: vi.fn(),
  timelineHeight: 420,
  setTimelineHeight: vi.fn(),
  detailsPanelVisible: true,
  minSidebarWidth: 320,
  minTimelineHeight: 240,
  minBottomMapHeight: 200,
  minMapWidth: 420,
  minTimelineColumnWidth: 320,
  minDetailsWidth: 280,
  hardMinDetailsWidth: 220,
  resizerWidth: 6,
  resizeKeyboardStep: 16,
  horizontalTimelineAutoFitPadding: 64,
  basePixelsPerDay: 40,
  ...overrides,
});

describe('components/tripview/useTripResizeControls', () => {
  it('persists sidebar width when sidebar resizing ends', () => {
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({ sidebarWidth: 610 })));

    act(() => {
      result.current.startResizing('sidebar');
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(window.localStorage.getItem('tf_sidebar_width')).toBe('610');
  });

  it('persists details width when details resizing ends', () => {
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({ detailsWidth: 333.8 })));

    act(() => {
      result.current.startResizing('details', 100);
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(window.localStorage.getItem('tf_details_width')).toBe('334');
  });

  it('persists timeline height when timeline resizing ends', () => {
    const { result } = renderHook(() => useTripResizeControls(makeHookOptions({ timelineHeight: 455 })));

    act(() => {
      result.current.startResizing('timeline-h');
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(window.localStorage.getItem('tf_timeline_height')).toBe('455');
  });
});
