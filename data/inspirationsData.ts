import type { Icon } from '@phosphor-icons/react';
import {
    Mountains,
    ForkKnife,
    Buildings,
    Boat,
    TreePalm,
    Camera,
} from '@phosphor-icons/react';

/* ── Shared types ── */

export interface Destination {
    title: string;
    country: string;
    flag: string;
    durationDays: number;
    cityCount: number;
    description: string;
    mapColor: string;
    mapAccent: string;
    tags: string[];
}

export interface InspirationCategory {
    id: string;
    icon: Icon;
    title: string;
    subtitle: string;
    color: string;
    destinations: Destination[];
    blogSlugs?: string[];
}

export interface MonthEntry {
    month: string;
    monthIndex: number; // 0-based
    emoji: string;
    destinations: string[];
    description: string;
    blogSlugs?: string[];
}

export interface FestivalEvent {
    name: string;
    country: string;
    flag: string;
    months: string;
    startMonth: number;    // 0-based (Jan=0)
    startDay: number;      // 1-31
    durationDays: number;
    description: string;
    mapColor: string;
    blogSlugs?: string[];
}

export interface WeekendGetaway {
    title: string;
    from: string;
    to: string;
    flag: string;
    durationDays: number;
    description: string;
    mapColor: string;
    mapAccent: string;
    blogSlugs?: string[];
}

export interface CountryGroup {
    country: string;
    flag: string;
    tripCount: number;
    bestMonths: string;
    tags: string[];
    blogSlugs?: string[];
}

/* ── Categories (by theme) ── */

