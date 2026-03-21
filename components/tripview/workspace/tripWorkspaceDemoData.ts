import type { ITrip, ITimelineItem } from '../../../types';

export type PhraseCategory = 'basics' | 'transport' | 'food' | 'emergency';
export type PhraseReviewRating = 'new' | 'easy' | 'practice';

export interface TripWorkspaceCountryFact {
    label: string;
    value: string;
    badge?: string;
    link?: {
        label: string;
        href: string;
    };
}

export interface TripWorkspaceSafetySnapshot {
    label: string;
    score: string;
    detail: string;
    tone: 'secondary' | 'outline';
}

export interface TripWorkspaceCityNeighborhood {
    name: string;
    fit: string;
}

export interface TripWorkspaceCityStay {
    area: string;
    vibe: string;
    reason: string;
}

export interface TripWorkspaceCityGuide {
    id: string;
    title: string;
    matchers: string[];
    role: string;
    idealStay: string;
    arrival: string;
    transit: string;
    officialLinks: Array<{ label: string; href: string }>;
    neighborhoods: TripWorkspaceCityNeighborhood[];
    highlights: string[];
    mapHighlights: string[];
    notes: string[];
    savedStays: TripWorkspaceCityStay[];
    events: Array<{ title: string; detail: string }>;
}

export interface TripWorkspaceExploreLead {
    id: string;
    cityId: string;
    title: string;
    type: 'activity' | 'stay' | 'event';
    description: string;
    query: string;
    reason: string;
}

export interface TripWorkspaceBookingRecord {
    id: string;
    title: string;
    status: 'Confirmed' | 'Needs review' | 'Missing';
    cityId: string;
    meta: string;
}

export interface TripWorkspaceNoteRecord {
    id: string;
    title: string;
    type: 'arrival' | 'rhythm' | 'fallback';
    body: string;
}

export interface TripWorkspacePhotoRecord {
    id: string;
    title: string;
    caption: string;
    mood: string;
}

export interface TripWorkspacePhraseCard {
    id: string;
    cityId: string;
    category: PhraseCategory;
    phrase: string;
    local: string;
    pronunciation: string;
    usage: string;
}

const normalizeValue = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '');

export const resolveTripWorkspaceCityStops = (items: ITimelineItem[]): ITimelineItem[] =>
    items
        .filter((item) => item.type === 'city')
        .sort((left, right) => left.startDateOffset - right.startDateOffset);

export const THAILAND_COUNTRY_FACTS: TripWorkspaceCountryFact[] = [
    {
        label: 'Visa basics',
        value: 'Short-stay entry rules shift by passport and arrival mode, so keep the live rule check close.',
        badge: 'General destination',
        link: { label: 'Thailand Immigration', href: 'https://www.immigration.go.th' },
    },
    {
        label: 'Sockets & voltage',
        value: 'Type A, B, C and O • 220V. A universal adapter keeps Bangkok hotels and island stays simple.',
        badge: 'Practical',
    },
    {
        label: 'Driving side',
        value: 'Left-hand traffic. Rental scooters feel very different between city streets and island roads.',
        badge: 'Practical',
    },
    {
        label: 'Connectivity',
        value: 'Good eSIM coverage in Bangkok, Chiang Mai, and Phuket, but boat transfer days can still dip.',
        badge: 'Trip-ready',
        link: { label: 'Tourism Authority', href: 'https://www.tourismthailand.org' },
    },
    {
        label: 'Cash & cards',
        value: 'Cards work in city hotels and cafes, but night markets, ferries, and small food stalls still prefer cash.',
        badge: 'Practical',
    },
    {
        label: 'Cultural context',
        value: 'Temple dress, easy shoes, and respectful body language matter more than over-planning facts lists.',
        badge: 'Context',
    },
];

export const THAILAND_SAFETY_SNAPSHOTS: TripWorkspaceSafetySnapshot[] = [
    {
        label: 'LGBTQIA+ comfort',
        score: 'Generally warm in major traveler zones',
        detail: 'Bangkok, Chiang Mai, and Phuket read much easier than remote transit edges.',
        tone: 'secondary',
    },
    {
        label: 'Solo women at night',
        score: 'Mixed by neighborhood and transfer hour',
        detail: 'Main tourist districts feel workable, but late-night piers and ad-hoc transfers need more caution.',
        tone: 'outline',
    },
    {
        label: 'Petty crime',
        score: 'Low to medium in crowded hubs',
        detail: 'Phones, tuk-tuk pricing, and beach-bag awareness matter more than violent-crime fear.',
        tone: 'outline',
    },
    {
        label: 'Transport safety',
        score: 'Watch ferries, scooters, and overnight hops',
        detail: 'The riskiest moments are usually tired arrivals and weather-shifting sea legs.',
        tone: 'secondary',
    },
];

