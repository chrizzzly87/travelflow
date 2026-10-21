import { describe, expect, it } from 'vitest';
import { encodeTripPrefill } from '../../utils';
import { decodeTripPrefill } from '../../services/tripPrefillDecoder';

/**
 * Regression cover for multi-city route prefills reaching the classic planner.
 * The classic page previously mapped countries, dates, pace and notes but dropped
 * both `cities` and the ordered `cityList`, so route cards opened with no stops.
 */
describe('classic planner city prefill', () => {
  it('keeps the ordered city list through an encode/decode round-trip', () => {
    const encoded = encodeTripPrefill({
      countries: ['Japan'],
      cities: 'Tokyo, Hakone, Kyoto, Osaka',
      cityList: ['Tokyo', 'Hakone', 'Kyoto', 'Osaka'],
    });
    const decoded = decodeTripPrefill(encoded);
    expect(decoded?.cityList).toEqual(['Tokyo', 'Hakone', 'Kyoto', 'Osaka']);
  });

  it('still decodes a legacy comma-separated prefill with no city list', () => {
    const encoded = encodeTripPrefill({
      countries: ['Japan'],
      cities: 'Tokyo, Kyoto',
    });
    const decoded = decodeTripPrefill(encoded);
    expect(decoded?.cities).toBe('Tokyo, Kyoto');
    expect(decoded?.cityList).toBeUndefined();
  });
});
