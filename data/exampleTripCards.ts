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
  hidden?: boolean;
  localized?: Partial<Record<AppLanguage, ExampleTripCardLocalization>>;
}

const SUPPORTED_EXAMPLE_LOCALES: AppLanguage[] = ['en', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'pl', 'fa', 'ur'];

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
  es: {
    moreInspirationsCta: 'Descubre más inspiraciones',
    days: {
      one: '{count} día',
      other: '{count} días',
    },
    cities: {
      one: '{count} ciudad',
      other: '{count} ciudades',
    },
    roundTrip: 'Viaje de ida y vuelta',
    routeMapAlt: 'Mapa de ruta de {title}',
    routeLegTitle: 'Tramo de ruta: {days} días',
  },
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
  fr: {
    moreInspirationsCta: 'Découvrez plus d\'inspirations',
    days: {
      one: '{count} jour',
      other: '{count} jours',
    },
    cities: {
      one: '{count} ville',
      other: '{count} villes',
    },
    roundTrip: 'Aller-retour',
    routeMapAlt: 'Carte d\'itinéraire pour {title}',
    routeLegTitle: 'Étape d\'itinéraire : {days} jours',
  },
  it: {
    moreInspirationsCta: 'Scopri altre ispirazioni',
    days: {
      one: '{count} giorno',
      other: '{count} giorni',
    },
    cities: {
      one: '{count} città',
      other: '{count} città',
    },
    roundTrip: 'Andata e ritorno',
    routeMapAlt: 'Mappa del percorso per {title}',
    routeLegTitle: 'Tappa del percorso: {days} giorni',
  },
  pt: {
    moreInspirationsCta: 'Descobre mais inspirações',
    days: {
      one: '{count} dia',
      other: '{count} dias',
    },
    cities: {
      one: '{count} cidade',
      other: '{count} cidades',
    },
    roundTrip: 'Ida e volta',
    routeMapAlt: 'Mapa de rota de {title}',
    routeLegTitle: 'Trecho da rota: {days} dias',
  },
  ru: {
    moreInspirationsCta: 'Откройте больше идей',
    days: {
      one: '{count} день',
      few: '{count} дня',
      many: '{count} дней',
      other: '{count} дня',
    },
    cities: {
      one: '{count} город',
      few: '{count} города',
      many: '{count} городов',
      other: '{count} города',
    },
    roundTrip: 'Маршрут туда-обратно',
    routeMapAlt: 'Карта маршрута: {title}',
    routeLegTitle: 'Участок маршрута: {days} дн.',
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
  fa: {
    moreInspirationsCta: 'الهام‌های بیشتر را ببینید',
    days: {
      one: '{count} روز',
      other: '{count} روز',
    },
    cities: {
      one: '{count} شهر',
      other: '{count} شهر',
    },
    roundTrip: 'رفت‌وبرگشت',
    routeMapAlt: 'نقشه مسیر برای {title}',
    routeLegTitle: 'بخش مسیر: {days} روز',
  },
  ur: {
    moreInspirationsCta: 'مزید ترغیبات دیکھیں',
    days: {
      one: '{count} دن',
      other: '{count} دن',
    },
    cities: {
      one: '{count} شہر',
      other: '{count} شہر',
    },
    roundTrip: 'آنا جانا سفر',
    routeMapAlt: '{title} کے لیے روٹ میپ',
    routeLegTitle: 'روٹ حصہ: {days} دن',
  },
};

