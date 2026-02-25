// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  persistStoredDebuggerBoolean,
  readStoredDebuggerBoolean,
} from '../../components/OnPageDebugger';

const KEY = 'tf_debug_auto_open';

describe('components/OnPageDebugger storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads persisted debug toggles with fallback behavior', () => {
    expect(readStoredDebuggerBoolean(KEY, false)).toBe(false);

    window.localStorage.setItem(KEY, '1');
    expect(readStoredDebuggerBoolean(KEY, false)).toBe(true);

    window.localStorage.setItem(KEY, '0');
    expect(readStoredDebuggerBoolean(KEY, true)).toBe(false);

    window.localStorage.setItem(KEY, 'invalid');
    expect(readStoredDebuggerBoolean(KEY, true)).toBe(true);
  });

  it('persists custom values and removes fallback-equivalent values', () => {
    persistStoredDebuggerBoolean(KEY, true, false);
    expect(window.localStorage.getItem(KEY)).toBe('1');

    persistStoredDebuggerBoolean(KEY, false, false);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