export const THAILAND_CITY_GUIDES: TripWorkspaceCityGuide[] = [
    {
        id: 'bangkok',
        title: 'Bangkok',
        matchers: ['bangkok'],
        role: 'Arrival base for food, markets, and a polished first landing.',
        idealStay: '3-4 nights',
        arrival: 'Use Airport Rail Link or a booked Grab after a long-haul day. Sathorn and Ari reduce first-night friction.',
        transit: 'BTS and MRT cover the core. Boats are scenic and slower. Heat changes what “walkable” feels like fast.',
        officialLinks: [
            { label: 'Suvarnabhumi Airport', href: 'https://suvarnabhumi.airportthai.co.th' },
            { label: 'BTS Skytrain', href: 'https://www.bts.co.th/eng/' },
        ],
        neighborhoods: [
            { name: 'Sathorn', fit: 'Arrival-friendly and polished stays' },
            { name: 'Ari', fit: 'Cafe mornings and calmer rhythm' },
            { name: 'Talat Noi', fit: 'Texture, galleries, and riverside walks' },
        ],
        highlights: ['Opening-time temple loop', 'Talat Noi photo walk', 'Rooftop sunset with dress-code check'],
        mapHighlights: ['Airport rail link anchor', 'Easy first-night zones', 'Food corridors after sunset'],
        notes: [
            'Trip-specific: use Bangkok as the recovery buffer before any domestic hop.',
            'General destination: temple logistics and traffic timing matter more than big list length.',
        ],
        savedStays: [
            { area: 'Sathorn', vibe: 'Polished base', reason: 'Easiest handoff from airport to hotel to first dinner.' },
            { area: 'Ari', vibe: 'Soft urban reset', reason: 'Better if the trip wants design cafés over nightlife.' },
        ],
        events: [
            { title: 'Songkran window', detail: 'Mid-April changes transport, crowds, and hotel mood quickly.' },
        ],
    },
    {
        id: 'chiang-mai',
        title: 'Chiang Mai',
        matchers: ['chiangmai', 'chiangmai'],
        role: 'North Thailand reset for temples, cafés, and slower trip rhythm.',
        idealStay: '4-5 nights',
        arrival: 'Airport transfers are quick. The Old City is easiest for a first orientation lap.',
        transit: 'Walkable core, then Grab for hills, craft spots, and evening moves.',
        officialLinks: [
            { label: 'Chiang Mai Airport', href: 'https://www.airportthai.co.th/en/chiangmai-airport/' },
            { label: 'Tourism Chiang Mai', href: 'https://www.tourismthailand.org/Destinations/Provinces/Chiang-Mai/101' },
        ],
        neighborhoods: [
            { name: 'Old City', fit: 'Best first-timer orientation' },
            { name: 'Nimman', fit: 'Cafe density and softer work blocks' },
            { name: 'Riverside', fit: 'Slower evenings and calmer stays' },
        ],
        highlights: ['Cooking class with market visit', 'Early temple circuit', 'Craft village half-day'],
        mapHighlights: ['Temple core', 'Cafe streets', 'Easy evening zones'],
        notes: [
            'Trip-specific: keep one unscheduled afternoon for slower café recovery.',
            'General destination: haze and rain season layers should become live later.',
        ],
        savedStays: [
            { area: 'Old City', vibe: 'Easy orientation', reason: 'Best for a short first Chiang Mai stop.' },
            { area: 'Nimman', vibe: 'Design-heavy and social', reason: 'Stronger if cafés and shops matter more.' },
        ],
        events: [
            { title: 'Sunday Walking Street', detail: 'Reliable low-planning anchor for one market night.' },
        ],
    },
    {
        id: 'pai',
        title: 'Pai',
        matchers: ['pai'],
        role: 'Mountain decompression stop with a slower backpacker rhythm.',
        idealStay: '2-3 nights',
        arrival: 'The minivan curves are the experience, so schedule a quiet evening after arrival.',
        transit: 'Scooters dominate, but walking and short songthaew trips are enough if you stay central.',
        officialLinks: [
            { label: 'Pai overview', href: 'https://www.tourismthailand.org/Destinations/Provinces/Mae-Hong-Son/103' },
        ],
        neighborhoods: [
            { name: 'Walking Street core', fit: 'Easy without a scooter' },
            { name: 'Riverside edge', fit: 'Quieter sleep and slower mornings' },
        ],
        highlights: ['Sunset viewpoint', 'Cafe morning', 'Hot spring or canyon split day'],
        mapHighlights: ['Night market strip', 'Scooter loop anchors', 'Quiet stay pockets'],
        notes: [
            'Trip-specific: Pai works best as a breath, not as a productivity sprint.',
            'General destination: roads and rain matter more than distance.',
        ],
        savedStays: [
            { area: 'Central Pai', vibe: 'Low-friction base', reason: 'Keeps the stop easy without extra transport.' },
        ],
        events: [],
    },
    {
        id: 'phuket',
        title: 'Phuket',
        matchers: ['phuket'],
        role: 'Beach gateway and transport hinge for the island leg.',
        idealStay: '3-4 nights',
        arrival: 'Pick your beach zone before arrival; cross-island transfers are slower than they look on a map.',
        transit: 'Taxis and booked rides dominate. Beach choice changes the whole trip feel.',
        officialLinks: [
            { label: 'Phuket Airport', href: 'https://phuket.airportthai.co.th' },
            { label: 'Tourism Phuket', href: 'https://www.tourismthailand.org/Destinations/Provinces/Phuket/104' },
        ],
        neighborhoods: [
            { name: 'Old Town', fit: 'Culture and food over beach resort mode' },
            { name: 'Kata', fit: 'Balanced beach stay' },
            { name: 'Mai Khao', fit: 'Quiet reset close to the airport' },
        ],
        highlights: ['Old Town evening', 'Boat planning day', 'Beach + spa split'],
        mapHighlights: ['Airport hinge', 'Best calm base zones', 'Easy boat handoff areas'],
        notes: [
            'Trip-specific: use Phuket as the logistics hinge, not necessarily the best atmosphere stay.',
        ],
        savedStays: [
            { area: 'Kata', vibe: 'Balanced beach base', reason: 'Easier mix of calm beach and restaurant access.' },
        ],
        events: [],
    },
    {
        id: 'phi-phi',
        title: 'Ko Phi Phi',
        matchers: ['kophiphi', 'phiphi', 'phi'],
        role: 'High-impact scenery stop for the iconic water-and-limestone mood.',
        idealStay: '2-3 nights',
        arrival: 'Ferry timing matters. Build sea-condition slack into the transfer day.',
        transit: 'Mostly footpaths and boats. You feel the island scale immediately.',
        officialLinks: [
            { label: 'Marine weather', href: 'https://www.tmd.go.th/en/' },
        ],
        neighborhoods: [
            { name: 'Tonsai edge', fit: 'Easy access with less late-night spillover' },
            { name: 'Long Beach', fit: 'Quieter sleep and scenic mornings' },
        ],
        highlights: ['Sunrise viewpoint', 'Boat day with weather buffer', 'Slow beach afternoon'],
        mapHighlights: ['Pier arrival zone', 'Viewpoint climb', 'Quieter stay edge'],
        notes: [
            'Trip-specific: keep one flexible island day for rough water or tour changes.',
        ],
        savedStays: [
            { area: 'Long Beach', vibe: 'Calmer postcard base', reason: 'Better if the trip wants atmosphere over party spill.' },
        ],
        events: [],
    },
    {
        id: 'krabi',
        title: 'Krabi / Ao Nang',
        matchers: ['krabi', 'aonang'],
        role: 'The coast leg where scenery and logistics need a deliberate tradeoff.',
        idealStay: '4-5 nights',
        arrival: 'Ao Nang is the easiest planning base. Railay is prettier but less forgiving when weather shifts.',
        transit: 'Boats define the pace. Tide, rain, and evening transfers change plans quickly.',
        officialLinks: [
            { label: 'Krabi tourism', href: 'https://www.tourismthailand.org/Destinations/Provinces/Krabi/223' },
        ],
        neighborhoods: [
            { name: 'Ao Nang', fit: 'Easiest logistics and day-trip base' },
            { name: 'Railay', fit: 'Best scenery and atmosphere' },
            { name: 'Koh Lanta', fit: 'Best slower island reset' },
        ],
        highlights: ['Longtail sunrise', 'Cliff and beach split day', 'Massage + seafood reset'],
        mapHighlights: ['Boat hubs', 'Quiet beaches', 'Wet-weather fallback areas'],
        notes: [
            'Trip-specific: this is the main booking-decision page because scenery and logistics pull in different directions.',
        ],
        savedStays: [
            { area: 'Ao Nang', vibe: 'Planner-friendly', reason: 'Best if the trip values easy boat and transfer control.' },
            { area: 'Railay', vibe: 'Signature scenery', reason: 'Best if the coast leg should feel unforgettable first.' },
        ],
        events: [
            { title: 'Boat weather buffer', detail: 'Keep one flexible coastal day for sea-condition changes.' },
        ],
    },
];

