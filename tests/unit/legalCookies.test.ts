import { describe, expect, it } from 'vitest';
import {
  COOKIE_REGISTRY,
  getAllCookies,
  getCookieByName,
  isCookieRegistered,
  validateCookieRegistry,
} from '../../lib/legal/cookies.config';
import { getCookieLastReviewedDate, getCookieTableRows } from '../../lib/legal/cookies';
import { LEGAL_PROFILE } from '../../config/legalProfile';

describe('lib/legal cookie registry', () => {
  it('keeps registry validation green', () => {
    const result = validateCookieRegistry();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('resolves cookie helpers consistently', () => {
    expect(isCookieRegistered('tf_cookie_consent_choice_v1')).toBe(true);
    expect(getCookieByName('tf_cookie_consent_choice_v1')).toBeDefined();
    expect(isCookieRegistered('tf_share_links:trip_123')).toBe(true);
    expect(getCookieByName('tf_lazy_chunk_recovery:TripView')).toBeDefined();
    expect(getCookieByName('sb-abcde-auth-token')).toBeDefined();
    expect(getCookieByName('does_not_exist')).toBeUndefined();
    expect(getAllCookies().length).toBe(
      COOKIE_REGISTRY.essential.length
      + COOKIE_REGISTRY.analytics.length
      + COOKIE_REGISTRY.marketing.length,
    );
  });

  it('maps table rows with explicit categories', () => {
    const rows = getCookieTableRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.category === 'essential' || row.category === 'analytics' || row.category === 'marketing')).toBe(true);
  });

  it('uses legal profile review date for cookie policy metadata', () => {
    expect(getCookieLastReviewedDate()).toBe(LEGAL_PROFILE.reviewDates.cookiesLastUpdated);
  });
});
