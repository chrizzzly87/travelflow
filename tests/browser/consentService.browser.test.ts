import { describe, expect, it, vi } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  readStoredConsent,
  saveConsent,
  subscribeToConsentChanges,
} from '../../services/consentService';

describe('services/consentService', () => {
  it('reads null when no valid consent is stored', () => {
    expect(readStoredConsent()).toBeNull();

    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'invalid');
    expect(readStoredConsent()).toBeNull();
  });

  it('saves and reads consent value', () => {
    saveConsent('all');
    expect(readStoredConsent()).toBe('all');

    saveConsent('essential');
    expect(readStoredConsent()).toBe('essential');
  });

  it('notifies subscribers on consent change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToConsentChanges(listener);

    saveConsent('all');

    expect(listener).toHaveBeenCalledWith('all');

    unsubscribe();
    saveConsent('essential');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed consent event payloads', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToConsentChanges(listener);

    window.dispatchEvent(new CustomEvent('tf:cookie-consent-change', { detail: 'invalid' }));
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('handles storage write failures without throwing', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => saveConsent('all')).not.toThrow();
    setItemSpy.mockRestore();
  });
});