export const THAILAND_EXPLORE_LEADS: TripWorkspaceExploreLead[] = [
    {
        id: 'bangkok-talad-noi',
        cityId: 'bangkok',
        title: 'Talat Noi canal and photo walk',
        type: 'activity',
        description: 'A strong first Bangkok half-day with texture, river movement, and easy food wins.',
        query: 'Bangkok Talat Noi canal photo walk',
        reason: 'Works well right after arrival without burning the whole day.',
    },
    {
        id: 'chiang-mai-cooking',
        cityId: 'chiang-mai',
        title: 'Chiang Mai cooking class',
        type: 'activity',
        description: 'Reliable rainy-day anchor and one of the easiest memory-makers for this route.',
        query: 'Chiang Mai cooking class market tour',
        reason: 'Balances food, culture, and a clear booking decision.',
    },
    {
        id: 'krabi-ao-nang-stay',
        cityId: 'krabi',
        title: 'Ao Nang base shortlist',
        type: 'stay',
        description: 'Compare easy-logistics stays before deciding whether Railay is worth the handoff friction.',
        query: 'Ao Nang boutique hotel beachfront',
        reason: 'This is the highest-friction booking choice in the Thailand demo.',
    },
    {
        id: 'phi-phi-boat-weather',
        cityId: 'phi-phi',
        title: 'Phi Phi boat day weather watch',
        type: 'event',
        description: 'Use one flexible island day for weather-aware tour timing.',
        query: 'Phi Phi marine forecast',
        reason: 'Helps avoid locking the prettiest day into the roughest sea.',
    },
];

