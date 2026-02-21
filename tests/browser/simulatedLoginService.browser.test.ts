// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  SIMULATED_LOGIN_DEBUG_EVENT,
  SIMULATED_LOGIN_STORAGE_KEY,
  isSimulatedLoggedIn,
  setSimulatedLoggedIn,
  toggleSimulatedLogin,
} from '../../services/simulatedLoginService';

describe('services/simulatedLoginService', () => {
  it('defaults to logged out', () => {
    expect(isSimulatedLoggedIn()).toBe(false);
  });

  it('persists override and emits debug events', () => {
    const listener = vi.fn();
    window.addEventListener(SIMULATED_LOGIN_DEBUG_EVENT, listener as EventListener);

    expect(setSimulatedLoggedIn(true)).toBe(true);
    expect(isSimulatedLoggedIn()).toBe(true);
    expect(window.localStorage.getItem(SIMULATED_LOGIN_STORAGE_KEY)).toBe('1');

    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ available: true, loggedIn: true });

    expect(setSimulatedLoggedIn(false)).toBe(false);
    expect(window.localStorage.getItem(SIMULATED_LOGIN_STORAGE_KEY)).toBeNull();

    window.removeEventListener(SIMULATED_LOGIN_DEBUG_EVENT, listener as EventListener);
  });

  it('toggles state with and without force flag', () => {
    setSimulatedLoggedIn(false);
    expect(toggleSimulatedLogin()).toBe(true);
    expect(toggleSimulatedLogin(false)).toBe(false);
    expect(toggleSimulatedLogin(true)).toBe(true);
  });
});
