import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SUPPORTED_LOCALES } from '../config/locales';

type LocalizedNameMap = Record<string, string>;

interface CountrySeasonEntry {
  countryCode: string;
  countryName: string;
}

interface CountrySearchMetadataEntry {
  aliases?: string[];
  localizedAliases?: Record<string, string[]>;
}

interface CountryTravelDataDocument {
  generatedAt: string;
  countries: CountrySeasonEntry[];
  localizedDestinationNames?: {
    countries: Record<string, LocalizedNameMap>;
    islands: Record<string, LocalizedNameMap>;
  };
  countrySearchMetadata?: {
    cldrVersion?: string;
    countries: Record<string, CountrySearchMetadataEntry>;
  };
}

type ManualSearchSupplement = {
  aliases?: string[];
  localizedAliases?: Record<string, string[]>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COUNTRY_TRAVEL_DATA_PATH = resolve(__dirname, '../data/countryTravelData.json');
const CLDR_BASE_URL =
  'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-localenames-full/main';
const CLDR_VERSION_URL =
  'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/aliases.json';

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const addNames = (target: Set<string>, values: Array<string | undefined>, exclude = new Set<string>()): void => {
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    const normalized = normalizeWhitespace(value);
    if (!normalized || exclude.has(normalized)) return;
    target.add(normalized);
  });
};

const dedupeNames = (values: Array<string | undefined>): string[] => {
  const names = new Set<string>();
  addNames(names, values);
  return Array.from(names);
};

