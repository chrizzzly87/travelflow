/**
 * Localized country and island names, split out of `countryTravelData` so a
 * consumer that only translates a destination name does not also pull the
 * seasons, events and public holidays (313 KB) it never reads.
 *
 * The JSON is derived from `data/countryTravelData.json` — see
 * `scripts/split-country-travel-data.mjs`.
 */
import localizedNamesJson from './countryLocalizedNames.generated.json';

export interface LocalizedDestinationNames {
  countries: Record<string, Record<string, string>>;
  islands: Record<string, Record<string, string>>;
}

export const LOCALIZED_DESTINATION_NAMES: LocalizedDestinationNames = {
  countries: (localizedNamesJson as Partial<LocalizedDestinationNames>).countries || {},
  islands: (localizedNamesJson as Partial<LocalizedDestinationNames>).islands || {},
};

export const normalizeLocaleKey = (locale?: string): string => {
  if (!locale) return 'en';
  const trimmed = locale.trim().toLowerCase();
  if (!trimmed) return 'en';
  const [base] = trimmed.split('-');
  return base || 'en';
};

const getLocalizedDestinationName = (
  source: Record<string, Record<string, string>>,
  code: string,
  locale?: string
): string | undefined => {
  const normalizedCode = code.trim();
  if (!normalizedCode) return undefined;

  const localizedByLocale =
    source[normalizedCode]
    || source[normalizedCode.toUpperCase()]
    || source[normalizedCode.toLowerCase()];
  if (!localizedByLocale) return undefined;

  const localeKey = normalizeLocaleKey(locale);
  return localizedByLocale[localeKey] || localizedByLocale.en || Object.values(localizedByLocale).find(Boolean);
};

export const getLocalizedCountryNameFromData = (countryCode: string, locale?: string): string | undefined =>
  getLocalizedDestinationName(LOCALIZED_DESTINATION_NAMES.countries, countryCode, locale);

export const getLocalizedIslandNameFromData = (islandCode: string, locale?: string): string | undefined =>
  getLocalizedDestinationName(LOCALIZED_DESTINATION_NAMES.islands, islandCode, locale);
