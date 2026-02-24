// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  getRegisteredStorageEntry,
  purgeOptionalBrowserStorage,
  readLocalStorageItem,
  readSessionStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
  writeSessionStorageItem,
} from '../../services/browserStorageService';
import { CONSENT_STORAGE_KEY } from '../../services/consentState';

describe('services/browserStorageService', () => {
  it('allows essential storage keys regardless of optional consent', () => {
    expect(writeLocalStorageItem(CONSENT_STORAGE_KEY, 'essential')).toBe(true);
    expect(readLocalStorageItem(CONSENT_STORAGE_KEY)).toBe('essential');
  });

  it('blocks optional analytics storage when optional consent is not granted', () => {
    expect(writeLocalStorageItem(CONSENT_STORAGE_KEY, 'essential')).toBe(true);
    expect(writeLocalStorageItem('umami.disabled', '1')).toBe(false);
    expect(readLocalStorageItem('umami.disabled')).toBeNull();
  });

  it('allows optional analytics storage when optional consent is granted', () => {
    expect(writeLocalStorageItem(CONSENT_STORAGE_KEY, 'all')).toBe(true);
    expect(writeLocalStorageItem('umami.disabled', '1')).toBe(true);
    expect(readLocalStorageItem('umami.disabled')).toBe('1');
  });

  it('blocks unknown unregistered keys', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(writeLocalStorageItem('tf_unknown_registry_key', '1')).toBe(false);
    expect(readLocalStorageItem('tf_unknown_registry_key')).toBeNull();
    expect(removeLocalStorageItem('tf_unknown_registry_key')).toBe(false);
    warnSpy.mockRestore();
  });

  it('resolves wildcard registry entries for local and session storage keys', () => {
    const localMatch = getRegisteredStorageEntry('tf_share_links:trip-123', 'localStorage');
    const sessionMatch = getRegisteredStorageEntry('tf_lazy_chunk_recovery:TripView', 'sessionStorage');

    expect(localMatch?.category).toBe('essential');
    expect(sessionMatch?.category).toBe('essential');
  });

  it('purges optional keys while keeping essential keys intact', () => {
    expect(writeLocalStorageItem(CONSENT_STORAGE_KEY, 'all')).toBe(true);
    expect(writeLocalStorageItem('umami.disabled', '1')).toBe(true);
    expect(writeLocalStorageItem('tf_share_links:trip-123', '{"view":"https://example"}')).toBe(true);
    expect(writeSessionStorageItem('tf_lazy_chunk_recovery:TripView', '1')).toBe(true);

    const removedCount = purgeOptionalBrowserStorage();

    expect(removedCount).toBeGreaterThan(0);
    expect(readLocalStorageItem('umami.disabled')).toBeNull();
    expect(readLocalStorageItem('tf_share_links:trip-123')).toBe('{"view":"https://example"}');
    expect(readSessionStorageItem('tf_lazy_chunk_recovery:TripView')).toBe('1');
  });
});