const MANUAL_SEARCH_SUPPLEMENTS: Record<string, ManualSearchSupplement> = {
  AE: {
    aliases: ['UAE'],
  },
  BA: {
    aliases: ['BiH'],
  },
  BN: {
    aliases: ['Brunei Darussalam'],
  },
  BO: {
    aliases: ['Plurinational State of Bolivia'],
    localizedAliases: {
      de: ['Plurinationaler Staat Bolivien'],
    },
  },
  BY: {
    aliases: ['Byelorussia', 'Belorussia'],
    localizedAliases: {
      de: ['Weißrussland', 'Weissrussland'],
    },
  },
  CD: {
    aliases: [
      'DRC',
      'DR Congo',
      'Democratic Republic of the Congo',
      'Democratic Republic of Congo',
      'Congo-Kinshasa',
      'Zaire',
    ],
    localizedAliases: {
      de: ['Demokratische Republik Kongo', 'DR Kongo'],
    },
  },
  CG: {
    aliases: ['Republic of the Congo', 'Republic of Congo', 'Congo-Brazzaville'],
    localizedAliases: {
      de: ['Republik Kongo'],
    },
  },
  CI: {
    aliases: ["Cote d'Ivoire", 'Cote dIvoire'],
  },
  CN: {
    aliases: ['PRC', "People's Republic of China", 'Peoples Republic of China'],
    localizedAliases: {
      de: ['Volksrepublik China', 'Volkrepublik China'],
      ko: ['중화인민공화국'],
      zh: ['中国', '中华人民共和国'],
    },
  },
  CV: {
    aliases: ['Cabo Verde'],
  },
  FM: {
    aliases: ['Federated States of Micronesia', 'FSM', 'Micronesia, Federated States of'],
  },
  GB: {
    aliases: [
      'UK',
      'Britain',
      'Great Britain',
      'England',
      'Scotland',
      'Wales',
      'Northern Ireland',
      'United Kingdom of Great Britain and Northern Ireland',
    ],
    localizedAliases: {
      de: ['Großbritannien'],
    },
  },
  IE: {
    aliases: ['Republic of Ireland', 'Eire', 'Éire'],
  },
  IR: {
    aliases: ['Islamic Republic of Iran', 'Persia'],
    localizedAliases: {
      de: ['Persien'],
    },
  },
  KN: {
    aliases: ['St Kitts and Nevis', 'St. Kitts and Nevis'],
  },
  KP: {
    aliases: ['DPRK', "Democratic People's Republic of Korea"],
    localizedAliases: {
      de: ['Demokratische Volksrepublik Korea'],
      ko: ['조선민주주의인민공화국'],
    },
  },
  KR: {
    aliases: ['ROK', 'Republic of Korea'],
    localizedAliases: {
      de: ['Republik Korea'],
      ko: ['대한민국'],
    },
  },
  LA: {
    aliases: ['Lao PDR', "Lao People's Democratic Republic"],
  },
  LK: {
    aliases: ['Ceylon'],
  },
  LC: {
    aliases: ['St Lucia', 'St. Lucia'],
  },
  MD: {
    aliases: ['Republic of Moldova', 'Moldavia'],
    localizedAliases: {
      de: ['Republik Moldau', 'Moldawien'],
    },
  },
  MK: {
    aliases: ['Macedonia', 'FYROM', 'Former Yugoslav Republic of Macedonia'],
    localizedAliases: {
      de: ['Mazedonien'],
    },
  },
  MM: {
    aliases: ['Burma'],
    localizedAliases: {
      de: ['Birma'],
    },
  },
  NL: {
    aliases: ['Holland', 'The Netherlands'],
  },
  PS: {
    aliases: ['State of Palestine'],
  },
  RU: {
    aliases: ['Russian Federation'],
    localizedAliases: {
      de: ['Russische Föderation'],
    },
  },
  SA: {
    aliases: ['KSA', 'Kingdom of Saudi Arabia'],
  },
  SY: {
    aliases: ['Syrian Arab Republic'],
  },
  SZ: {
    aliases: ['Swaziland', 'Kingdom of Eswatini', 'eSwatini'],
  },
  TH: {
    aliases: ['Siam'],
  },
  TL: {
    aliases: ['East Timor'],
  },
  TR: {
    aliases: ['Türkiye', 'Turkiye'],
  },
  TZ: {
    aliases: ['United Republic of Tanzania'],
    localizedAliases: {
      de: ['Vereinigte Republik Tansania'],
    },
  },
  US: {
    aliases: ['US', 'USA', 'America', 'United States of America'],
    localizedAliases: {
      de: ['Vereinigte Staaten von Amerika'],
    },
  },
  VA: {
    aliases: ['Vatican', 'Holy See', 'Vatican City', 'Vatican City State'],
  },
  VC: {
    aliases: ['St Vincent and the Grenadines', 'St. Vincent and the Grenadines'],
  },
  VE: {
    aliases: ['Bolivarian Republic of Venezuela'],
    localizedAliases: {
      de: ['Bolivarische Republik Venezuela'],
    },
  },
  VN: {
    aliases: ['Viet Nam', 'Socialist Republic of Vietnam'],
  },
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};

const buildExistingLocalizedCountries = (
  document: CountryTravelDataDocument
): Record<string, LocalizedNameMap> => document.localizedDestinationNames?.countries || {};

