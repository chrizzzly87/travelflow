// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  appendClientErrorLog,
  clearClientErrorLogBuffer,
  getClientErrorLogBuffer,
} from '../../services/clientErrorLogger';

describe('services/clientErrorLogger', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearClientErrorLogBuffer();
  });

  it('appends normalized client error entries to ring buffer', () => {
    appendClientErrorLog({
      errorType: 'supabase_upsert_trip',
      error: new Error('Failed to fetch'),
      route: '/trip/123',
      tripId: 'trip-123',
      connectivityState: 'offline',
    });

    const entries = getClientErrorLogBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].errorType).toBe('supabase_upsert_trip');
    expect(entries[0].message).toContain('Failed to fetch');
    expect(entries[0].route).toBe('/trip/123');
    expect(entries[0].tripId).toBe('trip-123');
    expect(entries[0].connectivityState).toBe('offline');
    expect(typeof entries[0].timestamp).toBe('string');
  });

  it('keeps newest entries first', () => {
    appendClientErrorLog({
      errorType: 'one',
      error: { message: 'one' },
      route: '/one',
      connectivityState: 'degraded',
    });
    appendClientErrorLog({
      errorType: 'two',
      error: { message: 'two' },
      route: '/two',
      connectivityState: 'online',
    });

    const entries = getClientErrorLogBuffer();
    expect(entries[0].errorType).toBe('two');
    expect(entries[1].errorType).toBe('one');
  });
});
