// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  TRIP_EXPIRY_DEBUG_EVENT,
  getDebugTripExpiredOverride,
  setDebugTripExpiredOverride,
} from '../../config/paywall';

describe('config/paywall debug overrides', () => {
  it('persists and clears debug expired override', () => {
    expect(getDebugTripExpiredOverride('trip-1')).toBeNull();

    setDebugTripExpiredOverride('trip-1', true);
    expect(getDebugTripExpiredOverride('trip-1')).toBe(true);

    setDebugTripExpiredOverride('trip-1', false);
    expect(getDebugTripExpiredOverride('trip-1')).toBe(false);

    setDebugTripExpiredOverride('trip-1', null);
    expect(getDebugTripExpiredOverride('trip-1')).toBeNull();
  });

  it('dispatches debug event payload on override updates', () => {
    const listener = vi.fn();
    window.addEventListener(TRIP_EXPIRY_DEBUG_EVENT, listener as EventListener);

    setDebugTripExpiredOverride('trip-2', true);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ tripId: 'trip-2', expired: true });

    window.removeEventListener(TRIP_EXPIRY_DEBUG_EVENT, listener as EventListener);
  });
});
