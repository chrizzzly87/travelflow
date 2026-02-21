import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
});