const TAG_TRANSLATIONS: Partial<Record<AppLanguage, Record<string, string>>> = {
  en: {
    Surf: 'Surf',
    Culture: 'Culture',
    Wine: 'Wine',
    Food: 'Food',
    Art: 'Art',
    History: 'History',
    Beach: 'Beach',
    Adventure: 'Adventure',
    Nature: 'Nature',
    Hiking: 'Hiking',
    'Road Trip': 'Road Trip',
    Desert: 'Desert',
    Photography: 'Photography',
  },
  es: {
    Surf: 'Surf',
    Culture: 'Cultura',
    Wine: 'Vino',
    Food: 'Comida',
    Art: 'Arte',
    History: 'Historia',
    Beach: 'Playa',
    Adventure: 'Aventura',
    Nature: 'Naturaleza',
    Hiking: 'Senderismo',
    'Road Trip': 'Viaje por carretera',
    Desert: 'Desierto',
    Photography: 'Fotografía',
  },
  de: {
    Surf: 'Surfen',
    Culture: 'Kultur',
    Wine: 'Wein',
    Food: 'Essen',
    Art: 'Kunst',
    History: 'Geschichte',
    Beach: 'Strand',
    Adventure: 'Abenteuer',
    Nature: 'Natur',
    Hiking: 'Wandern',
    'Road Trip': 'Roadtrip',
    Desert: 'Wüste',
    Photography: 'Fotografie',
  },
  fr: {
    Surf: 'Surf',
    Culture: 'Culture',
    Wine: 'Vin',
    Food: 'Cuisine',
    Art: 'Art',
    History: 'Histoire',
    Beach: 'Plage',
    Adventure: 'Aventure',
    Nature: 'Nature',
    Hiking: 'Randonnée',
    'Road Trip': 'Road trip',
    Desert: 'Désert',
    Photography: 'Photographie',
  },
  it: {
    Surf: 'Surf',
    Culture: 'Cultura',
    Wine: 'Vino',
    Food: 'Cibo',
    Art: 'Arte',
    History: 'Storia',
    Beach: 'Spiaggia',
    Adventure: 'Avventura',
    Nature: 'Natura',
    Hiking: 'Trekking',
    'Road Trip': 'Road trip',
    Desert: 'Deserto',
    Photography: 'Fotografia',
  },
  pt: {
    Surf: 'Surf',
    Culture: 'Cultura',
    Wine: 'Vinho',
    Food: 'Comida',
    Art: 'Arte',
    History: 'História',
    Beach: 'Praia',
    Adventure: 'Aventura',
    Nature: 'Natureza',
    Hiking: 'Caminhada',
    'Road Trip': 'Road trip',
    Desert: 'Deserto',
    Photography: 'Fotografia',
  },
  ru: {
    Surf: 'Серфинг',
    Culture: 'Культура',
    Wine: 'Вино',
    Food: 'Еда',
    Art: 'Искусство',
    History: 'История',
    Beach: 'Пляж',
    Adventure: 'Приключения',
    Nature: 'Природа',
    Hiking: 'Походы',
    'Road Trip': 'Автопутешествие',
    Desert: 'Пустыня',
    Photography: 'Фотография',
  },
  pl: {
    Surf: 'Surfing',
    Culture: 'Kultura',
    Wine: 'Wino',
    Food: 'Jedzenie',
    Art: 'Sztuka',
    History: 'Historia',
    Beach: 'Plaża',
    Adventure: 'Przygoda',
    Nature: 'Natura',
    Hiking: 'Trekking',
    'Road Trip': 'Road trip',
    Desert: 'Pustynia',
    Photography: 'Fotografia',
  },
  fa: {
    Surf: 'موج‌سواری',
    Culture: 'فرهنگ',
    Wine: 'شراب',
    Food: 'غذا',
    Art: 'هنر',
    History: 'تاریخ',
    Beach: 'ساحل',
    Adventure: 'ماجراجویی',
    Nature: 'طبیعت',
    Hiking: 'پیاده‌روی',
    'Road Trip': 'سفر جاده‌ای',
    Desert: 'بیابان',
    Photography: 'عکاسی',
  },
  ur: {
    Surf: 'سرفنگ',
    Culture: 'ثقافت',
    Wine: 'وائن',
    Food: 'کھانا',
    Art: 'فن',
    History: 'تاریخ',
    Beach: 'ساحل',
    Adventure: 'مہم',
    Nature: 'قدرت',
    Hiking: 'ہائیکنگ',
    'Road Trip': 'روڈ ٹرپ',
    Desert: 'صحرا',
    Photography: 'فوٹوگرافی',
  },
};

