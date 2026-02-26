// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearConnectivityOverride,
  getConnectivitySnapshot,
  markConnectivityFailure,
  markConnectivitySuccess,
  parseConnectivityOverrideFromSearch,
  setConnectivityOverride,
} from '../../services/supabaseHealthMonitor';

describe('services/supabaseHealthMonitor', () => {
  beforeEach(() => {
    clearConnectivityOverride();
    markConnectivitySuccess('test_reset');
  });

  it('parses outage override query parameter values', () => {
    expect(parseConnectivityOverrideFromSearch('?offline=true')).toBe('offline');
    expect(parseConnectivityOverrideFromSearch('?offline=offline')).toBe('offline');
    expect(parseConnectivityOverrideFromSearch('?offline=degraded')).toBe('degraded');
    expect(parseConnectivityOverrideFromSearch('?offline=false')).toBe('clear');
    expect(parseConnectivityOverrideFromSearch('?offline=online')).toBe('clear');
    expect(parseConnectivityOverrideFromSearch('?foo=bar')).toBeNull();
  });

  it('supports forced connectivity override and clearing', () => {
    const forced = setConnectivityOverride('offline');
    expect(forced.state).toBe('offline');
    expect(forced.isForced).toBe(true);
    expect(forced.forcedState).toBe('offline');

    const cleared = clearConnectivityOverride();
    expect(cleared.isForced).toBe(false);
    expect(cleared.forcedState).toBeNull();
  });

  it('moves through degraded/offline states on repeated failures', () => {
    markConnectivityFailure(new Error('network timeout'), {
      source: 'test',
      operation: 'fetch',
    });
    expect(getConnectivitySnapshot().state).toBe('degraded');

    markConnectivityFailure(new Error('network timeout'), {
      source: 'test',
      operation: 'fetch',
    });
    expect(getConnectivitySnapshot().state).toBe('offline');

    markConnectivitySuccess('health_ok');
    expect(getConnectivitySnapshot().state).toBe('online');
    expect(getConnectivitySnapshot().consecutiveFailures).toBe(0);
  });
});
