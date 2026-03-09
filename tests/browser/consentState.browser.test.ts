// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CONSENT_STORAGE_KEY, readConsentChoiceFromStorage } from '../../services/consentState';

describe('services/consentState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads valid consent choices from storage', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'all');
    expect(readConsentChoiceFromStorage()).toBe('all');

    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'essential');
    expect(readConsentChoiceFromStorage()).toBe('essential');
  });

  it('returns null for invalid consent values', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'invalid');
    expect(readConsentChoiceFromStorage()).toBeNull();
  });
});
