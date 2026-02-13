import countryTravelDataJson from './countryTravelData.json';

export interface CountrySeasonEntry {
  countryCode: string;
  countryName: string;
  flag: string;
  bestMonths: number[];
  shoulderMonths: number[];
  avoidMonths: number[];
  bestMonthsLabel: string;
  shoulderMonthsLabel: string;
  suggestedTripDays: {
    min: number;
    max: number;
    recommended: number;
  };
  climateNotes: string;
  events: Array<{
    id: string;
    name: string;
    month: number;
    monthLabel: string;
    type: string;
    summary: string;
  }>;
  publicHolidays: Array<{
    id: string;
    name: string;
    month: number;
    monthLabel: string;
    day?: number;
    summary: string;
  }>;
}

export interface CountryTravelDataDocument {
  generatedAt: string;
  monthLegend: {
    ideal: string;
    shoulder: string;
    avoid: string;
  };
  countries: CountrySeasonEntry[];
  localizedDestinationNames?: {
    countries: Record<string, Record<string, string>>;
    islands: Record<string, Record<string, string>>;
  };
}

export const COUNTRY_TRAVEL_DATA = countryTravelDataJson as CountryTravelDataDocument;

const EMPTY_LOCALIZED_DESTINATION_NAMES = {
  countries: {} as Record<string, Record<string, string>>,
  islands: {} as Record<string, Record<string, string>>,
};

export const LOCALIZED_DESTINATION_NAMES =
  COUNTRY_TRAVEL_DATA.localizedDestinationNames || EMPTY_LOCALIZED_DESTINATION_NAMES;

const normalizeLocaleKey = (locale?: string): string => {
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

const COUNTRY_BY_NAME = new Map<string, CountrySeasonEntry>(
  COUNTRY_TRAVEL_DATA.countries.map((entry) => [entry.countryName.toLocaleLowerCase(), entry])
);

const COUNTRY_BY_CODE = new Map<string, CountrySeasonEntry>(
  COUNTRY_TRAVEL_DATA.countries.map((entry) => [entry.countryCode.toLocaleLowerCase(), entry])
);

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const getCountrySeasonByName = (countryName: string): CountrySeasonEntry | undefined =>
  COUNTRY_BY_NAME.get(countryName.trim().toLocaleLowerCase());

export const getCountrySeasonByCode = (countryCode: string): CountrySeasonEntry | undefined =>
  COUNTRY_BY_CODE.get(countryCode.trim().toLocaleLowerCase());

const toMonthSet = (months: number[]): Set<number> => new Set(months.filter((m) => m >= 1 && m <= 12));

export const buildMonthScoreMap = (countryNames: string[]): Record<number, number> => {
  const scoreMap: Record<number, number> = {};

  countryNames.forEach((countryName) => {
    const entry = getCountrySeasonByName(countryName);
    if (!entry) return;

    const best = toMonthSet(entry.bestMonths);
    const shoulder = toMonthSet(entry.shoulderMonths);

    for (let month = 1; month <= 12; month += 1) {
      const currentScore = scoreMap[month] || 0;
      if (best.has(month)) {
        scoreMap[month] = currentScore + 2;
      } else if (shoulder.has(month)) {
        scoreMap[month] = currentScore + 1;
      }
    }
  });

  return scoreMap;
};

export const getCommonBestMonths = (countryNames: string[]): { ideal: number[]; shoulder: number[] } => {
  if (countryNames.length === 0) return { ideal: [], shoulder: [] };

  const scoreMap = buildMonthScoreMap(countryNames);
  const maxScore = Math.max(...Object.values(scoreMap), 0);
  if (maxScore <= 0) return { ideal: [], shoulder: [] };

  const ideal = Object.entries(scoreMap)
    .filter(([, score]) => score === maxScore)
    .map(([month]) => Number(month))
    .sort((a, b) => a - b);

  const shoulderThreshold = Math.max(1, maxScore - 1);
  const shoulder = Object.entries(scoreMap)
    .filter(([, score]) => score >= shoulderThreshold && score < maxScore)
    .map(([month]) => Number(month))
    .sort((a, b) => a - b);

  return { ideal, shoulder };
};

export const monthRangeBetweenDates = (startDate: string, endDate: string): number[] => {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const months: number[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endCursor) {
    const month = cursor.getMonth() + 1;
    if (!months.includes(month)) months.push(month);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

export const rankCountriesForMonths = (months: number[]): Array<{ entry: CountrySeasonEntry; score: number }> => {
  if (months.length === 0) return [];

  const target = new Set(months);

  return COUNTRY_TRAVEL_DATA.countries
    .map((entry) => {
      const best = toMonthSet(entry.bestMonths);
      const shoulder = toMonthSet(entry.shoulderMonths);
      let score = 0;
      target.forEach((month) => {
        if (best.has(month)) score += 2;
        else if (shoulder.has(month)) score += 1;
      });
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.countryName.localeCompare(b.entry.countryName));
};

export interface DurationRecommendation {
  min: number;
  max: number;
  recommended: number;
}

export const getDurationRecommendation = (
  countryNames: string[],
  styleSignals: string[] = []
): DurationRecommendation => {
  if (countryNames.length === 0) {
    return { min: 5, max: 14, recommended: 9 };
  }

  const entries = countryNames
    .map((name) => getCountrySeasonByName(name))
    .filter((entry): entry is CountrySeasonEntry => Boolean(entry));

  if (entries.length === 0) {
    return { min: 5, max: 14, recommended: 9 };
  }

  const avg = (values: number[]) => values.reduce((acc, value) => acc + value, 0) / values.length;
  let min = Math.round(avg(entries.map((entry) => entry.suggestedTripDays.min)));
  let max = Math.round(avg(entries.map((entry) => entry.suggestedTripDays.max)));
  let recommended = Math.round(avg(entries.map((entry) => entry.suggestedTripDays.recommended)));

  // More countries generally require additional transit and buffer days.
  const extraCountries = Math.max(0, entries.length - 1);
  if (extraCountries > 0) {
    min += Math.round(extraCountries * 1.2);
    recommended += Math.round(extraCountries * 2.8);
    max += Math.round(extraCountries * 4.2);
  }

  const style = new Set(styleSignals.map((signal) => signal.toLocaleLowerCase()));
  if (style.has('slow-travel') || style.has('remote-work') || style.has('family') || style.has('digital-nomad')) {
    recommended += 2;
    max += 2;
  }
  if (style.has('backpacker') || style.has('first-timer')) {
    recommended += 1;
  }
  if (style.has('weekend') || style.has('short-break')) {
    recommended = Math.max(4, recommended - 3);
    max = Math.max(max - 2, recommended + 1);
  }

  recommended = Math.max(min, Math.min(recommended, max));

  return {
    min: Math.max(3, min),
    max: Math.max(min + 2, max),
    recommended,
  };
};
