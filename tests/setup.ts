import { afterEach, vi } from 'vitest';
import { resetInitialRouteHandoffCompletedForTests } from '../services/marketingRouteShellState';

afterEach(() => {
  vi.useRealTimers();
  resetInitialRouteHandoffCompletedForTests();
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
});
