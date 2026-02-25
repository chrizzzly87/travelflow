import { describe, expect, it } from 'vitest';
import { getStoredAppLanguage, setStoredAppLanguage } from '../../services/appRuntimeUtils';

describe('services/appRuntimeUtils (node environment)', () => {
  it('returns default language when window is not available', () => {
    expect(getStoredAppLanguage()).toBe('en');
  });

  it('does not throw when setting language without window', () => {
    expect(() => setStoredAppLanguage('de')).not.toThrow();
  });
});
