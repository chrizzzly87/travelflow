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
  getDestinationSeasonCountryName,
  isIslandDestination,
  resolveDestinationCodes,
  resolveDestinationName,
  searchDestinationOptions,
} from '../../services/destinationService';

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
});
