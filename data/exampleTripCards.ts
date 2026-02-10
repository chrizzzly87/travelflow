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
}

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
  },
];

export const getExampleTripCardByTemplateId = (templateId: string): ExampleTripCard | undefined =>
  exampleTripCards.find((card) => card.templateId === templateId);
