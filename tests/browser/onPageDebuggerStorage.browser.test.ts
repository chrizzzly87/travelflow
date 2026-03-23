// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  persistStoredDebuggerBoolean,
  persistStoredDebuggerString,
  readStoredDebuggerBoolean,
  readStoredDebuggerString,
} from '../../components/OnPageDebugger';

const KEY = 'tf_debug_auto_open';
const TAB_KEY = 'tf_debug_active_tab';

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

  it('reads and persists debugger tab strings with fallback behavior', () => {
    expect(readStoredDebuggerString(TAB_KEY, ['testing', 'maps', 'tracking', 'seo'], 'testing')).toBe('testing');

    persistStoredDebuggerString(TAB_KEY, 'maps', 'testing');
    expect(window.localStorage.getItem(TAB_KEY)).toBe('maps');
    expect(readStoredDebuggerString(TAB_KEY, ['testing', 'maps', 'tracking', 'seo'], 'testing')).toBe('maps');

    persistStoredDebuggerString(TAB_KEY, 'testing', 'testing');
    expect(window.localStorage.getItem(TAB_KEY)).toBeNull();
  });
});