export const categories: InspirationCategory[] = [
    {
        id: 'adventure',
        icon: Mountains,
        title: 'Adventure & Outdoors',
        subtitle: 'Hikes, summits, and wild landscapes',
        color: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
        destinations: [
            { title: 'South Island Wilderness', country: 'New Zealand', flag: '🇳🇿', durationDays: 21, cityCount: 7, description: 'Milford Sound, glaciers, and the Routeburn Track — three weeks of jaw-dropping scenery.', mapColor: 'bg-emerald-100', mapAccent: 'bg-emerald-400', tags: ['nature', 'hiking', 'new zealand'] },
            { title: 'Andes & Amazon Explorer', country: 'Peru', flag: '🇵🇪', durationDays: 16, cityCount: 5, description: 'From Machu Picchu at altitude to the Amazon basin — a route that covers every elevation.', mapColor: 'bg-orange-100', mapAccent: 'bg-orange-400', tags: ['adventure', 'nature', 'peru'] },
            { title: 'Patagonia Circuit', country: 'Chile & Argentina', flag: '🇨🇱', durationDays: 14, cityCount: 4, description: 'Torres del Paine, Perito Moreno, and El Chaltén — the ultimate southern trek.', mapColor: 'bg-sky-100', mapAccent: 'bg-sky-400', tags: ['hiking', 'nature', 'chile', 'argentina'] },
        ],
    },
    {
        id: 'food-culture',
        icon: ForkKnife,
        title: 'Food & Culture',
        subtitle: 'Eat your way through history',
        color: 'bg-amber-50 text-amber-600 ring-amber-100',
        destinations: [
            { title: 'Italian Grand Tour', country: 'Italy', flag: '🇮🇹', durationDays: 18, cityCount: 6, description: 'Rome, Florence, Bologna, and the Amalfi Coast — pasta, art, and espresso in every city.', mapColor: 'bg-amber-100', mapAccent: 'bg-amber-500', tags: ['food', 'art', 'italy'] },
            { title: 'Cherry Blossom Trail', country: 'Japan', flag: '🇯🇵', durationDays: 14, cityCount: 5, description: 'Tokyo, Kyoto, Osaka, Hiroshima — ramen counters, temple gardens, and spring blossoms.', mapColor: 'bg-rose-100', mapAccent: 'bg-rose-400', tags: ['culture', 'food', 'japan'] },
            { title: 'Medinas & Sahara Nights', country: 'Morocco', flag: '🇲🇦', durationDays: 9, cityCount: 4, description: 'Marrakech souks, Fez tanneries, and a night under the Saharan stars.', mapColor: 'bg-yellow-100', mapAccent: 'bg-yellow-500', tags: ['culture', 'food', 'morocco'] },
        ],
        blogSlugs: ['budget-travel-europe'],
    },
    {
        id: 'beach-islands',
        icon: TreePalm,
        title: 'Beach & Islands',
        subtitle: 'Turquoise water, white sand, zero stress',
        color: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
        destinations: [
            { title: 'Temples & Beaches', country: 'Thailand', flag: '🇹🇭', durationDays: 12, cityCount: 4, description: 'Bangkok temples, Chiang Mai markets, then island-hop through Koh Samui and Krabi.', mapColor: 'bg-emerald-100', mapAccent: 'bg-emerald-400', tags: ['beach', 'food', 'thailand'] },
            { title: 'Greek Island Hop', country: 'Greece', flag: '🇬🇷', durationDays: 10, cityCount: 4, description: 'Athens, Santorini, Naxos, and Crete — whitewashed villages above the Aegean.', mapColor: 'bg-blue-100', mapAccent: 'bg-blue-400', tags: ['beach', 'culture', 'greece'] },
            { title: 'Bali & Lombok', country: 'Indonesia', flag: '🇮🇩', durationDays: 14, cityCount: 5, description: 'Rice terraces, surf breaks, and volcano sunrises — two islands, endless vibes.', mapColor: 'bg-lime-100', mapAccent: 'bg-lime-500', tags: ['beach', 'adventure', 'indonesia'] },
        ],
    },
    {
        id: 'city-breaks',
        icon: Buildings,
        title: 'City Breaks',
        subtitle: 'Weekend escapes and urban deep-dives',
        color: 'bg-violet-50 text-violet-600 ring-violet-100',
        destinations: [
            { title: 'Atlantic Coast Road Trip', country: 'Portugal', flag: '🇵🇹', durationDays: 10, cityCount: 4, description: "Lisbon's tiles, Porto's port cellars, and the wild surf beaches of the Algarve.", mapColor: 'bg-sky-100', mapAccent: 'bg-sky-400', tags: ['city', 'surf', 'portugal'] },
            { title: 'Nordic Design Circuit', country: 'Denmark & Sweden', flag: '🇩🇰', durationDays: 7, cityCount: 3, description: "Copenhagen canals, Malmö bridges, and Stockholm's old town — Scandinavian cool in one week.", mapColor: 'bg-slate-100', mapAccent: 'bg-slate-400', tags: ['city', 'design', 'denmark', 'sweden'] },
            { title: 'Ring Road Circuit', country: 'Iceland', flag: '🇮🇸', durationDays: 7, cityCount: 3, description: 'Waterfalls, geysers, and black-sand beaches — the full island loop in a week.', mapColor: 'bg-indigo-100', mapAccent: 'bg-indigo-400', tags: ['nature', 'road trip', 'iceland'] },
        ],
        blogSlugs: ['how-to-plan-multi-city-trip'],
    },
    {
        id: 'slow-travel',
        icon: Boat,
        title: 'Slow Travel',
        subtitle: 'Fewer moves, deeper immersion',
        color: 'bg-rose-50 text-rose-600 ring-rose-100',
        destinations: [
            { title: 'Tuscan Countryside', country: 'Italy', flag: '🇮🇹', durationDays: 10, cityCount: 3, description: 'A farmhouse base near Siena with day trips to hilltop villages, vineyards, and Florence.', mapColor: 'bg-amber-100', mapAccent: 'bg-amber-400', tags: ['slow travel', 'food', 'italy'] },
            { title: 'Sri Lanka Coast to Hills', country: 'Sri Lanka', flag: '🇱🇰', durationDays: 14, cityCount: 4, description: 'Beach mornings in Mirissa, tea plantations in Ella, and train rides through the highlands.', mapColor: 'bg-teal-100', mapAccent: 'bg-teal-400', tags: ['slow travel', 'nature', 'sri lanka'] },
            { title: 'Oaxaca & Pacific Coast', country: 'Mexico', flag: '🇲🇽', durationDays: 12, cityCount: 3, description: 'Mezcal, mole, and markets in Oaxaca city, then surf and sea turtles in Puerto Escondido.', mapColor: 'bg-red-100', mapAccent: 'bg-red-400', tags: ['food', 'beach', 'mexico'] },
        ],
    },
    {
        id: 'photography',
        icon: Camera,
        title: 'Photography Trips',
        subtitle: 'Golden hours and epic backdrops',
        color: 'bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100',
        destinations: [
            { title: 'Northern Lights Chase', country: 'Norway', flag: '🇳🇴', durationDays: 7, cityCount: 3, description: 'Tromsø fjords, Lofoten fishing villages, and aurora borealis on winter nights.', mapColor: 'bg-indigo-100', mapAccent: 'bg-indigo-500', tags: ['photography', 'nature', 'norway'] },
            { title: 'Cappadocia & Istanbul', country: 'Turkey', flag: '🇹🇷', durationDays: 8, cityCount: 3, description: 'Hot-air balloons at sunrise, fairy chimneys, and the Bosphorus at golden hour.', mapColor: 'bg-orange-100', mapAccent: 'bg-orange-500', tags: ['photography', 'culture', 'turkey'] },
            { title: 'Rajasthan Heritage Trail', country: 'India', flag: '🇮🇳', durationDays: 12, cityCount: 5, description: "Jaipur's pink city, Jodhpur's blue lanes, and the Thar Desert under the stars.", mapColor: 'bg-yellow-100', mapAccent: 'bg-yellow-600', tags: ['photography', 'culture', 'india'] },
        ],
    },
];