const CARD_TITLE_TRANSLATIONS: Partial<Record<AppLanguage, Record<string, string>>> = {
  fa: {
    'portugal-coast': 'جاده‌گردی ساحل آتلانتیک',
    'italy-classic': 'گرند تور ایتالیا',
    'thailand-islands': 'معبدها و سواحل',
    'southeast-asia-backpacking': 'بک‌پکینگ در جنوب‌شرق آسیا',
    'japan-spring': 'مسیر شکوفه‌های گیلاس',
    'peru-adventure': 'ماجراجویی آند و آمازون',
    'new-zealand-wild': 'طبیعت بکر جزیره جنوبی',
    'morocco-medina': 'مدینه‌ها و شب‌های صحرا',
    'iceland-ring': 'مسیر حلقه‌ای رینگ‌رود',
  },
  ur: {
    'portugal-coast': 'اٹلانٹک ساحلی روڈ ٹرپ',
    'italy-classic': 'اطالوی گرینڈ ٹور',
    'thailand-islands': 'مندر اور ساحل',
    'southeast-asia-backpacking': 'جنوب مشرقی ایشیا بیک پیکنگ',
    'japan-spring': 'چیری بلاسم ٹریل',
    'peru-adventure': 'اینڈیز اور ایمیزون ایکسپلورر',
    'new-zealand-wild': 'جنوبی جزیرہ وائلڈرنس',
    'morocco-medina': 'مدینائیں اور صحارا کی راتیں',
    'iceland-ring': 'رنگ روڈ سرکٹ',
  },
};

