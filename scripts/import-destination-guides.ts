import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import countryTravelDataJson from '../data/countryTravelData.json';
import islandSeedsJson from '../data/popularIslandDestinations.json';
import { COMMERCIAL_AIRPORT_REFERENCES } from '../data/airports/commercialAirports.generated';
import { AIRPORT_REFERENCE_METADATA } from '../data/airports/metadata.generated';
import {
  buildDestinationSourceLink,
  type DestinationCatalogEntry,
  type DestinationEvent,
  type DestinationGuideDocument,
  type DestinationGuideEntry,
  validateDestinationGuideDocument,
} from '../shared/destinationGuides';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_PATH = resolve(ROOT, 'data/destinationGuides.json');
const REVIEWED_AT = new Date().toISOString();

// Launch order: the 29 non-zero countries observed in the referenced source's
// popularity field, followed by 23 destinations already represented by
// TravelFlow inspiration content or common multi-country routes. This is a
// product launch set, not an objective global tourism ranking.
const TOP_COUNTRY_CODES = [
  'TH', 'ES', 'FR', 'IT', 'GR', 'PT', 'TR', 'MX', 'ID', 'BR',
  'MV', 'AU', 'PH', 'BB', 'JM', 'DO', 'CU', 'CR', 'VN', 'CY',
  'HR', 'MA', 'EG', 'ZA', 'TZ', 'SC', 'MU', 'FJ', 'LK',
  'JP', 'NZ', 'US', 'CA', 'GB', 'DE', 'CH', 'NL', 'IS', 'NO',
  'SE', 'DK', 'IN', 'MY', 'SG', 'KH', 'PE', 'AR', 'CL', 'CO', 'AE',
  'CN', 'TW',
] as const;

const REGION_BY_CODE: Record<(typeof TOP_COUNTRY_CODES)[number], string> = {
  TH: 'Asia', ES: 'Europe', FR: 'Europe', IT: 'Europe', GR: 'Europe', PT: 'Europe', TR: 'Europe',
  MX: 'North America', ID: 'Asia', BR: 'South America', MV: 'Asia', AU: 'Oceania', PH: 'Asia',
  BB: 'Caribbean', JM: 'Caribbean', DO: 'Caribbean', CU: 'Caribbean', CR: 'Central America',
  VN: 'Asia', CY: 'Europe', HR: 'Europe', MA: 'Africa', EG: 'Africa', ZA: 'Africa', TZ: 'Africa',
  SC: 'Africa', MU: 'Africa', FJ: 'Oceania', LK: 'Asia', JP: 'Asia', NZ: 'Oceania',
  US: 'North America', CA: 'North America', GB: 'Europe', DE: 'Europe', CH: 'Europe', NL: 'Europe',
  IS: 'Europe', NO: 'Europe', SE: 'Europe', DK: 'Europe', IN: 'Asia', MY: 'Asia', SG: 'Asia',
  KH: 'Asia', PE: 'South America', AR: 'South America', CL: 'South America', CO: 'South America',
  AE: 'Middle East', CN: 'Asia', TW: 'Asia',
};

interface CountryTravelRow {
  countryCode: string;
  countryName: string;
  bestMonths: number[];
  shoulderMonths: number[];
  avoidMonths: number[];
  suggestedTripDays: { min: number; max: number; recommended: number };
  climateNotes?: string;
  events?: Array<{ id: string; name: string; month: number; type: string; summary: string }>;
}

interface IslandSeed {
  name: string;
  countryCode: string;
  aliases?: string[];
}

interface AirportSeed {
  iataCode: string | null;
  name: string;
  municipality: string | null;
  countryCode: string;
  commercialServiceTier: 'local' | 'regional' | 'major';
}

const COUNTRY_TAGS: Record<string, string[]> = {
  TH: ['food', 'culture', 'beaches'], ES: ['food', 'cities', 'islands'],
  FR: ['food', 'culture', 'cities'], IT: ['food', 'art', 'history'],
  GR: ['islands', 'history', 'beaches'], PT: ['coast', 'cities', 'road trip'],
  ID: ['islands', 'nature', 'surf'], JP: ['culture', 'food', 'rail'],
  NZ: ['nature', 'hiking', 'road trip'], IS: ['nature', 'road trip', 'photography'],
  NO: ['fjords', 'nature', 'rail'], IN: ['culture', 'food', 'history'],
  MX: ['food', 'culture', 'beaches'], MA: ['culture', 'food', 'desert'],
  CN: ['culture', 'history', 'rail'], TW: ['food', 'nature', 'cities'],
};