export const THAILAND_BOOKINGS: TripWorkspaceBookingRecord[] = [
    {
        id: 'booking-bangkok-stay',
        title: 'Bangkok arrival stay',
        status: 'Confirmed',
        cityId: 'bangkok',
        meta: '3 nights • Sathorn • airport-friendly arrival base',
    },
    {
        id: 'booking-chiang-mai-flight',
        title: 'Bangkok → Chiang Mai flight',
        status: 'Needs review',
        cityId: 'chiang-mai',
        meta: 'Carry-on fare is booked, but baggage rules still need a final check.',
    },
    {
        id: 'booking-krabi-base',
        title: 'Krabi coast base',
        status: 'Missing',
        cityId: 'krabi',
        meta: 'Need a final decision between Ao Nang logistics and Railay atmosphere.',
    },
];

export const THAILAND_NOTES: TripWorkspaceNoteRecord[] = [
    {
        id: 'note-arrival-reset',
        title: 'Arrival reset',
        type: 'arrival',
        body: 'Land, hydrate, stay local for dinner, and keep the first Bangkok evening light.',
    },
    {
        id: 'note-chiang-mai-rhythm',
        title: 'Chiang Mai rhythm',
        type: 'rhythm',
        body: 'Temples early, café block in the afternoon, market after dark.',
    },
    {
        id: 'note-island-fallback',
        title: 'Island fallback',
        type: 'fallback',
        body: 'If sea conditions turn, swap the boat day for massage, cafés, and inland viewpoints.',
    },
];

