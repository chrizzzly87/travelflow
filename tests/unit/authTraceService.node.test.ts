import { describe, expect, it } from 'vitest';
import {
  appendAuthTraceEntry,
  clearAuthTraceEntries,
  getAuthTraceEntries,
} from '../../services/authTraceService';

describe('services/authTraceService (node environment)', () => {
  it('returns empty entries and keeps no-op writes safe without window', () => {
    expect(getAuthTraceEntries()).toEqual([]);
    expect(() =>
      appendAuthTraceEntry({
        ts: '2026-01-01T00:00:00.000Z',
        flowId: 'flow-node',
        attemptId: 'attempt-node',
        step: 'node_safe',
        result: 'start',
      })
    ).not.toThrow();
    expect(() => clearAuthTraceEntries()).not.toThrow();
  });
});
