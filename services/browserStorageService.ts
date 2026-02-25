import {
  COOKIE_REGISTRY,
  type CookieCategory,
  type CookieDefinition,
  doesRegistryNameMatch,
} from '../lib/legal/cookies.config';
import { isOptionalConsentGranted, readConsentChoiceFromStorage } from './consentState';

export type BrowserStorageMedium = 'localStorage' | 'sessionStorage';

export interface RegisteredStorageEntry {
  category: CookieCategory;
  definition: CookieDefinition;
}

const CATEGORIES: CookieCategory[] = ['essential', 'analytics', 'marketing'];
const OPTIONAL_CATEGORIES: CookieCategory[] = ['analytics', 'marketing'];
const isDevRuntime = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

const warnPolicy = (message: string) => {
  if (!isDevRuntime) return;
  console.warn(`[browserStoragePolicy] ${message}`);
};

const getStorage = (medium: BrowserStorageMedium): Storage | null => {
  if (typeof window === 'undefined') return null;
  return medium === 'localStorage' ? window.localStorage : window.sessionStorage;
};

const resolveRegisteredEntry = (
  keyName: string,
  medium: BrowserStorageMedium,
): RegisteredStorageEntry | null => {
  const supportsMedium = (entry: CookieDefinition): boolean => (
    entry.storage === medium || Boolean(entry.storageFallbacks?.includes(medium))
  );

  for (const category of CATEGORIES) {
    const match = COOKIE_REGISTRY[category].find((entry) =>
      supportsMedium(entry) && doesRegistryNameMatch(entry.name, keyName));
    if (match) {
      return {
        category,
        definition: match,
      };
    }
  }
  return null;
};

const isCategoryAllowed = (category: CookieCategory): boolean => {
  if (category === 'essential') return true;
  return isOptionalConsentGranted(readConsentChoiceFromStorage());
};

const removeByRegistryPattern = (storage: Storage, registryName: string): number => {
  if (!registryName.includes('*')) {
    const existed = storage.getItem(registryName) !== null;
    storage.removeItem(registryName);
    return existed ? 1 : 0;
  }

  let removed = 0;
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (!doesRegistryNameMatch(registryName, key)) continue;
    storage.removeItem(key);
    removed += 1;
  }
  return removed;
};

export const getRegisteredStorageEntry = (
  keyName: string,
  medium: BrowserStorageMedium,
): RegisteredStorageEntry | null => resolveRegisteredEntry(keyName, medium);

export const readBrowserStorageItem = (
  medium: BrowserStorageMedium,
  keyName: string,
): string | null => {
  const storage = getStorage(medium);
  if (!storage) return null;

  const registered = resolveRegisteredEntry(keyName, medium);
  if (!registered) {
    warnPolicy(`Blocked read for unregistered ${medium} key "${keyName}"`);
    return null;
  }
  if (!isCategoryAllowed(registered.category)) return null;

  try {
    return storage.getItem(keyName);
  } catch {
    return null;
  }
};

export const writeBrowserStorageItem = (
  medium: BrowserStorageMedium,
  keyName: string,
  value: string,
): boolean => {
  const storage = getStorage(medium);
  if (!storage) return false;

  const registered = resolveRegisteredEntry(keyName, medium);
  if (!registered) {
    warnPolicy(`Blocked write for unregistered ${medium} key "${keyName}"`);
    return false;
  }
  if (!isCategoryAllowed(registered.category)) return false;

  try {
    storage.setItem(keyName, value);
    return true;
  } catch {
    return false;
  }
};

export const removeBrowserStorageItem = (
  medium: BrowserStorageMedium,
  keyName: string,
): boolean => {
  const storage = getStorage(medium);
  if (!storage) return false;

  const registered = resolveRegisteredEntry(keyName, medium);
  if (!registered) {
    warnPolicy(`Blocked remove for unregistered ${medium} key "${keyName}"`);
    return false;
  }

  try {
    storage.removeItem(keyName);
    return true;
  } catch {
    return false;
  }
};

export const purgeOptionalBrowserStorage = (): number => {
  let removedCount = 0;
  for (const category of OPTIONAL_CATEGORIES) {
    for (const entry of COOKIE_REGISTRY[category]) {
      const candidateMedia = [
        entry.storage,
        ...(entry.storageFallbacks ?? []),
      ];
      const media = [...new Set(candidateMedia)].filter(
        (value): value is BrowserStorageMedium => value === 'localStorage' || value === 'sessionStorage',
      );
      for (const medium of media) {
        const storage = getStorage(medium);
        if (!storage) continue;
        try {
          removedCount += removeByRegistryPattern(storage, entry.name);
        } catch {
          // keep purging other entries even if one key fails
        }
      }
    }
  }
  return removedCount;
};

export const readLocalStorageItem = (keyName: string): string | null =>
  readBrowserStorageItem('localStorage', keyName);

export const writeLocalStorageItem = (keyName: string, value: string): boolean =>
  writeBrowserStorageItem('localStorage', keyName, value);

export const removeLocalStorageItem = (keyName: string): boolean =>
  removeBrowserStorageItem('localStorage', keyName);

export const readSessionStorageItem = (keyName: string): string | null =>
  readBrowserStorageItem('sessionStorage', keyName);

export const writeSessionStorageItem = (keyName: string, value: string): boolean =>
  writeBrowserStorageItem('sessionStorage', keyName, value);

export const removeSessionStorageItem = (keyName: string): boolean =>
  removeBrowserStorageItem('sessionStorage', keyName);
