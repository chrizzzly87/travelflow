export type StampStyle = 'postal' | 'visa' | 'engraved';
export type PassportNationality = 'germany' | 'japan' | 'united-kingdom' | 'united-states' | 'brazil' | 'india';
export type StampCategory = 'country' | 'city' | 'landmark' | 'journey' | 'ritual';
export type StampMotif = 'mountain' | 'tower' | 'bridge' | 'temple' | 'coast' | 'compass' | 'train' | 'food' | 'globe' | 'monument';

export interface PassportAchievement {
  id: string;
  title: string;
  place: string;
  detail: string;
  category: StampCategory;
  motif: StampMotif;
  points: number;
  unlocked: boolean;
  earnedOn?: string;
  color: string;
  accent: string;
}

export interface PassportTheme {
  label: string;
  countryCode: string;
  cover: string;
  coverDark: string;
  foil: string;
  emblem: 'eagle' | 'chrysanthemum' | 'lion' | 'star' | 'southern-cross' | 'chakra';
}

export const PASSPORT_THEMES: Record<PassportNationality, PassportTheme> = {
  germany: { label: 'Germany', countryCode: 'DEU', cover: '#7a1623', coverDark: '#3f0911', foil: '#d9bb73', emblem: 'eagle' },
  japan: { label: 'Japan', countryCode: 'JPN', cover: '#6e182b', coverDark: '#380914', foil: '#d9bd82', emblem: 'chrysanthemum' },
  'united-kingdom': { label: 'United Kingdom', countryCode: 'GBR', cover: '#123d7a', coverDark: '#071e42', foil: '#d7bd70', emblem: 'lion' },
  'united-states': { label: 'United States', countryCode: 'USA', cover: '#173a72', coverDark: '#081f45', foil: '#d8c177', emblem: 'star' },
  brazil: { label: 'Brazil', countryCode: 'BRA', cover: '#155f4b', coverDark: '#08382a', foil: '#e5c765', emblem: 'southern-cross' },
  india: { label: 'India', countryCode: 'IND', cover: '#234a73', coverDark: '#112a47', foil: '#d8bd75', emblem: 'chakra' },
};

const stamp = (
  id: string,
  title: string,
  place: string,
  detail: string,
  category: StampCategory,
  motif: StampMotif,
  points: number,
  color: string,
  accent: string,
  unlocked = true,
  earnedOn?: string,
): PassportAchievement => ({ id, title, place, detail, category, motif, points, color, accent, unlocked, earnedOn });

