/**
 * Country search aliases, split out of `countryTravelData` so alias
 * normalization — which the destination, profile and explorer services all
 * reach for — costs 8 KB instead of 678 KB.
 *
 * The JSON is derived from `data/countryTravelData.json` — see
 * `scripts/split-country-travel-data.mjs`.
 */
import searchMetadataJson from './countrySearchMetadata.generated.json';

export interface CountrySearchMetadataEntry {
  aliases?: string[];
  localizedAliases?: Record<string, string[]>;
}

export interface CountrySearchMetadata {
  cldrVersion?: string;
  countries: Record<string, CountrySearchMetadataEntry>;
}

const rawSearchMetadata = searchMetadataJson as Partial<CountrySearchMetadata>;

export const COUNTRY_SEARCH_METADATA: CountrySearchMetadata = {
  cldrVersion: rawSearchMetadata.cldrVersion,
  countries: rawSearchMetadata.countries || {},
};

const getCountrySearchMetadataEntry = (countryCode: string): CountrySearchMetadataEntry | undefined => {
  const normalizedCode = countryCode.trim();
  if (!normalizedCode) return undefined;

  return (
    COUNTRY_SEARCH_METADATA.countries[normalizedCode]
    || COUNTRY_SEARCH_METADATA.countries[normalizedCode.toUpperCase()]
    || COUNTRY_SEARCH_METADATA.countries[normalizedCode.toLowerCase()]
  );
};

export const getCountrySearchAliasesFromData = (countryCode: string): string[] => {
  const entry = getCountrySearchMetadataEntry(countryCode);
  if (!entry) return [];

  const aliases = new Set<string>();
  (entry.aliases || []).forEach((alias) => {
    const normalized = alias.trim();
    if (normalized) aliases.add(normalized);
  });
  Object.values(entry.localizedAliases || {}).forEach((localeAliases) => {
    localeAliases.forEach((alias) => {
      const normalized = alias.trim();
      if (normalized) aliases.add(normalized);
    });
  });

  return Array.from(aliases);
};