const CARD_LOCALIZATIONS: Record<string, Partial<Record<AppLanguage, ExampleTripCardLocalization>>> = {
  'portugal-coast': {
    es: {
      title: 'Ruta por la costa atlántica',
      cities: ['Lisboa', 'Sintra', 'Oporto', 'Algarve (Lagos)'],
    },
    de: {
      title: 'Atlantik-Küsten-Roadtrip',
      cities: ['Lissabon', 'Sintra', 'Porto', 'Algarve (Lagos)'],
    },
    fr: {
      title: 'Road trip sur la côte atlantique',
      cities: ['Lisbonne', 'Sintra', 'Porto', 'Algarve (Lagos)'],
    },
    it: {
      title: 'Road trip sulla costa atlantica',
      cities: ['Lisbona', 'Sintra', 'Porto', 'Algarve (Lagos)'],
    },
    pt: {
      title: 'Road trip pela costa atlântica',
      cities: ['Lisboa', 'Sintra', 'Porto', 'Algarve (Lagos)'],
    },
    ru: {
      title: 'Роуд-трип по атлантическому побережью',
      cities: ['Лиссабон', 'Синтра', 'Порту', 'Алгарви (Лагуш)'],
    },
    pl: {
      title: 'Road trip po atlantyckim wybrzeżu',
      cities: ['Lizbona', 'Sintra', 'Porto', 'Algarve (Lagos)'],
    },
  },
  'italy-classic': {
    es: {
      title: 'Gran tour de Italia',
      cities: ['Roma', 'Florencia', 'Cinque Terre', 'Venecia', 'Costa Amalfitana', 'Milán'],
    },
    de: {
      title: 'Große Italien-Rundreise',
      cities: ['Rom', 'Florenz', 'Cinque Terre', 'Venedig', 'Amalfiküste', 'Mailand'],
    },
    fr: {
      title: 'Grand tour d\'Italie',
      cities: ['Rome', 'Florence', 'Cinque Terre', 'Venise', 'Côte amalfitaine', 'Milan'],
    },
    it: {
      title: 'Grande tour d\'Italia',
      cities: ['Roma', 'Firenze', 'Cinque Terre', 'Venezia', 'Costiera amalfitana', 'Milano'],
    },
    pt: {
      title: 'Grande tour pela Itália',
      cities: ['Roma', 'Florença', 'Cinque Terre', 'Veneza', 'Costa Amalfitana', 'Milão'],
    },
    ru: {
      title: 'Гран-тур по Италии',
      cities: ['Рим', 'Флоренция', 'Чинкве-Терре', 'Венеция', 'Амальфитанское побережье', 'Милан'],
    },
    pl: {
      title: 'Wielka podróż po Włoszech',
      cities: ['Rzym', 'Florencja', 'Cinque Terre', 'Wenecja', 'Wybrzeże Amalfi', 'Mediolan'],
    },
  },
  'thailand-islands': {
    es: {
      title: 'Templos y playas',
      cities: ['Bangkok', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Bangkok'],
    },
    de: {
      title: 'Tempel und Strände',
      cities: ['Bangkok', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Bangkok'],
    },
    fr: {
      title: 'Temples et plages',
      cities: ['Bangkok', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Bangkok'],
    },
    it: {
      title: 'Templi e spiagge',
      cities: ['Bangkok', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Bangkok'],
    },
    pt: {
      title: 'Templos e praias',
      cities: ['Banguecoque', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Banguecoque'],
    },
    ru: {
      title: 'Храмы и пляжи',
      cities: ['Бангкок', 'Чиангмай', 'Пай', 'Пхукет', 'Ко-Пхи-Пхи', 'Краби (Ао Нанг)', 'Бангкок'],
    },
    pl: {
      title: 'Świątynie i plaże',
      cities: ['Bangkok', 'Chiang Mai', 'Pai', 'Phuket', 'Ko Phi Phi', 'Krabi (Ao Nang)', 'Bangkok'],
    },
  },
  'southeast-asia-backpacking': {
    en: {
      title: 'Backpacking South East Asia',
      cities: ['Bangkok', 'Siem Reap', 'Phnom Penh', 'Kampot', 'Ho Chi Minh City', 'Hoi An', 'Hanoi', 'Ninh Binh', 'Sapa', 'Vang Vieng', 'Luang Prabang', 'Chiang Mai', 'Bangkok'],
    },
    es: {
      title: 'Mochileo por el Sudeste Asiático',
      cities: ['Bangkok', 'Siem Reap', 'Phnom Penh', 'Kampot', 'Ciudad Ho Chi Minh', 'Hoi An', 'Hanói', 'Ninh Binh', 'Sapa', 'Vang Vieng', 'Luang Prabang', 'Chiang Mai', 'Bangkok'],
    },
    de: {
      title: 'Backpacking in Südostasien',
      cities: ['Bangkok', 'Siem Reap', 'Phnom Penh', 'Kampot', 'Ho-Chi-Minh-Stadt', 'Hoi An', 'Hanoi', 'Ninh Binh', 'Sapa', 'Vang Vieng', 'Luang Prabang', 'Chiang Mai', 'Bangkok'],
    },
    fr: {
      title: 'Backpack en Asie du Sud-Est',
      cities: ['Bangkok', 'Siem Reap', 'Phnom Penh', 'Kampot', 'Hô Chi Minh-Ville', 'Hoi An', 'Hanoï', 'Ninh Binh', 'Sapa', 'Vang Vieng', 'Luang Prabang', 'Chiang Mai', 'Bangkok'],
    },
    it: {
      title: 'Backpacking nel Sud-est asiatico',
      cities: ['Bangkok', 'Siem Reap', 'Phnom Penh', 'Kampot', 'Città di Ho Chi Minh', 'Hoi An', 'Hanoi', 'Ninh Binh', 'Sapa', 'Vang Vieng', 'Luang Prabang', 'Chiang Mai', 'Bangkok'],
    },
    pt: {
      title: 'Mochilão pelo Sudeste Asiático',
      cities: ['Banguecoque', 'Siem Reap', 'Phnom Penh', 'Kampot', 'Cidade de Ho Chi Minh', 'Hoi An', 'Hanói', 'Ninh Binh', 'Sapa', 'Vang Vieng', 'Luang Prabang', 'Chiang Mai', 'Banguecoque'],
    },
    ru: {
      title: 'Бэкпэкинг по Юго-Восточной Азии',
      cities: ['Бангкок', 'Сиемреап', 'Пномпень', 'Кампот', 'Хошимин', 'Хойан', 'Ханой', 'Ниньбинь', 'Сапа', 'Вангвьенг', 'Луангпхабанг', 'Чиангмай', 'Бангкок'],
    },
    pl: {
      title: 'Backpacking po Azji Południowo-Wschodniej',
      cities: ['Bangkok', 'Siem Reap', 'Phnom Penh', 'Kampot', 'Ho Chi Minh', 'Hoi An', 'Hanoi', 'Ninh Binh', 'Sapa', 'Vang Vieng', 'Luang Prabang', 'Chiang Mai', 'Bangkok'],
    },
  },
  'japan-spring': {
    es: {
      title: 'Ruta de los cerezos en flor',
      cities: ['Tokio', 'Hakone', 'Kioto', 'Osaka', 'Hiroshima'],
    },
    de: {
      title: 'Kirschblüten-Route',
      cities: ['Tokio', 'Hakone', 'Kyoto', 'Osaka', 'Hiroshima'],
    },
    fr: {
      title: 'Route des cerisiers en fleurs',
      cities: ['Tokyo', 'Hakone', 'Kyoto', 'Osaka', 'Hiroshima'],
    },
    it: {
      title: 'Itinerario dei ciliegi in fiore',
      cities: ['Tokyo', 'Hakone', 'Kyoto', 'Osaka', 'Hiroshima'],
    },
    pt: {
      title: 'Rota das cerejeiras em flor',
      cities: ['Tóquio', 'Hakone', 'Quioto', 'Osaka', 'Hiroshima'],
    },
    ru: {
      title: 'Маршрут цветущей сакуры',
      cities: ['Токио', 'Хаконэ', 'Киото', 'Осака', 'Хиросима'],
    },
    pl: {
      title: 'Szlak kwitnących wiśni',
      cities: ['Tokio', 'Hakone', 'Kioto', 'Osaka', 'Hiroszima'],
    },
  },
  'peru-adventure': {
    es: {
      title: 'Exploración de Andes y Amazonía',
      cities: ['Lima', 'Cusco', 'Valle Sagrado', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
    },
    de: {
      title: 'Anden- und Amazonas-Abenteuer',
      cities: ['Lima', 'Cusco', 'Heiliges Tal', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
    },
    fr: {
      title: 'Exploration des Andes et de l\'Amazonie',
      cities: ['Lima', 'Cusco', 'Vallée sacrée', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
    },
    it: {
      title: 'Esplorazione di Ande e Amazzonia',
      cities: ['Lima', 'Cusco', 'Valle Sacra', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
    },
    pt: {
      title: 'Exploração dos Andes e da Amazônia',
      cities: ['Lima', 'Cusco', 'Vale Sagrado', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
    },
    ru: {
      title: 'Экспедиция по Андам и Амазонии',
      cities: ['Лима', 'Куско', 'Священная долина', 'Мачу-Пикчу', 'Пуэрто-Мальдонадо', 'Лима'],
    },
    pl: {
      title: 'Andy i Amazonia',
      cities: ['Lima', 'Cusco', 'Święta Dolina', 'Machu Picchu', 'Puerto Maldonado', 'Lima'],
    },
  },
  'new-zealand-wild': {
    es: {
      title: 'Naturaleza salvaje de la Isla Sur',
      cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
    },
    de: {
      title: 'Wildnis der Südinsel',
      cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
    },
    fr: {
      title: 'Nature sauvage de l\'île du Sud',
      cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
    },
    it: {
      title: 'Natura selvaggia dell\'Isola del Sud',
      cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
    },
    pt: {
      title: 'Natureza selvagem da Ilha Sul',
      cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
    },
    ru: {
      title: 'Дикая природа Южного острова',
      cities: ['Крайстчерч', 'Кайкура', 'Абель-Тасман', 'Франц-Иосиф', 'Ванака', 'Куинстаун', 'Милфорд-Саунд', 'Куинстаун'],
    },
    pl: {
      title: 'Dzika przyroda Wyspy Południowej',
      cities: ['Christchurch', 'Kaikoura', 'Abel Tasman', 'Franz Josef', 'Wanaka', 'Queenstown', 'Milford Sound', 'Queenstown'],
    },
  },
  'morocco-medina': {
    es: {
      title: 'Medinas y noches en el Sahara',
      cities: ['Marrakech', 'Chefchaouen', 'Fez', 'Merzouga / Sahara'],
    },
    de: {
      title: 'Medinas und Sahara-Nächte',
      cities: ['Marrakesch', 'Chefchaouen', 'Fès', 'Merzouga / Sahara'],
    },
    fr: {
      title: 'Médinas et nuits dans le Sahara',
      cities: ['Marrakech', 'Chefchaouen', 'Fès', 'Merzouga / Sahara'],
    },
    it: {
      title: 'Medine e notti nel Sahara',
      cities: ['Marrakech', 'Chefchaouen', 'Fes', 'Merzouga / Sahara'],
    },
    pt: {
      title: 'Medinas e noites no Saara',
      cities: ['Marrakech', 'Chefchaouen', 'Fez', 'Merzouga / Saara'],
    },
    ru: {
      title: 'Медины и ночи в Сахаре',
      cities: ['Марракеш', 'Шефшауэн', 'Фес', 'Мерзуга / Сахара'],
    },
    pl: {
      title: 'Medyny i noce na Saharze',
      cities: ['Marrakesz', 'Szafszawan', 'Fez', 'Merzouga / Sahara'],
    },
  },
  'iceland-ring': {
    es: {
      title: 'Circuito Ring Road',
      cities: ['Reikiavik', 'Vík', 'Akureyri', 'Reikiavik'],
    },
    de: {
      title: 'Ringstraßen-Rundtour',
      cities: ['Reykjavik', 'Vík', 'Akureyri', 'Reykjavik'],
    },
    fr: {
      title: 'Circuit Ring Road',
      cities: ['Reykjavik', 'Vík', 'Akureyri', 'Reykjavik'],
    },
    it: {
      title: 'Circuito Ring Road',
      cities: ['Reykjavik', 'Vík', 'Akureyri', 'Reykjavik'],
    },
    pt: {
      title: 'Circuito Ring Road',
      cities: ['Reiquiavique', 'Vík', 'Akureyri', 'Reiquiavique'],
    },
    ru: {
      title: 'Кольцевой маршрут Ring Road',
      cities: ['Рейкьявик', 'Вик', 'Акюрейри', 'Рейкьявик'],
    },
    pl: {
      title: 'Pętla Ring Road',
      cities: ['Reykjavik', 'Vík', 'Akureyri', 'Reykjavik'],
    },
  },
};

const normalizeLocale = (locale?: string): AppLanguage => {
  const base = (locale || '').trim().toLocaleLowerCase().split('-')[0] as AppLanguage;
  return SUPPORTED_EXAMPLE_LOCALES.includes(base) ? base : 'en';
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

const getLocalizedTag = (tag: string, locale: AppLanguage): string => {
  const localeMap = TAG_TRANSLATIONS[locale];
  const englishMap = TAG_TRANSLATIONS.en || {};
  return localeMap?.[tag] || englishMap[tag] || tag;
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
  const translatedTitle = CARD_TITLE_TRANSLATIONS[localeKey]?.[card.id];

  const title = localized?.title || translatedTitle || card.title;
  const tags = localized?.tags && localized.tags.length === card.tags.length
    ? localized.tags
    : card.tags.map((tag) => getLocalizedTag(tag, localeKey));
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
    localized: CARD_LOCALIZATIONS['portugal-coast'],
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
    localized: CARD_LOCALIZATIONS['italy-classic'],
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
    localized: CARD_LOCALIZATIONS['thailand-islands'],
  },
  {
    id: 'thailand-travel-prep-playground',
    title: 'Thailand Travel Prep Playground',
    countries: [{ name: 'Thailand', flag: '🇹🇭' }],
    durationDays: 13,
    cityCount: 5,
    mapColor: 'bg-slate-100',
    mapAccent: 'bg-slate-500',
    username: 'prep_playground',
    avatarColor: 'bg-slate-700',
    tags: ['Travel Prep', 'Guide UX', 'Testing'],
    mapImagePath: '/images/trip-maps/thailand-islands.png',
    templateId: 'thailand-travel-prep-playground',
    hidden: true,
  },
  {
    id: 'southeast-asia-backpacking',
    title: 'Backpacking South East Asia',
    countries: [
      { name: 'Thailand', flag: '🇹🇭' },
      { name: 'Cambodia', flag: '🇰🇭' },
      { name: 'Vietnam', flag: '🇻🇳' },
      { name: 'Laos', flag: '🇱🇦' },
    ],
    durationDays: 37,
    cityCount: 13,
    mapColor: 'bg-indigo-100',
    mapAccent: 'bg-indigo-400',
    username: 'hostel_hopper',
    avatarColor: 'bg-indigo-600',
    tags: ['Culture', 'Food', 'Adventure'],
    mapImagePath: '/images/trip-maps/southeast-asia-backpacking.png',
    templateId: 'southeast-asia-backpacking',
    isRoundTrip: true,
    localized: CARD_LOCALIZATIONS['southeast-asia-backpacking'],
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
    localized: CARD_LOCALIZATIONS['japan-spring'],
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
    localized: CARD_LOCALIZATIONS['peru-adventure'],
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
    localized: CARD_LOCALIZATIONS['new-zealand-wild'],
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
    localized: CARD_LOCALIZATIONS['morocco-medina'],
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
    localized: CARD_LOCALIZATIONS['iceland-ring'],
  },
];

export const getExampleTripCardByTemplateId = (templateId: string): ExampleTripCard | undefined =>
  exampleTripCards.find((card) => card.templateId === templateId);