/* ── By month ── */

export const monthEntries: MonthEntry[] = [
    { month: 'January', monthIndex: 0, emoji: '❄️', destinations: ['Thailand', 'Sri Lanka', 'Mexico'], description: 'Escape winter — tropical heat, dry season beaches, and far-flung new year vibes.' },
    { month: 'February', monthIndex: 1, emoji: '🎭', destinations: ['Brazil', 'Italy', 'Japan'], description: 'Carnival in Rio, Venice masquerade, and early plum blossom season in Kyoto.' },
    { month: 'March', monthIndex: 2, emoji: '🌸', destinations: ['Japan', 'Morocco', 'Portugal'], description: 'Cherry blossoms peak, Sahara is still comfortable, and Lisbon starts warming up.', blogSlugs: ['best-time-visit-japan'] },
    { month: 'April', monthIndex: 3, emoji: '🌷', destinations: ['Netherlands', 'Greece', 'Peru'], description: 'Tulip fields, Greek islands before the crowds, and dry-season Inca Trail.' },
    { month: 'May', monthIndex: 4, emoji: '☀️', destinations: ['Italy', 'Croatia', 'Iceland'], description: 'Mediterranean shoulder season — perfect temps, smaller crowds, longer days.', blogSlugs: ['budget-travel-europe'] },
    { month: 'June', monthIndex: 5, emoji: '🌅', destinations: ['Norway', 'Turkey', 'Indonesia'], description: 'Midnight sun in the Nordics, Cappadocia hot-air balloons, and Bali dry season.' },
    { month: 'July', monthIndex: 6, emoji: '🏖️', destinations: ['Greece', 'France', 'Canada'], description: 'Peak summer in the Med, lavender fields in Provence, and Canadian Rockies.' },
    { month: 'August', monthIndex: 7, emoji: '🌊', destinations: ['Iceland', 'Tanzania', 'Sweden'], description: 'Ring Road weather window, Great Migration, and Swedish archipelago sailing.' },
    { month: 'September', monthIndex: 8, emoji: '🍂', destinations: ['Italy', 'Japan', 'New Zealand'], description: 'Wine harvest in Tuscany, autumn leaves in Kyoto, and NZ spring wildflowers.', blogSlugs: ['best-time-visit-japan'] },
    { month: 'October', monthIndex: 9, emoji: '🎃', destinations: ['Mexico', 'Morocco', 'Portugal'], description: 'Día de los Muertos, comfortable desert temps, and Algarve autumn sun.', blogSlugs: ['festival-travel-guide'] },
    { month: 'November', monthIndex: 10, emoji: '🍁', destinations: ['India', 'Thailand', 'Chile'], description: 'Rajasthan festival season, Thai loy krathong lanterns, and Patagonia spring.' },
    { month: 'December', monthIndex: 11, emoji: '🎄', destinations: ['Austria', 'Thailand', 'New Zealand'], description: 'Christmas markets in Vienna, tropical island escapes, and NZ summer hiking.' },
];

/* ── Festivals & events ── */

