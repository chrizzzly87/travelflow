// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTripCopyNoticeToast } from '../../../components/tripview/useTripCopyNoticeToast';

describe('components/tripview/useTripCopyNoticeToast', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows copied toast for matching trip payload and clears session key', async () => {
    window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
      tripId: 'trip-1',
      sourceTitle: 'Summer Plan',
    }));

    const showToast = vi.fn();
    renderHook(() => useTripCopyNoticeToast({ tripId: 'trip-1', showToast }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Copied "Summer Plan"', { tone: 'add', title: 'Copied' });
    });
    expect(window.sessionStorage.getItem('tf_trip_copy_notice')).toBeNull();
  });

  it('ignores payload for a different trip and keeps the key untouched', async () => {
    window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
      tripId: 'trip-2',
      sourceTitle: 'Another Trip',
    }));

    const showToast = vi.fn();
    renderHook(() => useTripCopyNoticeToast({ tripId: 'trip-1', showToast }));

    await waitFor(() => {
      expect(showToast).not.toHaveBeenCalled();
    });
    expect(window.sessionStorage.getItem('tf_trip_copy_notice')).not.toBeNull();
  });

  it('clears malformed payloads defensively', async () => {
    window.sessionStorage.setItem('tf_trip_copy_notice', '{bad-json');

    const showToast = vi.fn();
    renderHook(() => useTripCopyNoticeToast({ tripId: 'trip-1', showToast }));

    await waitFor(() => {
      expect(window.sessionStorage.getItem('tf_trip_copy_notice')).toBeNull();
    });
    expect(showToast).not.toHaveBeenCalled();
  });
});
