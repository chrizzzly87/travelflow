import { afterEach, describe, expect, it, vi } from 'vitest';

const unsetWindow = () => {
  delete (globalThis as { window?: unknown }).window;
};

afterEach(() => {
  vi.resetModules();
  unsetWindow();
});

describe('services/simulatedLoginService (node environment)', () => {
  it('manages in-memory override without browser storage', async () => {
    unsetWindow();
    const { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin } = await import('../../services/simulatedLoginService');
    expect(isSimulatedLoggedIn()).toBe(false);
    expect(setSimulatedLoggedIn(true)).toBe(true);
    expect(isSimulatedLoggedIn()).toBe(true);
    expect(toggleSimulatedLogin(false)).toBe(false);
  });

  it('re-reads browser storage changes on every check', async () => {
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };

    (globalThis as { window?: unknown }).window = {
      localStorage,
    } as unknown;

    const { isSimulatedLoggedIn } = await import('../../services/simulatedLoginService');

    expect(isSimulatedLoggedIn()).toBe(false);
    localStorage.setItem('tf_debug_simulated_login', '1');
    expect(isSimulatedLoggedIn()).toBe(true);
    localStorage.removeItem('tf_debug_simulated_login');
    expect(isSimulatedLoggedIn()).toBe(false);
  });
});