export const festivalEvents: FestivalEvent[] = [
    { name: 'Cherry Blossom Festival', country: 'Japan', flag: '🇯🇵', months: 'Mar–Apr', startMonth: 2, startDay: 20, description: 'Sakura season transforms parks and temples into clouds of pink — picnic under the blossoms in Kyoto and Tokyo.', mapColor: 'bg-rose-100', durationDays: 10, blogSlugs: ['best-time-visit-japan'] },
    { name: 'Carnival', country: 'Brazil', flag: '🇧🇷', months: 'Feb', startMonth: 1, startDay: 25, description: 'The world\'s biggest party — samba parades, street blocos, and non-stop energy across Rio and Salvador.', mapColor: 'bg-yellow-100', durationDays: 5, blogSlugs: ['festival-travel-guide'] },
    { name: 'Holi', country: 'India', flag: '🇮🇳', months: 'Mar', startMonth: 2, startDay: 14, description: 'The festival of colors — join locals throwing vibrant powders in Jaipur, Varanasi, and Mathura.', mapColor: 'bg-fuchsia-100', durationDays: 3, blogSlugs: ['festival-travel-guide'] },
    { name: 'Día de los Muertos', country: 'Mexico', flag: '🇲🇽', months: 'Oct–Nov', startMonth: 9, startDay: 31, description: 'Marigold-decked altars, painted skulls, and candlelit cemetery vigils honoring the departed in Oaxaca.', mapColor: 'bg-orange-100', durationDays: 4, blogSlugs: ['festival-travel-guide'] },
    { name: 'Oktoberfest', country: 'Germany', flag: '🇩🇪', months: 'Sep–Oct', startMonth: 8, startDay: 20, description: 'Munich\'s legendary beer festival — lederhosen, brass bands, pretzels, and 6 million visitors.', mapColor: 'bg-amber-100', durationDays: 4, blogSlugs: ['festival-travel-guide', 'budget-travel-europe'] },
    { name: 'Loy Krathong', country: 'Thailand', flag: '🇹🇭', months: 'Nov', startMonth: 10, startDay: 5, description: 'Thousands of floating lanterns and candle-lit lotus boats released on rivers and lakes across Thailand.', mapColor: 'bg-emerald-100', durationDays: 3 },
    { name: 'Northern Lights Season', country: 'Norway / Iceland', flag: '🇳🇴', months: 'Sep–Mar', startMonth: 8, startDay: 15, description: 'Chase the aurora borealis from Tromsø fjords or Icelandic lava fields — best viewed on clear winter nights.', mapColor: 'bg-indigo-100', durationDays: 7 },
    { name: 'La Tomatina', country: 'Spain', flag: '🇪🇸', months: 'Aug', startMonth: 7, startDay: 27, description: 'The world\'s largest tomato fight in Buñol — an hour of pure, pulpy chaos followed by paella.', mapColor: 'bg-red-100', durationDays: 2, blogSlugs: ['festival-travel-guide'] },
    { name: 'Songkran Water Festival', country: 'Thailand', flag: '🇹🇭', months: 'Apr', startMonth: 3, startDay: 13, description: 'Thai New Year celebrated with city-wide water fights, temple visits, and street food marathons.', mapColor: 'bg-cyan-100', durationDays: 4 },
    { name: 'Venice Carnival', country: 'Italy', flag: '🇮🇹', months: 'Feb', startMonth: 1, startDay: 8, description: 'Ornate masks, gondola parades, and grand masquerade balls in the floating city.', mapColor: 'bg-violet-100', durationDays: 5, blogSlugs: ['festival-travel-guide', 'budget-travel-europe'] },
    { name: 'Running of the Bulls', country: 'Spain', flag: '🇪🇸', months: 'Jul', startMonth: 6, startDay: 6, description: 'San Fermín festival in Pamplona — encierro runs, parades, fireworks, and non-stop Basque celebrations.', mapColor: 'bg-red-100', durationDays: 9, blogSlugs: ['festival-travel-guide'] },
    { name: 'Chinese New Year', country: 'China', flag: '🇨🇳', months: 'Jan–Feb', startMonth: 0, startDay: 29, description: 'Dragon dances, lantern displays, and spectacular fireworks across Beijing, Shanghai, and Hong Kong.', mapColor: 'bg-red-100', durationDays: 7 },
    { name: 'Glastonbury Festival', country: 'United Kingdom', flag: '🇬🇧', months: 'Jun', startMonth: 5, startDay: 25, description: 'The world\'s most iconic music festival — five days of legendary performances on a Somerset farm.', mapColor: 'bg-lime-100', durationDays: 5 },
    { name: 'Burning Man', country: 'USA', flag: '🇺🇸', months: 'Aug–Sep', startMonth: 7, startDay: 24, description: 'A temporary city in the Nevada desert — radical self-expression, art installations, and the burning of the Man.', mapColor: 'bg-orange-100', durationDays: 9 },
    { name: 'Diwali', country: 'India', flag: '🇮🇳', months: 'Oct–Nov', startMonth: 9, startDay: 20, description: 'The festival of lights — fireworks, oil lamps, rangoli art, and sweet feasts illuminate India for five days.', mapColor: 'bg-amber-100', durationDays: 5, blogSlugs: ['festival-travel-guide'] },
    { name: "St. Patrick's Day", country: 'Ireland', flag: '🇮🇪', months: 'Mar', startMonth: 2, startDay: 17, description: 'Dublin turns green — parades, live music, and the best pints of Guinness you\'ll ever have.', mapColor: 'bg-emerald-100', durationDays: 3 },
    { name: 'Mardi Gras', country: 'USA', flag: '🇺🇸', months: 'Feb', startMonth: 1, startDay: 17, description: 'New Orleans erupts with jazz, floats, beads, and king cake — weeks of parades building to Fat Tuesday.', mapColor: 'bg-purple-100', durationDays: 14 },
    { name: 'Lantern Festival', country: 'Taiwan', flag: '🇹🇼', months: 'Feb', startMonth: 1, startDay: 12, description: 'Thousands of sky lanterns released over Pingxi — a mesmerizing sea of light drifting into the night sky.', mapColor: 'bg-amber-100', durationDays: 3 },
    { name: 'Inti Raymi', country: 'Peru', flag: '🇵🇪', months: 'Jun', startMonth: 5, startDay: 24, description: 'The Inca festival of the sun — a grand ceremony at Sacsayhuamán fortress above Cusco with music and dance.', mapColor: 'bg-yellow-100', durationDays: 3 },
    { name: 'Edinburgh Fringe', country: 'United Kingdom', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', months: 'Aug', startMonth: 7, startDay: 1, description: 'The world\'s largest arts festival — thousands of shows from comedy to theatre across Edinburgh\'s venues.', mapColor: 'bg-violet-100', durationDays: 25 },
];