const CURATED_CHILDREN: Record<string, Array<{ name: string; kind: 'city' | 'island' }>> = {
  TH: [
    { name: 'Bangkok', kind: 'city' },
    { name: 'Chiang Mai', kind: 'city' },
    { name: 'Phuket', kind: 'island' },
    { name: 'Koh Samui', kind: 'island' },
    { name: 'Krabi', kind: 'city' },
  ],
  ES: [
    { name: 'Madrid', kind: 'city' },
    { name: 'Barcelona', kind: 'city' },
    { name: 'Seville', kind: 'city' },
    { name: 'Mallorca', kind: 'island' },
  ],
  CN: [
    { name: 'Beijing', kind: 'city' },
    { name: 'Shanghai', kind: 'city' },
    { name: 'Xi’an', kind: 'city' },
    { name: 'Chengdu', kind: 'city' },
    { name: 'Guilin', kind: 'city' },
  ],
  TW: [
    { name: 'Taipei', kind: 'city' },
    { name: 'Tainan', kind: 'city' },
    { name: 'Taichung', kind: 'city' },
    { name: 'Hualien', kind: 'city' },
    { name: 'Kaohsiung', kind: 'city' },
  ],
};

const CURATED_HIGHLIGHTS: Record<string, string[]> = {
  'thailand/bangkok': ['Grand Palace', 'Wat Pho', 'Chatuchak Weekend Market'],
  'thailand/chiang-mai': ['Old City temples', 'Doi Suthep', 'Night Bazaar'],
  'thailand/phuket': ['Phuket Old Town', 'Phang Nga Bay', 'Andaman beaches'],
  'thailand/koh-samui': ['Ang Thong Marine Park', 'Fisherman’s Village', 'Gulf beaches'],
  'thailand/krabi': ['Railay', 'Ao Nang', 'Hong Islands'],
  'spain/mallorca': ['Serra de Tramuntana', 'Palma Old Town', 'Cala beaches'],
  'spain/barcelona': ['Sagrada Família', 'Gothic Quarter', 'Montjuïc'],
  'spain/seville': ['Real Alcázar', 'Santa Cruz', 'Plaza de España'],
  'china/beijing': ['Forbidden City', 'Temple of Heaven', 'Great Wall at Mutianyu'],
  'china/shanghai': ['The Bund', 'Yu Garden', 'Shanghai Museum'],
  'china/xi-an': ['Terracotta Army', 'Xi’an City Wall', 'Muslim Quarter'],
  'china/chengdu': ['Chengdu Research Base of Giant Panda Breeding', 'Wuhou Shrine', 'Jinli Street'],
  'china/guilin': ['Li River', 'Longji Rice Terraces', 'Reed Flute Cave'],
  'taiwan/taipei': ['Taipei 101', 'National Palace Museum', 'Shilin Night Market'],
  'taiwan/tainan': ['Anping Fort', 'Chihkan Tower', 'Tainan Confucius Temple'],
  'taiwan/taichung': ['National Taichung Theater', 'Rainbow Village', 'Gaomei Wetlands'],
  'taiwan/hualien': ['Taroko Gorge', 'Qingshui Cliffs', 'Qixingtan Beach'],
  'taiwan/kaohsiung': ['Lotus Pond', 'Pier-2 Art Center', 'Cijin Island'],
};

const THAILAND_EVENTS: DestinationEvent[] = [
  {
    id: 'songkran',
    name: 'Songkran',
    month: 4,
    type: 'festival',
    summary: 'Thai New Year combines family and temple traditions with public water celebrations.',
    sourceUrl: 'https://www.tourismthailand.org/Experiences/Details/festivals/29',
  },
  {
    id: 'loi-krathong',
    name: 'Loi Krathong',
    month: 11,
    type: 'festival',
    summary: 'Communities gather for candlelit floating-basket ceremonies after the rainy season.',
    sourceUrl: 'https://www.tourismthailand.org/Experiences/Details/festivals/29',
  },
];

