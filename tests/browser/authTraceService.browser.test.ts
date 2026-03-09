// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendAuthTraceEntry,
  clearAuthTraceEntries,
  getAuthTraceEntries,
} from '../../services/authTraceService';

const createEntry = (index: number) => ({
  ts: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
  flowId: `flow-${index}`,
  attemptId: `attempt-${index}`,
  step: 'oauth_callback',
  result: 'start' as const,
  provider: 'google',
});

describe('services/authTraceService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuthTraceEntries();
  });

  it('appends and reads auth trace entries', () => {
    appendAuthTraceEntry(createEntry(1));
    appendAuthTraceEntry(createEntry(2));

    const entries = getAuthTraceEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].attemptId).toBe('attempt-1');
    expect(entries[1].attemptId).toBe('attempt-2');
  });

  it('clears auth trace entries', () => {
    appendAuthTraceEntry(createEntry(1));
    clearAuthTraceEntries();

    expect(getAuthTraceEntries()).toEqual([]);
  });

  it('keeps only the most recent bounded auth trace history', () => {
    for (let index = 0; index < 180; index += 1) {
      appendAuthTraceEntry(createEntry(index));
    }

    const entries = getAuthTraceEntries();
    expect(entries).toHaveLength(150);
    expect(entries[0].attemptId).toBe('attempt-30');
    expect(entries[149].attemptId).toBe('attempt-179');
  });
});
