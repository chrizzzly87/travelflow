export type GreetingNameOrder = 'given_first' | 'family_first';

export interface InternationalGreetingCatalogEntry {
  id: string;
  greeting: string;
  transliteration: string;
  ipa: string;
  context: string;
  language: string;
  inspirationCountry: string;
  inspirationCountryCode: string;
  nameOrder: GreetingNameOrder;
}

export const INTERNATIONAL_GREETINGS_CATALOG: InternationalGreetingCatalogEntry[] = [
  {
    id: 'haw-aloha',
    greeting: 'Aloha',
    transliteration: 'Aloha',
    ipa: 'əˈloʊhɑ',
    context: 'Used in Hawaii for hello, goodbye, and warmth in everyday life.',
    language: 'Hawaiian',
    inspirationCountry: 'USA',
    inspirationCountryCode: 'US',
    nameOrder: 'given_first',
  },
  {
    id: 'kor-annyeong',
    greeting: '안녕하세요',
    transliteration: 'Annyeonghaseyo',
    ipa: 'aɲjʌŋɦa.se.jo',
    context: 'A polite Korean greeting used in most daily situations.',
    language: 'Korean',
    inspirationCountry: 'South Korea',
    inspirationCountryCode: 'KR',
    nameOrder: 'family_first',
  },
  {
    id: 'jpn-konnichiwa',
    greeting: 'こんにちは',
    transliteration: 'Konnichiwa',
    ipa: 'koɲ.ni.tɕi.wa',
    context: 'A standard daytime Japanese greeting with a friendly tone.',
    language: 'Japanese',
    inspirationCountry: 'Japan',
    inspirationCountryCode: 'JP',
    nameOrder: 'family_first',
  },
  {
    id: 'tha-sawasdee',
    greeting: 'สวัสดี',
    transliteration: 'Sawasdee',
    ipa: 'sa.wat.diː',
    context: 'Thai greeting used throughout the day, often paired with a wai.',
    language: 'Thai',
    inspirationCountry: 'Thailand',
    inspirationCountryCode: 'TH',
    nameOrder: 'given_first',
  },
  {
    id: 'hin-namaste',
    greeting: 'नमस्ते',
    transliteration: 'Namaste',
    ipa: 'nə.məs.teː',
    context: 'A respectful greeting in India often used in formal and informal settings.',
    language: 'Hindi',
    inspirationCountry: 'India',
    inspirationCountryCode: 'IN',
    nameOrder: 'given_first',
  },
  {
    id: 'spa-hola',
    greeting: 'Hola',
    transliteration: 'Hola',
    ipa: 'ˈo.la',
    context: 'A simple Spanish greeting used in almost any social context.',
    language: 'Spanish',
    inspirationCountry: 'Mexico',
    inspirationCountryCode: 'MX',
    nameOrder: 'given_first',
  },
  {
    id: 'deu-guten-tag',
    greeting: 'Guten Tag',
    transliteration: 'Guten Tag',
    ipa: 'ˈɡuː.tn̩ taːk',
    context: 'A formal German greeting used in daytime conversations.',
    language: 'German',
    inspirationCountry: 'Germany',
    inspirationCountryCode: 'DE',
    nameOrder: 'given_first',
  },
  {
    id: 'fra-bonjour',
    greeting: 'Bonjour',
    transliteration: 'Bonjour',
    ipa: 'bɔ̃.ʒuʁ',
    context: 'A common French daytime greeting used in both casual and formal settings.',
    language: 'French',
    inspirationCountry: 'France',
    inspirationCountryCode: 'FR',
    nameOrder: 'given_first',
  },
  {
    id: 'ita-ciao',
    greeting: 'Ciao',
    transliteration: 'Ciao',
    ipa: 'ˈtʃa.o',
    context: 'Italian greeting used casually for hello and goodbye.',
    language: 'Italian',
    inspirationCountry: 'Italy',
    inspirationCountryCode: 'IT',
    nameOrder: 'given_first',
  },
  {
    id: 'ara-marhaba',
    greeting: 'مرحبا',
    transliteration: 'Marhaba',
    ipa: 'mar.ħa.ba',
    context: 'A warm Arabic greeting broadly understood across regions.',
    language: 'Arabic',
    inspirationCountry: 'Morocco',
    inspirationCountryCode: 'MA',
    nameOrder: 'given_first',
  },
];

export const pickRandomInternationalGreeting = (): InternationalGreetingCatalogEntry => {
  if (INTERNATIONAL_GREETINGS_CATALOG.length === 0) {
    return {
      id: 'fallback',
      greeting: 'Hello',
      transliteration: 'Hello',
      ipa: 'həˈloʊ',
      context: 'A universal greeting to kick off your next trip idea.',
      language: 'English',
      inspirationCountry: 'Japan',
      inspirationCountryCode: 'JP',
      nameOrder: 'given_first',
    };
  }

  const index = Math.floor(Math.random() * INTERNATIONAL_GREETINGS_CATALOG.length);
  return INTERNATIONAL_GREETINGS_CATALOG[index];
};

export const formatDisplayNameForGreeting = (
  firstName: string,
  lastName: string,
  fallback: string,
  nameOrder: GreetingNameOrder,
  options?: {
    primaryNameOnly?: boolean;
  }
): string => {
  const given = firstName.trim();
  const family = lastName.trim();
  const primaryOnly = options?.primaryNameOnly === true;

  if (!given && !family) return fallback.trim();

  if (nameOrder === 'family_first') {
    if (primaryOnly) return family || given || fallback.trim();
    return [family, given].filter(Boolean).join(' ').trim();
  }

  if (primaryOnly) return given || family || fallback.trim();
  return [given, family].filter(Boolean).join(' ').trim();
};