/* ── Weekend getaways ── */

export const weekendGetaways: WeekendGetaway[] = [
    { title: 'Barcelona Express', from: 'Anywhere in Europe', to: 'Barcelona, Spain', flag: '🇪🇸', durationDays: 3, description: 'Gaudí, tapas crawl through El Born, and sunset from Bunkers del Carmel.', mapColor: 'bg-orange-100', mapAccent: 'bg-orange-400', blogSlugs: ['weekend-getaway-tips'] },
    { title: 'Prague Old Town', from: 'Central Europe', to: 'Prague, Czech Republic', flag: '🇨🇿', durationDays: 3, description: 'Charles Bridge at dawn, beer halls, and the astronomical clock — Europe\'s most photogenic city break.', mapColor: 'bg-amber-100', mapAccent: 'bg-amber-500', blogSlugs: ['weekend-getaway-tips', 'budget-travel-europe'] },
    { title: 'Marrakech Medina', from: 'Europe / North Africa', to: 'Marrakech, Morocco', flag: '🇲🇦', durationDays: 3, description: 'Get lost in the souks, sip mint tea on a riad rooftop, and visit the Jardin Majorelle.', mapColor: 'bg-yellow-100', mapAccent: 'bg-yellow-500', blogSlugs: ['weekend-getaway-tips'] },
    { title: 'Amsterdam Canals', from: 'Northern Europe', to: 'Amsterdam, Netherlands', flag: '🇳🇱', durationDays: 2, description: 'Bike the canal ring, Rijksmuseum, and Jordaan neighbourhood brunch spots.', mapColor: 'bg-sky-100', mapAccent: 'bg-sky-400', blogSlugs: ['weekend-getaway-tips'] },
    { title: 'Edinburgh Highlands', from: 'UK / Ireland', to: 'Edinburgh, Scotland', flag: '🏴\u200d☠️', durationDays: 3, description: 'Arthur\'s Seat hike, whisky tasting on the Royal Mile, and a day trip into the Highlands.', mapColor: 'bg-emerald-100', mapAccent: 'bg-emerald-500', blogSlugs: ['weekend-getaway-tips'] },
    { title: 'Istanbul Bosphorus', from: 'Europe / Middle East', to: 'Istanbul, Turkey', flag: '🇹🇷', durationDays: 3, description: 'Hagia Sophia, Grand Bazaar haggling, and ferry rides between two continents.', mapColor: 'bg-rose-100', mapAccent: 'bg-rose-400', blogSlugs: ['weekend-getaway-tips'] },
];

