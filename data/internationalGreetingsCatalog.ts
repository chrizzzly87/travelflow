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
    context: 'Thai greeting used throughout the day, often paired with a wai; speakers add polite endings by their own gender (khrap for men, kha for women).',
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
  {
    id: 'deu-moin',
    greeting: 'Moin',
    transliteration: 'Moin',
    ipa: 'mɔɪn',
    context: 'Classic in Northern Germany at any hour; locals joke that “Moin Moin” is mostly said by tourists.',
    language: 'Northern German',
    inspirationCountry: 'Germany',
    inspirationCountryCode: 'DE',
    nameOrder: 'given_first',
  },
  {
    id: 'gsw-gruezi',
    greeting: 'Grüezi',
    transliteration: 'Gruezi',
    ipa: 'ˈɡryə̯t͡si',
    context: 'A polite Swiss German hello often heard in shops, trains, and mountain towns.',
    language: 'Swiss German',
    inspirationCountry: 'Switzerland',
    inspirationCountryCode: 'CH',
    nameOrder: 'given_first',
  },
  {
    id: 'eus-kaixo',
    greeting: 'Kaixo',
    transliteration: 'Kaixo',
    ipa: 'ˈkaiʃo',
    context: 'Basque greeting used in Euskadi; hearing it is a quick sign the region keeps its language alive.',
    language: 'Basque',
    inspirationCountry: 'Spain',
    inspirationCountryCode: 'ES',
    nameOrder: 'given_first',
  },
  {
    id: 'gle-dia-dhuit',
    greeting: 'Dia dhuit',
    transliteration: 'Dia dhuit',
    ipa: 'dʲiə ɣɪtʲ',
    context: 'Irish for “hello,” literally “God be with you,” and still common in Gaeltacht areas.',
    language: 'Irish',
    inspirationCountry: 'Ireland',
    inspirationCountryCode: 'IE',
    nameOrder: 'given_first',
  },
  {
    id: 'cym-shwmae',
    greeting: 'Shwmae',
    transliteration: 'Shwmae',
    ipa: 'ˈʃuːmai',
    context: 'Friendly Welsh hello that often appears on bilingual signs and local radio intros.',
    language: 'Welsh',
    inspirationCountry: 'United Kingdom',
    inspirationCountryCode: 'GB',
    nameOrder: 'given_first',
  },
  {
    id: 'isl-godan-daginn',
    greeting: 'Góðan daginn',
    transliteration: 'Godan daginn',
    ipa: 'ˈkouːðan ˈtaijɪn',
    context: 'Icelandic “good day”; locals often shorten it in casual speech, especially in Reykjavík cafés.',
    language: 'Icelandic',
    inspirationCountry: 'Iceland',
    inspirationCountryCode: 'IS',
    nameOrder: 'given_first',
  },
  {
    id: 'ces-ahoj',
    greeting: 'Ahoj',
    transliteration: 'Ahoj',
    ipa: 'ˈaɦoj',
    context: 'Popular Czech hello among friends; it began as a sailors’ call and stuck in daily speech.',
    language: 'Czech',
    inspirationCountry: 'Czech Republic',
    inspirationCountryCode: 'CZ',
    nameOrder: 'given_first',
  },
  {
    id: 'swe-hej',
    greeting: 'Hej',
    transliteration: 'Hej',
    ipa: 'hɛj',
    context: 'Default Swedish hello for both friends and coworkers, often doubled in cheerful “hej hej.”',
    language: 'Swedish',
    inspirationCountry: 'Sweden',
    inspirationCountryCode: 'SE',
    nameOrder: 'given_first',
  },
  {
    id: 'nld-hoi',
    greeting: 'Hoi',
    transliteration: 'Hoi',
    ipa: 'ɦɔi',
    context: 'Casual Dutch greeting common in the Netherlands and Flanders, especially among younger speakers.',
    language: 'Dutch',
    inspirationCountry: 'Netherlands',
    inspirationCountryCode: 'NL',
    nameOrder: 'given_first',
  },
  {
    id: 'mri-kia-ora',
    greeting: 'Kia ora',
    transliteration: 'Kia ora',
    ipa: 'ki.a ˈɔ.ɾa',
    context: 'Māori greeting in New Zealand used for hello, thanks, and general positive energy.',
    language: 'Māori',
    inspirationCountry: 'New Zealand',
    inspirationCountryCode: 'NZ',
    nameOrder: 'given_first',
  },
  {
    id: 'khm-suostei',
    greeting: 'សួស្តី',
    transliteration: 'Suostei',
    ipa: 'suə sɗəj',
    context: 'Khmer greeting heard across Cambodia; respectful tone matters as much as the words.',
    language: 'Khmer',
    inspirationCountry: 'Cambodia',
    inspirationCountryCode: 'KH',
    nameOrder: 'given_first',
  },
  {
    id: 'lao-sabaidee',
    greeting: 'ສະບາຍດີ',
    transliteration: 'Sabaidee',
    ipa: 'sa.báːj.diː',
    context: 'Lao greeting also tied to well-being, reflecting a calm and friendly social style.',
    language: 'Lao',
    inspirationCountry: 'Laos',
    inspirationCountryCode: 'LA',
    nameOrder: 'given_first',
  },
  {
    id: 'swa-jambo',
    greeting: 'Jambo',
    transliteration: 'Jambo',
    ipa: 'ˈdʒam.bo',
    context: 'Widely recognized Swahili greeting in East Africa; many locals also use “Hujambo?” for “How are you?”',
    language: 'Swahili',
    inspirationCountry: 'Kenya',
    inspirationCountryCode: 'KE',
    nameOrder: 'given_first',
  },
  {
    id: 'yue-nei-hou',
    greeting: '你好',
    transliteration: 'Nei hou',
    ipa: 'nei̯˨˩ hou̯˧˥',
    context: 'Cantonese greeting common in Hong Kong; tones matter, so pronunciation changes meaning fast.',
    language: 'Cantonese',
    inspirationCountry: 'China',
    inspirationCountryCode: 'CN',
    nameOrder: 'family_first',
  },
  {
    id: 'zho-ni-hao',
    greeting: '你好',
    transliteration: 'Ni hao',
    ipa: 'ni˨˩˦ xaʊ̯˨˩˦',
    context: 'Mandarin greeting used across China; in casual chats people may jump straight to daily-life questions.',
    language: 'Mandarin Chinese',
    inspirationCountry: 'China',
    inspirationCountryCode: 'CN',
    nameOrder: 'family_first',
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
