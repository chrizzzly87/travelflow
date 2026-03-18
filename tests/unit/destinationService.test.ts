import { describe, expect, it } from 'vitest';
import {
  DESTINATION_OPTIONS,
  ISLAND_DESTINATIONS,
  getDestinationDisplayName,
  getDestinationDisplayNameByCode,
  getDestinationMetaLabel,
  getDestinationOptionByCode,
  getDestinationOptionByName,
  getDestinationPromptLabel,
  getDestinationRecommendationScore,
  getRecommendedDestinationOptions,
  getRollingRecommendationMonths,
  getDestinationSeasonCountryName,
  isIslandDestination,
  resolveDestinationCodes,
  resolveDestinationName,
  searchDestinationOptions,
} from '../../services/destinationService';
import { monthRangeBetweenDates } from '../../data/countryTravelData';

describe('services/destinationService', () => {
  it('includes both countries and islands', () => {
    expect(DESTINATION_OPTIONS.length).toBeGreaterThan(200);
    expect(ISLAND_DESTINATIONS.length).toBeGreaterThan(50);
  });

  it('resolves by name, alias, and code', () => {
    const germany = getDestinationOptionByName('Germany');
    expect(germany?.code).toBe('DE');

    const bali = getDestinationOptionByName('Bali');
    expect(bali?.kind).toBe('island');
    expect(bali?.parentCountryCode).toBe('ID');

    const fromAlias = getDestinationOptionByName('Fraser Island');
    expect(fromAlias?.name).toBe("K'gari");

    const byCode = getDestinationOptionByCode('DE');
    expect(byCode?.name).toBe('Germany');
    expect(getDestinationOptionByCode('unknown')).toBeUndefined();
    expect(getDestinationOptionByName('   ')).toBeUndefined();
  });

  it('resolves names and codes safely', () => {
    expect(resolveDestinationName(' germany ')).toBe('Germany');
    expect(resolveDestinationName('England')).toBe('United Kingdom');
    expect(resolveDestinationName('USA')).toBe('United States');
    expect(resolveDestinationName('PRC')).toBe('China');
    expect(resolveDestinationName("People's Republic of China")).toBe('China');
    expect(resolveDestinationName('Volksrepublik China')).toBe('China');
    expect(resolveDestinationName('대한민국')).toBe('South Korea');
    expect(resolveDestinationName('DR Kongo')).toBe('Congo (Democratic Republic)');
    expect(resolveDestinationName('Zaire')).toBe('Congo (Democratic Republic)');
    expect(resolveDestinationName('Ceylon')).toBe('Sri Lanka');
    expect(resolveDestinationName('Siam')).toBe('Thailand');
    expect(resolveDestinationName('Birma')).toBe('Myanmar');
    expect(resolveDestinationName('Persia')).toBe('Iran');
    expect(resolveDestinationName('Weissrussland')).toBe('Belarus');
    expect(resolveDestinationName('Republik Moldau')).toBe('Moldova');
    expect(resolveDestinationName("Côte d'Ivoire")).toBe('Ivory Coast');
    expect(resolveDestinationName('Unknown Place')).toBe('Unknown Place');

    const names = resolveDestinationCodes(['DE', 'ID-BA', 'UNKNOWN']);
    expect(names).toContain('Germany');
    expect(names).toContain('Bali');
    expect(names).toHaveLength(2);
  });

  it('returns localized display labels and island metadata', () => {
    const germanyDisplay = getDestinationDisplayName('Germany', 'de-DE');
    expect(germanyDisplay.length).toBeGreaterThan(0);

    const byCode = getDestinationDisplayNameByCode('DE', 'de');
    expect(byCode).toBeTruthy();

    const islandPrompt = getDestinationPromptLabel('Bali', 'en');
    expect(islandPrompt).toContain('Bali');
    expect(islandPrompt).toContain('Indonesia');

    const islandMeta = getDestinationMetaLabel('Bali', 'en');
    expect(islandMeta).toContain('Island of');

    expect(getDestinationSeasonCountryName('Bali')).toBe('Indonesia');
    expect(getDestinationSeasonCountryName('Unknown Place')).toBe('Unknown Place');
    expect(isIslandDestination('Bali')).toBe(true);
    expect(isIslandDestination('Germany')).toBe(false);
    expect(getDestinationMetaLabel('Germany', 'en')).toBeUndefined();
    expect(getDestinationDisplayName('Unknown Place', 'en')).toBe('Unknown Place');
  });

  it('searches with starts-with precedence, excludes and limits', () => {
    const startsWith = searchDestinationOptions('ger');
    expect(startsWith[0].name.toLowerCase().startsWith('ger')).toBe(true);

    const includes = searchDestinationOptions('island', { limit: 5 });
    expect(includes.length).toBeLessThanOrEqual(5);

    const excluded = searchDestinationOptions('bali', { excludeNames: ['Bali'] });
    expect(excluded.find((item) => item.name === 'Bali')).toBeUndefined();

    const unfiltered = searchDestinationOptions('', { limit: 3 });
    expect(unfiltered).toHaveLength(3);
  });

  it('supports alias-based excludes and unknown prompt fallbacks', () => {
    const aliasMatch = searchDestinationOptions('fraser');
    expect(aliasMatch.some((item) => item.name === "K'gari")).toBe(true);

    const excludedByAlias = searchDestinationOptions('fraser', { excludeNames: ['Fraser Island'] });
    expect(excludedByAlias.some((item) => item.name === "K'gari")).toBe(false);

    expect(getDestinationPromptLabel('Unknown Place', 'en')).toBe('Unknown Place');
  });

  it('searches include-only matches across aliases, localized names, and parent country tokens', () => {
    const aliasIncludes = searchDestinationOptions('raser');
    expect(aliasIncludes.some((item) => item.name === "K'gari")).toBe(true);

    const localizedCountryIncludes = searchDestinationOptions('deutsch');
    expect(localizedCountryIncludes.some((item) => item.code === 'DE')).toBe(true);

    const parentCountryIncludes = searchDestinationOptions('donesia');
    expect(parentCountryIncludes.some((item) => item.name === 'Bali')).toBe(true);
  });

  it('matches generated and curated country aliases across locales', () => {
    expect(searchDestinationOptions('uk').some((item) => item.name === 'United Kingdom')).toBe(true);
    expect(searchDestinationOptions('u.k.').some((item) => item.name === 'United Kingdom')).toBe(true);
    expect(searchDestinationOptions('england').some((item) => item.name === 'United Kingdom')).toBe(true);
    expect(searchDestinationOptions('grossbritannien').some((item) => item.name === 'United Kingdom')).toBe(true);
    expect(searchDestinationOptions('usa').some((item) => item.name === 'United States')).toBe(true);
    expect(searchDestinationOptions('uae').some((item) => item.name === 'United Arab Emirates')).toBe(true);
    expect(searchDestinationOptions('holland').some((item) => item.name === 'Netherlands')).toBe(true);
    expect(searchDestinationOptions('cote divoire').some((item) => item.name === 'Ivory Coast')).toBe(true);
    expect(searchDestinationOptions('prc').some((item) => item.name === 'China')).toBe(true);
    expect(searchDestinationOptions("people's republic of china").some((item) => item.name === 'China')).toBe(true);
    expect(searchDestinationOptions('volksrepublik china').some((item) => item.name === 'China')).toBe(true);
    expect(searchDestinationOptions('republic of korea').some((item) => item.name === 'South Korea')).toBe(true);
    expect(searchDestinationOptions('대한민국').some((item) => item.name === 'South Korea')).toBe(true);
    expect(searchDestinationOptions('demokratische republik kongo').some((item) => item.name === 'Congo (Democratic Republic)')).toBe(true);
    expect(searchDestinationOptions('dr kongo').some((item) => item.name === 'Congo (Democratic Republic)')).toBe(true);
    expect(searchDestinationOptions('zaire').some((item) => item.name === 'Congo (Democratic Republic)')).toBe(true);
    expect(searchDestinationOptions('republik kongo').some((item) => item.name === 'Congo (Republic)')).toBe(true);
    expect(searchDestinationOptions('ceylon').some((item) => item.name === 'Sri Lanka')).toBe(true);
    expect(searchDestinationOptions('siam').some((item) => item.name === 'Thailand')).toBe(true);
    expect(searchDestinationOptions('birma').some((item) => item.name === 'Myanmar')).toBe(true);
    expect(searchDestinationOptions('persien').some((item) => item.name === 'Iran')).toBe(true);
    expect(searchDestinationOptions('weissrussland').some((item) => item.name === 'Belarus')).toBe(true);
    expect(searchDestinationOptions('republik moldau').some((item) => item.name === 'Moldova')).toBe(true);
  });
  it('returns rolling recommendation months and wraps into the next year', () => {
    expect(getRollingRecommendationMonths(new Date('2026-12-15T12:00:00Z'))).toEqual([12, 1, 2]);
    expect(getRollingRecommendationMonths(new Date('2026-02-20T12:00:00Z'), 5)).toEqual([2, 3, 4, 5, 6]);
  });

  it('clamps rolling recommendation month counts and tolerates invalid dates', () => {
    expect(getRollingRecommendationMonths(new Date('invalid'), 0)).toHaveLength(1);
    expect(getRollingRecommendationMonths(new Date('2026-02-20T12:00:00Z'), 20)).toHaveLength(12);
  });
  it('builds a unique top 20 recommendation list and excludes already selected destinations', () => {
    const recommendations = getRecommendedDestinationOptions({
      months: [4, 5],
      excludeNames: ['Japan', 'Bali'],
      limit: 20,
    });

    expect(recommendations).toHaveLength(20);
    expect(recommendations.some((item) => item.name === 'Japan')).toBe(false);
    expect(recommendations.some((item) => item.name === 'Bali')).toBe(false);
    expect(new Set(recommendations.map((item) => item.code)).size).toBe(20);
  });

  it('adapts destination scores by month overrides, season windows, and events', () => {
    const japan = getDestinationOptionByCode('JP');
    const thailand = getDestinationOptionByCode('TH');

    expect(japan).toBeDefined();
    expect(thailand).toBeDefined();
    expect(getDestinationRecommendationScore(japan!, [4])).toBeGreaterThan(getDestinationRecommendationScore(japan!, [7]));
    expect(getDestinationRecommendationScore(thailand!, [12])).toBeGreaterThan(getDestinationRecommendationScore(thailand!, [8]));
  });

  it('supports exact-date month ranges and flex-style month windows for ranking', () => {
    const japan = getDestinationOptionByCode('JP');
    const springExactMonths = monthRangeBetweenDates('2026-04-10', '2026-05-22');
    const winterFlexMonths = [12, 1, 2];

    expect(springExactMonths).toEqual([4, 5]);
    expect(japan).toBeDefined();
    expect(getDestinationRecommendationScore(japan!, springExactMonths)).toBeGreaterThan(
      getDestinationRecommendationScore(japan!, winterFlexMonths)
    );
  });

  it('returns neutral recommendation scores when months normalize away or no profile exists', () => {
    const customDestination = {
      name: 'Nowhere',
      code: 'ZZ',
      flag: '🏳️',
      kind: 'country' as const,
    };

    expect(getDestinationRecommendationScore(customDestination)).toBe(0);
    expect(getDestinationRecommendationScore(customDestination, [0, 13, 2.5])).toBe(0);
  });
  it('can surface curated island destinations in seasonal recommendations', () => {
    const recommendations = getRecommendedDestinationOptions({ months: [7, 8], limit: 50 });

    expect(recommendations.some((item) => item.name === 'Bali')).toBe(true);
    expect(recommendations.some((item) => item.kind === 'island')).toBe(true);
  });
});
