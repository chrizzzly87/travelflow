import { afterEach, vi } from 'vitest';
import { resetInitialRouteHandoffCompletedForTests } from '../services/marketingRouteShellState';

if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'Vitest Node',
    },
  });
}

const memoryStorageEntries = new WeakMap<Storage, Map<string, string>>();

const installMemoryStoragePrototype = () => {
  if (typeof window === 'undefined' || typeof window.Storage === 'undefined') return false;
  const prototype = window.Storage.prototype as Storage & { __travelflowMemoryStoragePatched?: boolean };
  if (prototype.__travelflowMemoryStoragePatched) return true;

  const getStore = (storage: Storage) => {
    let store = memoryStorageEntries.get(storage);
    if (!store) {
      store = new Map<string, string>();
      memoryStorageEntries.set(storage, store);
    }
    return store;
  };

  Object.defineProperties(prototype, {
    __travelflowMemoryStoragePatched: {
      configurable: true,
      value: true,
    },
    length: {
      configurable: true,
      get() {
        return getStore(this as Storage).size;
      },
    },
    clear: {
      configurable: true,
      value() {
        getStore(this as Storage).clear();
      },
    },
    getItem: {
      configurable: true,
      value(key: string) {
        return getStore(this as Storage).get(String(key)) ?? null;
      },
    },
    key: {
      configurable: true,
      value(index: number) {
        return Array.from(getStore(this as Storage).keys())[index] ?? null;
      },
    },
    removeItem: {
      configurable: true,
      value(key: string) {
        getStore(this as Storage).delete(String(key));
      },
    },
    setItem: {
      configurable: true,
      value(key: string, value: string) {
        getStore(this as Storage).set(String(key), String(value));
      },
    },
  });

  return true;
};

const createMemoryStorage = (): Storage => {
  if (!installMemoryStoragePrototype()) {
    throw new Error('Missing Storage constructor in browser test environment');
  }
  const storage = Object.create(window.Storage.prototype) as Storage;
  memoryStorageEntries.set(storage, new Map<string, string>());
  return storage;
};

const ensureWindowStorage = (name: 'localStorage' | 'sessionStorage') => {
  if (typeof window === 'undefined') return;
  try {
    if (window[name]) return;
  } catch {
    // Some environments expose storage accessors that throw for opaque origins.
  }
  Object.defineProperty(window, name, {
    configurable: true,
    value: createMemoryStorage(),
  });
};

ensureWindowStorage('localStorage');
ensureWindowStorage('sessionStorage');

afterEach(() => {
  vi.useRealTimers();
  resetInitialRouteHandoffCompletedForTests();
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
});