const normalizeSlug = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const buildCountryLinks = (countryCode: string): DestinationGuideEntry['sourceLinks'] => {
  const links = [
    buildDestinationSourceLink({
      label: 'OurAirports open airport reference',
      rawUrl: AIRPORT_REFERENCE_METADATA.sources.primary,
      purpose: 'guide',
      accessedAt: REVIEWED_AT,
    }),
  ];
  if (countryCode === 'TH') {
    links.push(
      buildDestinationSourceLink({
        label: 'Tourism Authority of Thailand weather guide',
        rawUrl: 'https://www.tourismthailand.org/Plan-Your-Trip/Weather?province=219',
        purpose: 'guide',
        accessedAt: REVIEWED_AT,
      }),
      buildDestinationSourceLink({
        label: 'Tourism Authority of Thailand festival guide',
        rawUrl: 'https://www.tourismthailand.org/Experiences/Details/festivals/29',
        purpose: 'event_calendar',
        accessedAt: REVIEWED_AT,
      }),
      buildDestinationSourceLink({
        label: 'Observed connectivity partner',
        rawUrl: 'https://saily.com/esim-thailand/?utm_source=atobeach',
        purpose: 'connectivity',
        accessedAt: REVIEWED_AT,
        referralHint: true,
      }),
    );
  }
  if (countryCode === 'CN') {
    links.push(
      buildDestinationSourceLink({
        label: 'Ministry of Culture and Tourism of China',
        rawUrl: 'https://www.mct.gov.cn/',
        purpose: 'guide',
        accessedAt: REVIEWED_AT,
      }),
      buildDestinationSourceLink({
        label: 'China National Immigration Administration',
        rawUrl: 'https://en.nia.gov.cn/',
        purpose: 'entry_requirements',
        accessedAt: REVIEWED_AT,
      }),
    );
  }
  if (countryCode === 'TW') {
    links.push(
      buildDestinationSourceLink({
        label: 'Taiwan Tourism Administration official guide',
        rawUrl: 'https://eng.taiwan.net.tw/',
        purpose: 'guide',
        accessedAt: REVIEWED_AT,
      }),
      buildDestinationSourceLink({
        label: 'Taiwan Bureau of Consular Affairs entry information',
        rawUrl: 'https://www.boca.gov.tw/',
        purpose: 'entry_requirements',
        accessedAt: REVIEWED_AT,
      }),
    );
  }
  return links;
};

const airportRank = (tier: AirportSeed['commercialServiceTier']): number => {
  if (tier === 'major') return 0;
  if (tier === 'regional') return 1;
  return 2;
};

const getCountryAirports = (countryCode: string): AirportSeed[] => (
  (COMMERCIAL_AIRPORT_REFERENCES as readonly unknown[])
    .map((airport) => airport as AirportSeed)
    .filter((airport) => airport.countryCode === countryCode && airport.iataCode)
    .sort((left, right) => airportRank(left.commercialServiceTier) - airportRank(right.commercialServiceTier)
      || left.name.localeCompare(right.name))
);

const buildCountryGuide = (
  travel: CountryTravelRow,
  region: string,
  priorityRank: number,
): DestinationGuideEntry => {
  const slug = normalizeSlug(travel.countryName);
  const airports = getCountryAirports(travel.countryCode);
  return {
    id: `country:${slug}`,
    name: travel.countryName,
    slug,
    kind: 'country',
    countryCode: travel.countryCode,
    region,
    priorityRank,
    tags: COUNTRY_TAGS[travel.countryCode] || [],
    suggestedTripDays: travel.suggestedTripDays,
    seasonality: {
      idealMonths: travel.bestMonths,
      shoulderMonths: travel.shoulderMonths,
      avoidMonths: travel.avoidMonths,
      note: travel.countryCode === 'TH'
        ? 'Thailand’s regions have different monsoon timings, especially between the Andaman and Gulf coasts.'
        : travel.climateNotes,
    },
    airports: airports.slice(0, 6).map((airport) => ({ iata: airport.iataCode || '', name: airport.name })),
    beaches: [],
    highlights: [],
    events: travel.countryCode === 'TH' ? THAILAND_EVENTS : (travel.events || []).slice(0, 3),
    sourceLinks: buildCountryLinks(travel.countryCode),
    sourceUpdatedAt: AIRPORT_REFERENCE_METADATA.generatedAt,
    reviewedAt: REVIEWED_AT,
  };
};

