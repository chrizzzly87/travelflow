import { describe, expect, it } from 'vitest';
import { readStoredConsent, saveConsent, subscribeToConsentChanges } from '../../services/consentService';

describe('services/consentService (node environment)', () => {
  it('returns null consent when window is unavailable', () => {
    expect(readStoredConsent()).toBeNull();
  });

  it('saveConsent is a no-op without window', () => {
    expect(() => saveConsent('all')).not.toThrow();
  });

  it('returns a safe no-op unsubscribe function', () => {
    const unsubscribe = subscribeToConsentChanges(() => {
      throw new Error('listener should not run in node env');
    });
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