/* ── By country ── */

export const countryGroups: CountryGroup[] = [
    { country: 'Japan', flag: '🇯🇵', tripCount: 3, bestMonths: 'Mar–May, Oct–Nov', tags: ['Culture', 'Food', 'Nature'], blogSlugs: ['best-time-visit-japan'] },
    { country: 'Italy', flag: '🇮🇹', tripCount: 3, bestMonths: 'Apr–Jun, Sep–Oct', tags: ['Food', 'Art', 'History'], blogSlugs: ['budget-travel-europe'] },
    { country: 'Thailand', flag: '🇹🇭', tripCount: 2, bestMonths: 'Nov–Feb', tags: ['Beach', 'Food', 'Adventure'] },
    { country: 'Portugal', flag: '🇵🇹', tripCount: 2, bestMonths: 'Mar–Jun, Sep–Oct', tags: ['Surf', 'Wine', 'City'], blogSlugs: ['budget-travel-europe'] },
    { country: 'Peru', flag: '🇵🇪', tripCount: 1, bestMonths: 'May–Sep', tags: ['Adventure', 'History', 'Nature'] },
    { country: 'Iceland', flag: '🇮🇸', tripCount: 2, bestMonths: 'Jun–Aug', tags: ['Nature', 'Road Trip', 'Photography'] },
    { country: 'Morocco', flag: '🇲🇦', tripCount: 2, bestMonths: 'Mar–May, Sep–Nov', tags: ['Culture', 'Food', 'Desert'] },
    { country: 'India', flag: '🇮🇳', tripCount: 2, bestMonths: 'Oct–Mar', tags: ['Culture', 'Photography', 'Food'] },
    { country: 'Greece', flag: '🇬🇷', tripCount: 1, bestMonths: 'May–Jun, Sep–Oct', tags: ['Beach', 'Culture', 'Islands'], blogSlugs: ['budget-travel-europe'] },
    { country: 'New Zealand', flag: '🇳🇿', tripCount: 1, bestMonths: 'Nov–Mar', tags: ['Nature', 'Hiking', 'Road Trip'] },
    { country: 'Norway', flag: '🇳🇴', tripCount: 1, bestMonths: 'Jun–Aug, Sep–Mar (aurora)', tags: ['Nature', 'Photography', 'Fjords'] },
    { country: 'Mexico', flag: '🇲🇽', tripCount: 2, bestMonths: 'Oct–Apr', tags: ['Food', 'Beach', 'Culture'] },
];

/* ── Quick starts ── */

export const quickIdeas = [
    { label: '🇯🇵 7 Days in Japan', dest: 'Japan', days: 7 },
    { label: '🇮🇹 2 Weeks in Italy', dest: 'Italy', days: 14 },
    { label: '🇹🇭 10 Days in Thailand', dest: 'Thailand', days: 10 },
    { label: '🇮🇸 Iceland Ring Road', dest: 'Iceland', days: 7 },
    { label: '🇵🇹 Portugal Road Trip', dest: 'Portugal', days: 10 },
    { label: '🇬🇷 Greek Islands', dest: 'Greece', days: 10 },
    { label: '🇲🇦 Morocco Discovery', dest: 'Morocco', days: 9 },
    { label: '🇳🇿 NZ Adventure', dest: 'New Zealand', days: 21 },
];

/* ── Helpers ── */

/** Returns all destinations across all categories. */
export const getAllDestinations = (): (Destination & { categoryId: string })[] =>
    categories.flatMap((cat) => cat.destinations.map((d) => ({ ...d, categoryId: cat.id })));