export const THAILAND_PHOTOS: TripWorkspacePhotoRecord[] = [
    {
        id: 'photo-bangkok',
        title: 'Bangkok rooftop rain haze',
        caption: 'Demo album anchor for the city-arrival mood.',
        mood: 'Warm haze',
    },
    {
        id: 'photo-chiang-mai',
        title: 'Lantern-lit Chiang Mai alley',
        caption: 'Demo placeholder for the slower northern night texture.',
        mood: 'Night market glow',
    },
    {
        id: 'photo-railay',
        title: 'Railay limestone at sunrise',
        caption: 'Demo postcard moment for the signature coast leg.',
        mood: 'Big scenic payoff',
    },
];

export const THAILAND_PHRASE_CARDS: TripWorkspacePhraseCard[] = [
    {
        id: 'hello',
        cityId: 'bangkok',
        category: 'basics',
        phrase: 'Hello',
        local: 'Sawasdee krap / ka',
        pronunciation: 'sa-wat-dee krap / ka',
        usage: 'Use this as the friendly default opener almost everywhere.',
    },
    {
        id: 'thank-you',
        cityId: 'bangkok',
        category: 'basics',
        phrase: 'Thank you',
        local: 'Khop khun krap / ka',
        pronunciation: 'kop-kun krap / ka',
        usage: 'Low effort, high warmth in markets, hotels, and cafés.',
    },
    {
        id: 'station',
        cityId: 'bangkok',
        category: 'transport',
        phrase: 'Where is the station?',
        local: 'Sathanee yoo tee nai?',
        pronunciation: 'sa-tha-nee yoo tee nai',
        usage: 'Useful in Bangkok when rail links are easier than road traffic.',
    },
    {
        id: 'reservation',
        cityId: 'krabi',
        category: 'transport',
        phrase: 'I have a reservation',
        local: 'Chan mee gan jong wai laeo',
        pronunciation: 'chan mee gan jong wai laeo',
        usage: 'Best for hotels, ferries, and transfer desks.',
    },
    {
        id: 'vegetarian',
        cityId: 'chiang-mai',
        category: 'food',
        phrase: 'I am vegetarian',
        local: 'Chan gin jay',
        pronunciation: 'chan gin jay',
        usage: 'Especially handy in Chiang Mai café and market runs.',
    },
    {
        id: 'not-spicy',
        cityId: 'chiang-mai',
        category: 'food',
        phrase: 'Not too spicy, please',
        local: 'Mai phet mak na',
        pronunciation: 'mai pet mak na',
        usage: 'Worth saving before the first market dinner.',
    },
    {
        id: 'help',
        cityId: 'phi-phi',
        category: 'emergency',
        phrase: 'Please help me',
        local: 'Chuay duay',
        pronunciation: 'chuay duay',
        usage: 'Simple and broad when you need a fast handoff.',
    },
    {
        id: 'hospital',
        cityId: 'phuket',
        category: 'emergency',
        phrase: 'Where is the hospital?',
        local: 'Rong phayaban yoo tee nai?',
        pronunciation: 'rong pa-ya-ban yoo tee nai',
        usage: 'Keep this in the emergency pack even if you never use it.',
    },
];

export const getTripWorkspaceCityGuide = (cityTitle: string): TripWorkspaceCityGuide | null => {
    const normalized = normalizeValue(cityTitle);
    return THAILAND_CITY_GUIDES.find((city) => city.matchers.some((matcher) => normalized.includes(matcher))) ?? null;
};

export const getTripWorkspaceCityItem = (trip: ITrip, guideId: string): ITimelineItem | null => (
    resolveTripWorkspaceCityStops(trip.items).find((item) => getTripWorkspaceCityGuide(item.title)?.id === guideId) ?? null
);

export const buildTripWorkspaceCityGuides = (trip: ITrip): TripWorkspaceCityGuide[] => {
    const seen = new Set<string>();
    return resolveTripWorkspaceCityStops(trip.items)
        .map((item) => getTripWorkspaceCityGuide(item.title))
        .filter((guide): guide is TripWorkspaceCityGuide => {
            if (!guide) return false;
            if (seen.has(guide.id)) return false;
            seen.add(guide.id);
            return true;
        });
};

export const getTripWorkspacePhraseCardsForCategory = (category: PhraseCategory): TripWorkspacePhraseCard[] =>
    THAILAND_PHRASE_CARDS.filter((card) => card.category === category);