const buildChildGuide = (
  country: DestinationGuideEntry,
  name: string,
  kind: 'city' | 'island',
  sourceLinks: DestinationGuideEntry['sourceLinks'],
): DestinationGuideEntry => {
  const slug = normalizeSlug(name);
  return {
    id: `${kind}:${country.slug}:${slug}`,
    name,
    slug,
    kind,
    countryCode: country.countryCode,
    region: country.region,
    parentSlug: country.slug,
    tags: [kind],
    suggestedTripDays: kind === 'island'
      ? { min: 3, max: 7, recommended: 5 }
      : { min: 2, max: 5, recommended: 3 },
    airports: [],
    beaches: [],
    highlights: CURATED_HIGHLIGHTS[`${country.slug}/${slug}`] || [],
    events: [],
    sourceLinks,
    sourceUpdatedAt: country.sourceUpdatedAt,
    reviewedAt: REVIEWED_AT,
  };
};

const buildChildGuides = (
  country: DestinationGuideEntry,
  islands: IslandSeed[],
): DestinationGuideEntry[] => {
  const children = new Map<string, DestinationGuideEntry>();
  const add = (name: string, kind: 'city' | 'island', sourcedFromAirports = false) => {
    const slug = normalizeSlug(name);
    if (!slug || children.has(slug)) return;
    const links = sourcedFromAirports
      ? country.sourceLinks.filter((link) => link.label.startsWith('OurAirports'))
      : [];
    children.set(slug, buildChildGuide(country, name, kind, links));
  };

  (CURATED_CHILDREN[country.countryCode] || []).forEach((child) => add(child.name, child.kind));

  const curatedIslandNames = new Set(
    islands
      .filter((island) => island.countryCode === country.countryCode)
      .flatMap((island) => [island.name, ...(island.aliases || [])])
      .map(normalizeSlug),
  );
  getCountryAirports(country.countryCode)
    .map((airport) => airport.municipality)
    .filter((municipality): municipality is string => Boolean(municipality?.trim()))
    .slice(0, 12)
    .forEach((municipality) => add(
      municipality,
      curatedIslandNames.has(normalizeSlug(municipality)) ? 'island' : 'city',
      true,
    ));

  islands
    .filter((island) => island.countryCode === country.countryCode)
    .slice(0, 5)
    .forEach((island) => add(island.name, 'island'));

  return Array.from(children.values()).slice(0, 16);
};

const main = async (): Promise<void> => {
  const travelRows = (countryTravelDataJson as { countries: CountryTravelRow[] }).countries;
  const travelByCode = new Map(travelRows.map((entry) => [entry.countryCode, entry]));
  const islands = islandSeedsJson as IslandSeed[];
  const guides: DestinationGuideEntry[] = [];
  const sourceCatalog: DestinationCatalogEntry[] = [];

  TOP_COUNTRY_CODES.forEach((countryCode, index) => {
    const travel = travelByCode.get(countryCode);
    if (!travel) throw new Error(`TravelFlow country data is missing ${countryCode}`);
    const country = buildCountryGuide(travel, REGION_BY_CODE[countryCode], index + 1);
    guides.push(country, ...buildChildGuides(country, islands));
    sourceCatalog.push({
      name: country.name,
      code: country.countryCode,
      slug: country.slug,
      region: country.region,
      popularity: TOP_COUNTRY_CODES.length - index,
      contentUpdatedAt: country.sourceUpdatedAt,
      canonicalPath: `/inspirations/country/${country.slug}`,
    });
  });

  const document: DestinationGuideDocument = {
    schemaVersion: 1,
    generatedAt: REVIEWED_AT,
    selection: {
      countryCount: TOP_COUNTRY_CODES.length,
      method: 'TravelFlow launch priority: 29 referenced popularity leaders plus 23 destinations represented by existing product content.',
      countryCodes: [...TOP_COUNTRY_CODES],
    },
    sourceCatalog,
    guides,
  };
  const errors = validateDestinationGuideDocument(document);
  if (errors.length > 0) throw new Error(`Destination guide validation failed:\n${errors.join('\n')}`);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${guides.length} guides (${TOP_COUNTRY_CODES.length} countries) to ${OUTPUT_PATH}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
