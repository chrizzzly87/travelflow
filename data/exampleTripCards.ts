import type { AppLanguage } from '../types';

export interface ExampleTripCardLocalization {
  title?: string;
  tags?: string[];
  cities?: string[];
}

interface ExampleTripCountTemplates {
  one?: string;
  few?: string;
  many?: string;
  other: string;
}

interface ExampleTripUiCopy {
  moreInspirationsCta: string;
  days: ExampleTripCountTemplates;
  cities: ExampleTripCountTemplates;
  roundTrip: string;
  routeMapAlt: string;
  routeLegTitle: string;
}

export interface ExampleTripCard {
  id: string;
  title: string;
  countries: { name: string; flag: string }[];
  durationDays: number;
  cityCount: number;
  mapColor: string;
  mapAccent: string;
  username: string;
  avatarColor: string;
  tags: string[];
  mapImagePath?: string;
  templateId?: string;
  isRoundTrip?: boolean;
  localized?: Partial<Record<AppLanguage, ExampleTripCardLocalization>>;
}

const DEFAULT_UI_COPY: ExampleTripUiCopy = {
  moreInspirationsCta: 'Discover more inspirations',
  days: {
    one: '{count} day',
    other: '{count} days',
  },
  cities: {
    one: '{count} city',
    other: '{count} cities',
  },
  roundTrip: 'Round-trip',
  routeMapAlt: 'Route map for {title}',
  routeLegTitle: 'Route leg: {days} days',
};

const EXAMPLE_TRIP_UI_COPY: Partial<Record<AppLanguage, ExampleTripUiCopy>> = {
  en: DEFAULT_UI_COPY,
  de: {
    moreInspirationsCta: 'Weitere Inspirationen entdecken',
    days: {
      one: '{count} Tag',
      other: '{count} Tage',
    },
    cities: {
      one: '{count} Stadt',
      other: '{count} Städte',
    },
    roundTrip: 'Rundreise',
    routeMapAlt: 'Routenkarte für {title}',
    routeLegTitle: 'Routenabschnitt: {days} Tage',
  },
  pl: {
    moreInspirationsCta: 'Odkryj więcej inspiracji',
    days: {
      one: '{count} dzień',
      few: '{count} dni',
      many: '{count} dni',
      other: '{count} dni',
    },
    cities: {
      one: '{count} miasto',
      few: '{count} miasta',
      many: '{count} miast',
      other: '{count} miast',
    },
    roundTrip: 'Podróż w obie strony',
    routeMapAlt: 'Mapa trasy: {title}',
    routeLegTitle: 'Odcinek trasy: {days} dni',
  },
};

const normalizeLocale = (locale?: string): AppLanguage => {
  const base = (locale || '').trim().toLocaleLowerCase().split('-')[0];
  if (base === 'de') return 'de';
  if (base === 'pl') return 'pl';
  if (base === 'es') return 'es';
  if (base === 'fr') return 'fr';
  if (base === 'it') return 'it';
  if (base === 'pt') return 'pt';
  if (base === 'ru') return 'ru';
  return 'en';
};

const interpolate = (
  template: string,
  values: Record<string, string | number>
): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

const resolvePluralTemplate = (
  locale: string | undefined,
  templates: ExampleTripCountTemplates,
  count: number
): string => {
  const category = new Intl.PluralRules(locale || 'en').select(Math.abs(count));
  if (category === 'one' && templates.one) return templates.one;
  if (category === 'few' && templates.few) return templates.few;
  if (category === 'many' && templates.many) return templates.many;
  return templates.other;
};

export const getExampleTripUiCopy = (locale?: string): ExampleTripUiCopy =>
  EXAMPLE_TRIP_UI_COPY[normalizeLocale(locale)] || DEFAULT_UI_COPY;

export const formatExampleTripUiText = (
  template: string,
  values: Record<string, string | number>
): string => interpolate(template, values);

export const formatExampleTripCountLabel = (
  locale: string | undefined,
  templates: ExampleTripCountTemplates,
  count: number
): string => {
  const template = resolvePluralTemplate(locale, templates, count);
  return interpolate(template, { count });
};

export const getLocalizedExampleTripCard = (
  card: ExampleTripCard,
  locale?: string,
  fallbackCities: string[] = []
): { title: string; tags: string[]; cities: string[] } => {
  const localeKey = normalizeLocale(locale);
  const localized = card.localized?.[localeKey] || card.localized?.en;

  const title = localized?.title || card.title;
  const tags = localized?.tags && localized.tags.length === card.tags.length
    ? localized.tags
    : card.tags;
  const cities = localized?.cities && localized.cities.length > 0
    ? localized.cities
    : fallbackCities;

  return { title, tags, cities };
};

