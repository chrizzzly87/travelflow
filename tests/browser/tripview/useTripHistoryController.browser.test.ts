// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripHistoryController } from '../../../components/tripview/useTripHistoryController';

const historyServiceMocks = vi.hoisted(() => ({
  getHistoryEntries: vi.fn(),
  findHistoryEntryByUrl: vi.fn(),
}));

vi.mock('../../../services/historyService', () => ({
  getHistoryEntries: historyServiceMocks.getHistoryEntries,
  findHistoryEntryByUrl: historyServiceMocks.findHistoryEntryByUrl,
}));

describe('components/tripview/useTripHistoryController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyServiceMocks.getHistoryEntries.mockReturnValue([]);
    historyServiceMocks.findHistoryEntryByUrl.mockReturnValue(null);
    window.history.replaceState({}, '', '/trip/trip-1');
  });

  it('does not force-navigate back to trip when browser back leaves trip routes', () => {
    const navigate = vi.fn();
    const showToast = vi.fn();
    const suppressCommitRef = { current: false };

    renderHook(() => useTripHistoryController({
      tripId: 'trip-1',
      tripUpdatedAt: Date.now(),
      locationPathname: '/trip/trip-1',
      currentUrl: '/trip/trip-1',
      isExamplePreview: false,
      navigate,
      suppressCommitRef,
      stripHistoryPrefix: (label) => label,
      showToast,
    }));

    act(() => {
      window.history.pushState({}, '', '/u/chrizzzly');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
