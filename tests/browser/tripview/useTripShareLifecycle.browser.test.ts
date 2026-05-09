// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/db', () => ({
  DB_ENABLED: false,
}));

vi.mock('../../../services/dbApi', () => ({
  ensureDbSession: vi.fn(async () => null),
  dbSetTripSharingEnabled: vi.fn(async () => true),
  dbRevokeTripShares: vi.fn(async () => 0),
}));

import { useTripShareLifecycle } from '../../../components/tripview/useTripShareLifecycle';

const STORAGE_KEY = 'tf_share_links:trip-1';

describe('components/tripview/useTripShareLifecycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates stored share links and persists updates', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      view: 'https://example.com/view',
      edit: 'https://example.com/edit',
    }));

    const { result } = renderHook(() =>
      useTripShareLifecycle({
        tripId: 'trip-1',
        canShare: true,
        isTripLockedByExpiry: false,
      }),
    );

    expect(result.current.shareUrlsByMode).toEqual({
      view: 'https://example.com/view',
      edit: 'https://example.com/edit',
    });

    act(() => {
      result.current.setShareUrlsByMode({ view: 'https://example.com/new-view' });
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({
        view: 'https://example.com/new-view',
      }));
    });
  });

  it('clears stored links and closes share panel when trip becomes locked (db disabled mode)', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      view: 'https://example.com/view',
    }));

    const { result, rerender } = renderHook(
      ({ isTripLockedByExpiry }: { isTripLockedByExpiry: boolean }) => useTripShareLifecycle({
        tripId: 'trip-1',
        canShare: true,
        isTripLockedByExpiry,
      }),
      { initialProps: { isTripLockedByExpiry: false } },
    );

    act(() => {
      result.current.setIsShareOpen(true);
    });
    expect(result.current.isShareOpen).toBe(true);

    rerender({ isTripLockedByExpiry: true });

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{}');
    });
    await waitFor(() => {
      expect(result.current.isShareOpen).toBe(false);
      expect(result.current.shareUrlsByMode).toEqual({});
    });
  });

  it('hydrates the active trip links after the trip id changes without a reset effect', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      view: 'https://example.com/trip-1',
    }));
    window.localStorage.setItem('tf_share_links:trip-2', JSON.stringify({
      edit: 'https://example.com/trip-2-edit',
    }));

    const { result, rerender } = renderHook(
      ({ tripId }: { tripId: string }) => useTripShareLifecycle({
        tripId,
        canShare: true,
        isTripLockedByExpiry: false,
      }),
      { initialProps: { tripId: 'trip-1' } },
    );

    expect(result.current.shareUrlsByMode).toEqual({
      view: 'https://example.com/trip-1',
    });

    rerender({ tripId: 'trip-2' });

    expect(result.current.shareUrlsByMode).toEqual({
      edit: 'https://example.com/trip-2-edit',
    });

    act(() => {
      result.current.setShareUrlsByMode({ view: 'https://example.com/trip-2-view' });
    });

    expect(result.current.shareUrlsByMode).toEqual({
      view: 'https://example.com/trip-2-view',
    });
  });
});