export const PASSPORT_ACHIEVEMENTS: PassportAchievement[] = [
  stamp('kyoto-dawn', 'Temple at dawn', 'Kyoto · Japan', 'Reach a sacred place before the city wakes.', 'city', 'temple', 120, '#c53d2f', '#f1b65a', true, 'APR 14 2025'),
  stamp('lisbon-28', 'Rode the 28', 'Lisbon · Portugal', 'Cross seven hills on the yellow tram.', 'city', 'train', 90, '#205b87', '#e5b548', true, 'SEP 08 2024'),
  stamp('brooklyn-blue', 'Bridge walker', 'New York · USA', 'Cross the East River entirely on foot.', 'landmark', 'bridge', 100, '#2b5d8f', '#d15b3d', true, 'JUN 22 2025'),
  stamp('first-border', 'First border', 'World', 'Visit a country beyond home for the first time.', 'journey', 'globe', 75, '#2d6a5d', '#d49c3c', true, 'AUG 11 2018'),
  stamp('five-countries', 'Five flags', 'World', 'Collect memories in five countries.', 'country', 'globe', 150, '#704a8e', '#d57b4e', true, 'OCT 04 2022'),
  stamp('ten-countries', 'Ten horizons', 'World', 'Explore ten different countries.', 'country', 'compass', 260, '#2f5d78', '#be5b45', true, 'MAR 16 2024'),
  stamp('three-continents', 'Three continents', 'World', 'Set foot on three continents.', 'journey', 'globe', 300, '#8a4f3d', '#d3a33b', true, 'DEC 29 2024'),
  stamp('night-train', 'Night line', 'Europe', 'Wake up in a different country by rail.', 'journey', 'train', 130, '#315f76', '#c45f46', true, 'MAY 02 2024'),
  stamp('alps-summit', 'Above the clouds', 'Swiss Alps', 'Reach a viewpoint above 2,500 metres.', 'landmark', 'mountain', 150, '#426b72', '#c88b4a', true, 'FEB 18 2025'),
  stamp('fuji-view', 'Fuji revealed', 'Honshu · Japan', 'See Mount Fuji without cloud cover.', 'landmark', 'mountain', 150, '#b33b39', '#6e879a', true, 'APR 19 2025'),
  stamp('eiffel-blue-hour', 'Blue hour', 'Paris · France', 'Watch the Eiffel Tower light the evening.', 'landmark', 'tower', 110, '#3f5680', '#d18a45', true, 'NOV 12 2023'),
  stamp('colosseum-loop', 'Ancient circuit', 'Rome · Italy', 'Walk a full loop around the Colosseum.', 'landmark', 'monument', 100, '#9b4d39', '#d1a153', true, 'OCT 20 2023'),
  stamp('petra-siq', 'Through the Siq', 'Petra · Jordan', 'Reach the Treasury through the sandstone canyon.', 'landmark', 'monument', 180, '#a64e35', '#dfaa55', false),
  stamp('machu-morning', 'Cloud citadel', 'Machu Picchu · Peru', 'Enter the citadel in the morning mist.', 'landmark', 'mountain', 220, '#3c6b59', '#c99945', false),
  stamp('sydney-sails', 'Harbour sails', 'Sydney · Australia', 'See the Opera House from the water.', 'landmark', 'coast', 130, '#2a6883', '#d97c42', false),
  stamp('taj-sunrise', 'Marble sunrise', 'Agra · India', 'Meet the Taj Mahal in first light.', 'landmark', 'monument', 170, '#315b87', '#dd9254', false),
  stamp('giza-shadow', 'Pyramid shadow', 'Giza · Egypt', 'Stand where the plateau meets the city.', 'landmark', 'monument', 170, '#9a5736', '#d6aa56', false),
  stamp('rio-summit', 'Above Rio', 'Rio de Janeiro · Brazil', 'Reach Corcovado above the bay.', 'city', 'mountain', 140, '#246754', '#e0a43d', false),
  stamp('istanbul-ferry', 'Two continents', 'Istanbul · Türkiye', 'Cross from Europe to Asia by ferry.', 'city', 'coast', 135, '#345d7a', '#c65e42', true, 'JUL 09 2023'),
  stamp('seoul-night', 'Neon mountain', 'Seoul · South Korea', 'See the city glow from Namsan after dark.', 'city', 'tower', 115, '#674884', '#d35e56', false),
  stamp('mexico-market', 'Market morning', 'Mexico City · Mexico', 'Try breakfast from three market stalls.', 'ritual', 'food', 95, '#a23f34', '#e0a544', false),
  stamp('marrakech-mint', 'Mint & maze', 'Marrakech · Morocco', 'Share mint tea inside the medina.', 'ritual', 'food', 90, '#a34b35', '#3d7b69', false),
  stamp('naples-slice', 'First slice', 'Naples · Italy', 'Eat a margherita where it began.', 'ritual', 'food', 85, '#9b3f36', '#417459', true, 'OCT 16 2023'),
  stamp('tokyo-counter', 'Counter seat', 'Tokyo · Japan', 'Order omakase at a tiny counter.', 'ritual', 'food', 120, '#a43238', '#264f70', true, 'APR 11 2025'),
  stamp('porto-sunset', 'Douro gold', 'Porto · Portugal', 'Watch sunset from the riverbank.', 'city', 'bridge', 90, '#2e5e87', '#d39a42', true, 'SEP 12 2024'),
  stamp('venice-lost', 'Beautifully lost', 'Venice · Italy', 'Put the map away for one full hour.', 'city', 'compass', 80, '#2f6672', '#a74c3b', true, 'OCT 13 2023'),
  stamp('copenhagen-cycle', 'City cyclist', 'Copenhagen · Denmark', 'Explore an entire city day by bicycle.', 'city', 'compass', 100, '#36657e', '#d37a46', false),
  stamp('iceland-ring', 'Ring road', 'Iceland', 'Complete the island’s full road loop.', 'country', 'coast', 260, '#356b68', '#be6848', false),
  stamp('japan-rail', 'Rail rhythm', 'Japan', 'Connect five cities by train.', 'country', 'train', 220, '#aa3839', '#2d5d75', true, 'APR 22 2025'),
  stamp('greek-islands', 'Three islands', 'Greece', 'Wake up on three Aegean islands.', 'country', 'coast', 180, '#2f628f', '#d5a045', false),
  stamp('one-bag', 'One bag only', 'World', 'Finish a seven-day trip with carry-on luggage.', 'journey', 'compass', 95, '#5e557e', '#c46c47', true, 'SEP 14 2024'),
  stamp('red-eye', 'Red-eye ready', 'World', 'Cross four time zones overnight.', 'journey', 'globe', 115, '#3f5679', '#c37a48', true, 'APR 09 2025'),
  stamp('return-ticket', 'Return ticket', 'World', 'Revisit a place you once loved.', 'ritual', 'compass', 125, '#7a4c67', '#d29249', true, 'OCT 12 2023'),
];

export const FEATURED_STAMP_IDS = ['kyoto-dawn', 'lisbon-28', 'brooklyn-blue'] as const;

export const STAMP_STYLE_LABELS: Record<StampStyle, string> = {
  postal: 'Perforated postal',
  visa: 'Overprinted visa',
  engraved: 'Heritage engraving',
};

export const STAMP_PROMPTS: Record<StampStyle, string> = {
  postal: 'Create a flat two-colour vector postage stamp for {place}. Bold geometric landmark silhouette, irregular perforated edge, mid-century travel ephemera, screen-print ink, no gradients, editable SVG paths, no mockup.',
  visa: 'Create a single-ink passport visa stamp for {place}. Imperfect rubber pressure, compact sans-serif typography, date and coordinates, simple monoline landmark symbol, transparent background, authentic misregistration, SVG.',
  engraved: 'Create an engraved travel seal for {place}. Fine guilloché lines, oval heritage frame, simplified landmark vignette, restrained two-colour banknote aesthetic, legible at 160 pixels, editable SVG, no photorealism.',
};

export const getAchievementById = (id: string): PassportAchievement | undefined =>
  PASSPORT_ACHIEVEMENTS.find((achievement) => achievement.id === id);

export const getPassportSpreads = (showLocked: boolean, pageSize = 6): PassportAchievement[][] => {
  const visible = showLocked ? PASSPORT_ACHIEVEMENTS : PASSPORT_ACHIEVEMENTS.filter((achievement) => achievement.unlocked);
  const pages: PassportAchievement[][] = [];
  for (let index = 0; index < visible.length; index += pageSize) {
    pages.push(visible.slice(index, index + pageSize));
  }
  if (pages.length % 2 !== 0) pages.push([]);
  const spreads: PassportAchievement[][] = [];
  for (let index = 0; index < pages.length; index += 2) {
    spreads.push([...pages[index], ...pages[index + 1]]);
  }
  return spreads;
};