export const exampleTripCards: ExampleTripCard[] = [
  {
    id: 'portugal-coast',
    title: 'Atlantic Coast Road Trip',
    countries: [{ name: 'Portugal', flag: '🇵🇹' }],
    durationDays: 10,
    cityCount: 4,
    mapColor: 'bg-sky-100',
    mapAccent: 'bg-sky-400',
    username: 'surf_nomad',
    avatarColor: 'bg-sky-600',
    tags: ['Surf', 'Culture', 'Wine'],
    mapImagePath: '/images/trip-maps/portugal-coast.png',
    templateId: 'portugal-coast',
    localized: {
      de: {
        title: 'Atlantik-Küsten-Roadtrip',
        tags: ['Surfen', 'Kultur', 'Wein'],
        cities: ['Lissabon', 'Sintra', 'Porto', 'Algarve (Lagos)'],
      },
      pl: {
        title: 'Road trip po atlantyckim wybrzeżu',
        tags: ['Surfing', 'Kultura', 'Wino'],
        cities: ['Lizbona', 'Sintra', 'Porto', 'Algarve (Lagos)'],
      },
    },
  },
  {
    id: 'italy-classic',
    title: 'Italian Grand Tour',
    countries: [{ name: 'Italy', flag: '🇮🇹' }],
    durationDays: 18,
    cityCount: 6,
    mapColor: 'bg-amber-100',
    mapAccent: 'bg-amber-500',
    username: 'dolce_vita',
    avatarColor: 'bg-amber-600',
    tags: ['Food', 'Art', 'History'],
    mapImagePath: '/images/trip-maps/italy-classic.png',
    templateId: 'italy-classic',
    localized: {
      de: {
        title: 'Große Italien-Rundreise',
        tags: ['Essen', 'Kunst', 'Geschichte'],
        cities: ['Rom', 'Florenz', 'Cinque Terre', 'Venedig', 'Amalfiküste', 'Mailand'],
      },
      pl: {
        title: 'Wielka podróż po Włoszech',
        tags: ['Jedzenie', 'Sztuka', 'Historia'],
        cities: ['Rzym', 'Florencja', 'Cinque Terre', 'Wenecja', 'Wybrzeże Amalfi', 'Mediolan'],
      },
    },
  },
  {
    id: 'thailand-islands',
    title: 'Temples & Beaches',
    countries: [{ name: 'Thailand', flag: '🇹🇭' }],
    durationDays: 26,
    cityCount: 7,
    mapColor: 'bg-emerald-100',
    mapAccent: 'bg-emerald-400',
    username: 'island_hopper',
    avatarColor: 'bg-emerald-500',
    tags: ['Beach', 'Adventure', 'Food'],
    mapImagePath: '/images/trip-maps/thailand-islands.png',
    templateId: 'thailand-islands',
    isRoundTrip: true,
    localized: {
      de: {
        title: 'Tempel und Strände',
        tags: ['Strand', 'Abenteuer', 'Essen'],
        cities: ['Bangkok', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Bangkok'],
      },
      pl: {
        title: 'Świątynie i plaże',
        tags: ['Plaża', 'Przygoda', 'Jedzenie'],
        cities: ['Bangkok', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Bangkok'],
      },
    },
  },
  {
    id: 'japan-spring',
    title: 'Cherry Blossom Trail',
    countries: [{ name: 'Japan', flag: '🇯🇵' }],
    durationDays: 14,
    cityCount: 5,
    mapColor: 'bg-rose-100',
    mapAccent: 'bg-rose-400',
    username: 'sakura_wanderer',
    avatarColor: 'bg-rose-500',
    tags: ['Culture', 'Food', 'Nature'],
    mapImagePath: '/images/trip-maps/japan-spring.png',
    templateId: 'japan-spring',
    localized: {
      de: {
        title: 'Kirschblüten-Route',
        tags: ['Kultur', 'Essen', 'Natur'],
        cities: ['Tokio', 'Hakone', 'Kyoto', 'Osaka', 'Hiroshima'],
      },
      pl: {
        title: 'Szlak kwitnących wiśni',
        tags: ['Kultura', 'Jedzenie', 'Natura'],
        cities: ['Tokio', 'Hakone', 'Kioto', 'Osaka', 'Hiroszima'],
      },
    },
  },
  {
    id: 'peru-adventure',
    title: 'Andes & Amazon Explorer',
    countries: [{ name: 'Peru', flag: '🇵🇪' }],
    durationDays: 16,
    cityCount: 6,
    mapColor: 'bg-orange-100',
    mapAccent: 'bg-orange-400',
    username: 'altitude_addict',
    avatarColor: 'bg-orange-600',
    tags: ['Adventure', 'Nature', 'History'],
    mapImagePath: '/images/trip-maps/peru-adventure.png',
    templateId: 'peru-adventure',
    isRoundTrip: true,
    localized: {
      de: {
        title: 'Anden- und Amazonas-Abenteuer',
        tags: ['Abenteuer', 'Natur', 'Geschichte'],
        cities: ['Lima', 'Cusco', 'Heiliges Tal', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
      },
      pl: {
        title: 'Andy i Amazonia',
        tags: ['Przygoda', 'Natura', 'Historia'],
        cities: ['Lima', 'Cusco', 'Święta Dolina', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
      },
    },
  },
  {
    id: 'new-zealand-wild',
    title: 'South Island Wilderness',
    countries: [{ name: 'New Zealand', flag: '🇳🇿' }],
    durationDays: 21,
    cityCount: 8,
    mapColor: 'bg-teal-100',
    mapAccent: 'bg-teal-400',
    username: 'kiwi_trails',
    avatarColor: 'bg-teal-600',
    tags: ['Nature', 'Hiking', 'Road Trip'],
    mapImagePath: '/images/trip-maps/new-zealand-wild.png',
    templateId: 'new-zealand-wild',
    localized: {
      de: {
        title: 'Wildnis der Südinsel',
        tags: ['Natur', 'Wandern', 'Roadtrip'],
        cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
      },
      pl: {
        title: 'Dzika przyroda Wyspy Południowej',
        tags: ['Natura', 'Trekking', 'Road trip'],
        cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
      },
    },
  },
  {
    id: 'morocco-medina',
    title: 'Medinas & Sahara Nights',
    countries: [{ name: 'Morocco', flag: '🇲🇦' }],
    durationDays: 9,
    cityCount: 4,
    mapColor: 'bg-yellow-100',
    mapAccent: 'bg-yellow-500',
    username: 'desert_dreamer',
    avatarColor: 'bg-yellow-700',
    tags: ['Culture', 'Food', 'Desert'],
    mapImagePath: '/images/trip-maps/morocco-medina.png',
    templateId: 'morocco-medina',
    localized: {
      de: {
        title: 'Medinas und Sahara-Nächte',
        tags: ['Kultur', 'Essen', 'Wüste'],
        cities: ['Marrakesch', 'Chefchaouen', 'Fès', 'Merzouga / Sahara'],
      },
      pl: {
        title: 'Medyny i noce na Saharze',
        tags: ['Kultura', 'Jedzenie', 'Pustynia'],
        cities: ['Marrakesz', 'Szafszawan', 'Fez', 'Merzouga / Sahara'],
      },
    },
  },
  {
    id: 'iceland-ring',
    title: 'Ring Road Circuit',
    countries: [{ name: 'Iceland', flag: '🇮🇸' }],
    durationDays: 7,
    cityCount: 4,
    mapColor: 'bg-indigo-100',
    mapAccent: 'bg-indigo-400',
    username: 'arctic_rover',
    avatarColor: 'bg-indigo-600',
    tags: ['Nature', 'Road Trip', 'Photography'],
    mapImagePath: '/images/trip-maps/iceland-ring.png',
    templateId: 'iceland-ring',
    isRoundTrip: true,
    localized: {
      de: {
        title: 'Ringstraßen-Rundtour',
        tags: ['Natur', 'Roadtrip', 'Fotografie'],
        cities: ['Reykjavik', 'Vík', 'Akureyri', 'Reykjavik'],
      },
      pl: {
        title: 'Pętla Ring Road',
        tags: ['Natura', 'Road trip', 'Fotografia'],
        cities: ['Reykjavik', 'Vík', 'Akureyri', 'Reykjavik'],
      },
    },
  },
];

export const getExampleTripCardByTemplateId = (templateId: string): ExampleTripCard | undefined =>
  exampleTripCards.find((card) => card.templateId === templateId);
