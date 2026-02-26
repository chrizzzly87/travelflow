export type GreetingNameOrder = 'given_first' | 'family_first';

export interface InternationalGreetingCatalogEntry {
  id: string;
  greeting: string;
  transliteration: string;
  phonetic: string;
  context: string;
  language: string;
  inspirationCountry: string;
  inspirationFlag: string;
  nameOrder: GreetingNameOrder;
}

export const INTERNATIONAL_GREETINGS_CATALOG: InternationalGreetingCatalogEntry[] = [
  {
    id: 'haw-aloha',
    greeting: 'Aloha',
    transliteration: 'Aloha',
    phonetic: 'uh-LOH-hah',
    context: 'Used in Hawaii for hello, goodbye, and warmth in everyday life.',
    language: 'Hawaiian',
    inspirationCountry: 'USA',
    inspirationFlag: '🇺🇸',
    nameOrder: 'given_first',
  },
  {
    id: 'kor-annyeong',
    greeting: '안녕하세요',
    transliteration: 'Annyeonghaseyo',
    phonetic: 'ahn-nyawng-ha-seh-yo',
    context: 'A polite Korean greeting used in most daily situations.',
    language: 'Korean',
    inspirationCountry: 'South Korea',
    inspirationFlag: '🇰🇷',
    nameOrder: 'family_first',
  },
  {
    id: 'jpn-konnichiwa',
    greeting: 'こんにちは',
    transliteration: 'Konnichiwa',
    phonetic: 'kohn-nee-chee-wah',
    context: 'A standard daytime Japanese greeting with a friendly tone.',
    language: 'Japanese',
    inspirationCountry: 'Japan',
    inspirationFlag: '🇯🇵',
    nameOrder: 'family_first',
  },
  {
    id: 'tha-sawasdee',
    greeting: 'สวัสดี',
    transliteration: 'Sawasdee',
    phonetic: 'sah-wat-dee',
    context: 'Thai greeting used throughout the day, often paired with a wai.',
    language: 'Thai',
    inspirationCountry: 'Thailand',
    inspirationFlag: '🇹🇭',
    nameOrder: 'given_first',
  },
  {
    id: 'hin-namaste',
    greeting: 'नमस्ते',
    transliteration: 'Namaste',
    phonetic: 'nuh-muh-stay',
    context: 'A respectful greeting in India often used in formal and informal settings.',
    language: 'Hindi',
    inspirationCountry: 'India',
    inspirationFlag: '🇮🇳',
    nameOrder: 'given_first',
  },
  {
    id: 'spa-hola',
    greeting: 'Hola',
    transliteration: 'Hola',
    phonetic: 'OH-lah',
    context: 'A simple Spanish greeting used in almost any social context.',
    language: 'Spanish',
    inspirationCountry: 'Mexico',
    inspirationFlag: '🇲🇽',
    nameOrder: 'given_first',
  },
  {
    id: 'deu-guten-tag',
    greeting: 'Guten Tag',
    transliteration: 'Guten Tag',
    phonetic: 'GOO-ten tahk',
    context: 'A formal German greeting used in daytime conversations.',
    language: 'German',
    inspirationCountry: 'Germany',
    inspirationFlag: '🇩🇪',
    nameOrder: 'given_first',
  },
  {
    id: 'fra-bonjour',
    greeting: 'Bonjour',
    transliteration: 'Bonjour',
    phonetic: 'bohn-ZHOOR',
    context: 'A common French daytime greeting used in both casual and formal settings.',
    language: 'French',
    inspirationCountry: 'France',
    inspirationFlag: '🇫🇷',
    nameOrder: 'given_first',
  },
  {
    id: 'ita-ciao',
    greeting: 'Ciao',
    transliteration: 'Ciao',
    phonetic: 'chow',
    context: 'Italian greeting used casually for hello and goodbye.',
    language: 'Italian',
    inspirationCountry: 'Italy',
    inspirationFlag: '🇮🇹',
    nameOrder: 'given_first',
  },
  {
    id: 'ara-marhaba',
    greeting: 'مرحبا',
    transliteration: 'Marhaba',
    phonetic: 'mar-ha-ba',
    context: 'A warm Arabic greeting broadly understood across regions.',
    language: 'Arabic',
    inspirationCountry: 'Morocco',
    inspirationFlag: '🇲🇦',
    nameOrder: 'given_first',
  },
];

export const pickRandomInternationalGreeting = (): InternationalGreetingCatalogEntry => {
  if (INTERNATIONAL_GREETINGS_CATALOG.length === 0) {
    return {
      id: 'fallback',
      greeting: 'Hello',
      transliteration: 'Hello',
      phonetic: 'heh-LOW',
      context: 'A universal greeting to kick off your next trip idea.',
      language: 'English',
      inspirationCountry: 'Japan',
      inspirationFlag: '🇯🇵',
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
  nameOrder: GreetingNameOrder
): string => {
  const given = firstName.trim();
  const family = lastName.trim();

  if (!given && !family) return fallback.trim();

  if (nameOrder === 'family_first') {
    return [family, given].filter(Boolean).join(' ').trim();
  }

  return [given, family].filter(Boolean).join(' ').trim();
};