const buildSearchMetadata = async (
  document: CountryTravelDataDocument
): Promise<CountryTravelDataDocument['countrySearchMetadata']> => {
  const localizedCountries = buildExistingLocalizedCountries(document);
  const countries = document.countries.map((entry) => ({
    code: entry.countryCode.toUpperCase(),
    name: entry.countryName,
  }));

  const localizedAliasesByCode = new Map<string, Map<string, Set<string>>>();

  for (const locale of SUPPORTED_LOCALES) {
    const cldr = await fetchJson<{
      main: Record<string, { localeDisplayNames: { territories: Record<string, string> } }>;
    }>(`${CLDR_BASE_URL}/${locale}/territories.json`);

    const territories =
      cldr.main[locale]?.localeDisplayNames?.territories
      || cldr.main[locale.replace('-', '_')]?.localeDisplayNames?.territories
      || {};

    countries.forEach(({ code, name }) => {
      const existingLocalizedNames = localizedCountries[code] || {};
      const hadLocaleSpecificDisplay = Boolean(existingLocalizedNames[locale]);
      const existingDisplayName = normalizeWhitespace(existingLocalizedNames[locale] || existingLocalizedNames.en || name);
      const namesForCountry = localizedAliasesByCode.get(code) || new Map<string, Set<string>>();
      const localeNames = namesForCountry.get(locale) || new Set<string>();
      const exclude = new Set<string>([existingDisplayName]);

      const cldrCanonical = territories[code];
      if (typeof cldrCanonical === 'string') {
        const normalizedCanonical = normalizeWhitespace(cldrCanonical);
        if (!existingLocalizedNames[locale] && normalizedCanonical) {
          existingLocalizedNames[locale] = normalizedCanonical;
        }
        if (hadLocaleSpecificDisplay && normalizedCanonical && normalizedCanonical !== existingDisplayName) {
          localeNames.add(normalizedCanonical);
        }
      }

      Object.entries(territories)
        .filter(([key]) => key.startsWith(`${code}-alt-`))
        .forEach(([, alias]) => {
          if (typeof alias !== 'string') return;
          const normalizedAlias = normalizeWhitespace(alias);
          if (!normalizedAlias || exclude.has(normalizedAlias)) return;
          localeNames.add(normalizedAlias);
        });

      if (localeNames.size > 0) {
        namesForCountry.set(locale, localeNames);
      }
      if (namesForCountry.size > 0) {
        localizedAliasesByCode.set(code, namesForCountry);
      }

      if (!localizedCountries[code]) {
        localizedCountries[code] = existingLocalizedNames;
      }
    });
  }

  const versionJson = await fetchJson<{
    supplemental?: {
      version?: {
        _cldrVersion?: string;
      };
    };
  }>(CLDR_VERSION_URL);

  const countriesMetadata = countries.reduce<Record<string, CountrySearchMetadataEntry>>((acc, { code }) => {
    const generatedLocalizedAliases = localizedAliasesByCode.get(code);
    const manualSupplement = MANUAL_SEARCH_SUPPLEMENTS[code];
    const localizedAliases: Record<string, string[]> = {};

    generatedLocalizedAliases?.forEach((aliases, locale) => {
      localizedAliases[locale] = dedupeNames(Array.from(aliases));
    });

    Object.entries(manualSupplement?.localizedAliases || {}).forEach(([locale, aliases]) => {
      localizedAliases[locale] = dedupeNames([...(localizedAliases[locale] || []), ...aliases]);
    });

    const aliases = dedupeNames(manualSupplement?.aliases || []);
    const entry: CountrySearchMetadataEntry = {};
    if (aliases.length > 0) entry.aliases = aliases;
    if (Object.keys(localizedAliases).length > 0) entry.localizedAliases = localizedAliases;
    if (entry.aliases || entry.localizedAliases) {
      acc[code] = entry;
    }
    return acc;
  }, {});

  return {
    cldrVersion: versionJson.supplemental?.version?._cldrVersion,
    countries: countriesMetadata,
  };
};

const main = async (): Promise<void> => {
  const raw = await readFile(COUNTRY_TRAVEL_DATA_PATH, 'utf8');
  const document = JSON.parse(raw) as CountryTravelDataDocument;
  document.localizedDestinationNames = document.localizedDestinationNames || { countries: {}, islands: {} };
  document.localizedDestinationNames.countries = buildExistingLocalizedCountries(document);
  document.countrySearchMetadata = await buildSearchMetadata(document);
  await writeFile(COUNTRY_TRAVEL_DATA_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  const aliasCount = Object.values(document.countrySearchMetadata?.countries || {}).reduce((total, entry) => {
    const localizedCount = Object.values(entry.localizedAliases || {}).reduce((sum, aliases) => sum + aliases.length, 0);
    return total + (entry.aliases?.length || 0) + localizedCount;
  }, 0);

  console.log(
    `Updated country search metadata for ${document.countries.length} countries using CLDR v${document.countrySearchMetadata?.cldrVersion || 'unknown'} with ${aliasCount} aliases.`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
