import { describe, expect, it } from 'vitest';
import {
  buildTripUrl,
  generateVersionId,
  getStoredAppLanguage,
  setStoredAppLanguage,
} from '../../services/appRuntimeUtils';

describe('services/appRuntimeUtils', () => {
  it('generates version ids with expected prefix', () => {
    const versionId = generateVersionId();
    expect(versionId.startsWith('v-')).toBe(true);
    expect(versionId.length).toBeGreaterThan(8);
  });

  it('builds trip urls with and without version', () => {
    expect(buildTripUrl('trip-1')).toBe('/trip/trip-1');
    expect(buildTripUrl('trip 1', 'v-123')).toBe('/trip/trip%201?v=v-123');
  });

  it('stores and reads normalized app language', () => {
    expect(getStoredAppLanguage()).toBe('en');

    setStoredAppLanguage('de');
    expect(getStoredAppLanguage()).toBe('de');

    window.localStorage.setItem('tf_app_language', 'invalid-locale');
    expect(getStoredAppLanguage()).toBe('en');
  });
});
