import type { ActivityType, ITrip, ITimelineItem } from '../../../types';

export type PhraseCategory = 'basics' | 'transport' | 'food' | 'emergency';
export type PhraseReviewRating = 'new' | 'easy' | 'practice';

export interface TripWorkspaceCountryFact {
    label: string;
    value: string;
    badge?: string;
    freshness?: string;
    sourceLine?: string;
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

export interface TripWorkspaceCityMapLayer {
    id: string;
    label: string;
    scope: 'Trip-specific' | 'General destination';
    detail: string;
    freshness: string;
    sourceLine: string;
    neighborhoodNames: string[];
    stayAreas: string[];
}

export interface TripWorkspaceCityGuide {
    id: string;
    title: string;
    matchers: string[];
    role: string;
    freshness: string;
    sourceLine: string;
    idealStay: string;
    arrival: string;
    transit: string;
    officialLinks: Array<{ label: string; href: string }>;
    neighborhoods: TripWorkspaceCityNeighborhood[];
    highlights: string[];
    mapLayers: TripWorkspaceCityMapLayer[];
    tripInsights: string[];
    generalInsights: string[];
    savedStays: TripWorkspaceCityStay[];
    events: Array<{ title: string; detail: string }>;
}

export interface TripWorkspaceExploreLead {
    id: string;
    cityId: string;
    title: string;
    type: 'activity' | 'stay' | 'event';
    activityTypes?: ActivityType[];
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

export type TripWorkspaceTravelKitSectionId = 'entry' | 'arrival' | 'islands';

export interface TripWorkspaceTravelKitChecklistItem {
    id: string;
    section: TripWorkspaceTravelKitSectionId;
    label: string;
    detail: string;
    scope: 'Trip-specific' | 'General destination';
}

export interface TripWorkspaceTravelKitUtility {
    id: string;
    label: string;
    value: string;
    detail: string;
    badge: string;
}

export interface TripWorkspaceTravelKitEmergencyCard {
    id: string;
    title: string;
    contact: string;
    detail: string;
    tone: 'secondary' | 'outline';
}

export interface TripWorkspaceTravelKitPack {
    id: string;
    label: string;
    detail: string;
    includes: string[];
}

export type TripWorkspaceDocumentSectionId = 'entry' | 'transport' | 'stays' | 'coverage';

export interface TripWorkspaceDocumentRecord {
    id: string;
    section: TripWorkspaceDocumentSectionId;
    title: string;
    status: 'Verified' | 'Review' | 'Missing';
    scope: 'Trip-specific' | 'General destination';
    carryMode: 'Offline' | 'Printed' | 'Either';
    detail: string;
    referenceLabel?: string;
    referenceValue?: string;
    sourceLine: string;
    tags: string[];
}

export interface TripWorkspaceDocumentPacket {
    id: string;
    label: string;
    detail: string;
    documentIds: string[];
}

export type TripWorkspaceBudgetScenarioId = 'lean' | 'balanced' | 'comfort';
export type TripWorkspaceBudgetCategoryId = 'stay' | 'transport' | 'food' | 'activity' | 'buffer';

export interface TripWorkspaceBudgetScenario {
    id: TripWorkspaceBudgetScenarioId;
    label: string;
    vibe: string;
    dailyTarget: number;
    totalEstimate: number;
    reserveBuffer: number;
}

export interface TripWorkspaceBudgetLineItem {
    id: string;
    cityId: string;
    title: string;
    category: TripWorkspaceBudgetCategoryId;
    status: 'Locked' | 'Flexible' | 'Watch';
    amount: number;
    detail: string;
}

export type TripWorkspaceWeatherLensId = 'feel' | 'rain' | 'sea' | 'pack';

export interface TripWorkspaceWeatherSignal {
    label: string;
    value: string;
    tone: 'secondary' | 'outline';
}

export interface TripWorkspaceWeatherForecastDay {
    label: string;
    tempC: string;
    condition: string;
    rainChance: string;
}

export interface TripWorkspaceWeatherStop {
    id: string;
    title: string;
    updateLine: string;
    headline: string;
    travelFeel: string;
    caution: string;
    activityWindow: string;
    seaNote: string;
    packNotes: string[];
    forecast: TripWorkspaceWeatherForecastDay[];
    signals: TripWorkspaceWeatherSignal[];
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
        freshness: 'Updated weekly',
        sourceLine: 'Official immigration source',
        link: { label: 'Thailand Immigration', href: 'https://www.immigration.go.th' },
    },
    {
        label: 'Sockets & voltage',
        value: 'Type A, B, C and O • 220V. A universal adapter keeps Bangkok hotels and island stays simple.',
        badge: 'Practical',
        freshness: 'Stable',
        sourceLine: 'Evergreen travel prep',
    },
    {
        label: 'Driving side',
        value: 'Left-hand traffic. Rental scooters feel very different between city streets and island roads.',
        badge: 'Practical',
        freshness: 'Stable',
        sourceLine: 'Transport rule of thumb',
    },
    {
        label: 'Connectivity',
        value: 'Good eSIM coverage in Bangkok, Chiang Mai, and Phuket, but boat transfer days can still dip.',
        badge: 'Trip-ready',
        freshness: 'Updated this season',
        sourceLine: 'Tourism + carrier summary',
        link: { label: 'Tourism Authority', href: 'https://www.tourismthailand.org' },
    },
    {
        label: 'Cash & cards',
        value: 'Cards work in city hotels and cafes, but night markets, ferries, and small food stalls still prefer cash.',
        badge: 'Practical',
        freshness: 'Updated weekly',
        sourceLine: 'Trip-specific payment note',
    },
    {
        label: 'Cultural context',
        value: 'Temple dress, easy shoes, and respectful body language matter more than over-planning facts lists.',
        badge: 'Context',
        freshness: 'Stable',
        sourceLine: 'General destination context',
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
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
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
        mapLayers: [
            {
                id: 'arrival',
                label: 'Arrival flow',
                scope: 'Trip-specific',
                detail: 'Keep the first-night base near easy airport handoffs, a low-friction dinner zone, and a simple morning reset route.',
                freshness: 'Updated this week',
                sourceLine: 'Trip-specific demo planning layer',
                neighborhoodNames: ['Sathorn', 'Ari'],
                stayAreas: ['Sathorn'],
            },
            {
                id: 'food',
                label: 'Food corridors',
                scope: 'General destination',
                detail: 'Late-opening food streets and market pockets matter more than landmark density once jet lag hits.',
                freshness: 'Updated this season',
                sourceLine: 'General city context',
                neighborhoodNames: ['Talat Noi', 'Ari'],
                stayAreas: ['Ari'],
            },
        ],
        tripInsights: [
            'Trip-specific: use Bangkok as the recovery buffer before any domestic hop.',
            'Trip-specific: keep the first full day light so the route starts with energy instead of friction.',
        ],
        generalInsights: [
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
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
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
        mapLayers: [
            {
                id: 'orientation',
                label: 'Orientation loop',
                scope: 'Trip-specific',
                detail: 'The first two days work best when the stay anchors an easy temple loop, one café quarter, and a clean airport return.',
                freshness: 'Updated this week',
                sourceLine: 'Trip-specific demo planning layer',
                neighborhoodNames: ['Old City', 'Riverside'],
                stayAreas: ['Old City'],
            },
            {
                id: 'cafe',
                label: 'Cafe rhythm',
                scope: 'General destination',
                detail: 'Nimman and the riverside shift the city from temple-heavy to slower and more social.',
                freshness: 'Updated this season',
                sourceLine: 'General city context',
                neighborhoodNames: ['Nimman', 'Riverside'],
                stayAreas: ['Nimman'],
            },
        ],
        tripInsights: [
            'Trip-specific: keep one unscheduled afternoon for slower café recovery.',
        ],
        generalInsights: [
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
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
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
        mapLayers: [
            {
                id: 'easy-base',
                label: 'Easy base',
                scope: 'Trip-specific',
                detail: 'Staying close to the core keeps Pai from turning into a transport problem when the stop is meant to recover energy.',
                freshness: 'Updated this week',
                sourceLine: 'Trip-specific demo planning layer',
                neighborhoodNames: ['Walking Street core'],
                stayAreas: ['Central Pai'],
            },
            {
                id: 'quiet',
                label: 'Quiet mornings',
                scope: 'General destination',
                detail: 'The best slow-travel version of Pai comes from trading nightlife spill for calmer river-edge mornings.',
                freshness: 'Updated this season',
                sourceLine: 'General city context',
                neighborhoodNames: ['Riverside edge'],
                stayAreas: ['Central Pai'],
            },
        ],
        tripInsights: [
            'Trip-specific: Pai works best as a breath, not as a productivity sprint.',
        ],
        generalInsights: [
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
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
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
        mapLayers: [
            {
                id: 'airport-hinge',
                label: 'Airport hinge',
                scope: 'Trip-specific',
                detail: 'Phuket is strongest when it acts as the route hinge: easy arrival, easy boat handoff, minimal cross-island drag.',
                freshness: 'Updated this week',
                sourceLine: 'Trip-specific demo planning layer',
                neighborhoodNames: ['Mai Khao', 'Kata'],
                stayAreas: ['Kata'],
            },
            {
                id: 'calm-zones',
                label: 'Calm zones',
                scope: 'General destination',
                detail: 'Quiet beach edges change the island mood dramatically compared with nightlife-heavy strips.',
                freshness: 'Updated this season',
                sourceLine: 'General city context',
                neighborhoodNames: ['Mai Khao', 'Old Town'],
                stayAreas: ['Kata'],
            },
        ],
        tripInsights: [
            'Trip-specific: use Phuket as the logistics hinge, not necessarily the best atmosphere stay.',
        ],
        generalInsights: [],
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
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
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
        mapLayers: [
            {
                id: 'pier-day',
                label: 'Pier day',
                scope: 'Trip-specific',
                detail: 'Transfer-day friction is the main planning issue here, so keep the first and last nights easy on foot.',
                freshness: 'Updated this week',
                sourceLine: 'Trip-specific demo planning layer',
                neighborhoodNames: ['Tonsai edge'],
                stayAreas: ['Long Beach'],
            },
            {
                id: 'quiet-scenery',
                label: 'Quiet scenery',
                scope: 'General destination',
                detail: 'The better Phi Phi experience usually comes from trading party proximity for calmer dawn access.',
                freshness: 'Updated this season',
                sourceLine: 'General city context',
                neighborhoodNames: ['Long Beach'],
                stayAreas: ['Long Beach'],
            },
        ],
        tripInsights: [
            'Trip-specific: keep one flexible island day for rough water or tour changes.',
        ],
        generalInsights: [],
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
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
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
        mapLayers: [
            {
                id: 'boat-hubs',
                label: 'Boat hubs',
                scope: 'Trip-specific',
                detail: 'This coast leg works best when boat timing, bag drag, and weather buffers are treated as first-class decisions.',
                freshness: 'Updated this week',
                sourceLine: 'Trip-specific demo planning layer',
                neighborhoodNames: ['Ao Nang', 'Railay'],
                stayAreas: ['Ao Nang'],
            },
            {
                id: 'slow-reset',
                label: 'Slow reset',
                scope: 'General destination',
                detail: 'The most restorative version of Krabi usually means quieter beaches and less transfer churn.',
                freshness: 'Updated this season',
                sourceLine: 'General city context',
                neighborhoodNames: ['Koh Lanta', 'Railay'],
                stayAreas: ['Railay'],
            },
        ],
        tripInsights: [
            'Trip-specific: this is the main booking-decision page because scenery and logistics pull in different directions.',
        ],
        generalInsights: [],
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
        activityTypes: ['culture', 'sightseeing'],
        description: 'A strong first Bangkok half-day with texture, river movement, and easy food wins.',
        query: 'Bangkok Talat Noi canal photo walk',
        reason: 'Works well right after arrival without burning the whole day.',
    },
    {
        id: 'chiang-mai-cooking',
        cityId: 'chiang-mai',
        title: 'Chiang Mai cooking class',
        type: 'activity',
        activityTypes: ['food', 'culture'],
        description: 'Reliable rainy-day anchor and one of the easiest memory-makers for this route.',
        query: 'Chiang Mai cooking class market tour',
        reason: 'Balances food, culture, and a clear booking decision.',
    },
    {
        id: 'krabi-longtail-sunrise',
        cityId: 'krabi',
        title: 'Long-tail sunrise limestone loop',
        type: 'activity',
        activityTypes: ['adventure', 'beach', 'nature'],
        description: 'A strong coast-day candidate when you want the big scenery payoff without sacrificing the whole afternoon.',
        query: 'Krabi long tail sunrise island loop',
        reason: 'Good signature-day option once the coast base is locked.',
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

export const THAILAND_TRAVEL_KIT_CHECKLIST: TripWorkspaceTravelKitChecklistItem[] = [
    {
        id: 'passport-proof',
        section: 'entry',
        label: 'Keep passport validity and onward-proof handy',
        detail: 'Thailand entry checks can still turn on passport rules, arrival mode, and proof of onward travel.',
        scope: 'General destination',
    },
    {
        id: 'esim-download',
        section: 'entry',
        label: 'Download eSIM and offline map pack before departure',
        detail: 'Bangkok is easy, but the first working connection matters most on airport and ferry handoff days.',
        scope: 'Trip-specific',
    },
    {
        id: 'arrival-cash',
        section: 'arrival',
        label: 'Carry a small arrival cash buffer in THB',
        detail: 'Cards work often, but ferries, food stalls, and first-night transport backups stay smoother with cash.',
        scope: 'Trip-specific',
    },
    {
        id: 'temple-pack',
        section: 'arrival',
        label: 'Keep temple-ready layers and easy shoes close',
        detail: 'Dress rules matter more than a long facts sheet once the trip starts moving.',
        scope: 'General destination',
    },
    {
        id: 'boat-buffer',
        section: 'islands',
        label: 'Protect one flexible day for sea and transfer changes',
        detail: 'The island leg works better when weather and boat timing do not destroy the whole route.',
        scope: 'Trip-specific',
    },
    {
        id: 'waterproof-pack',
        section: 'islands',
        label: 'Pack one waterproof bag and one quick-dry layer',
        detail: 'This is the easiest way to reduce ferry-day friction across Phuket, Phi Phi, and Krabi.',
        scope: 'Trip-specific',
    },
];

export const THAILAND_TRAVEL_KIT_UTILITIES: TripWorkspaceTravelKitUtility[] = [
    {
        id: 'power',
        label: 'Power kit',
        value: 'Type A, B, C, O • 220V',
        detail: 'A universal adapter covers almost the whole route without overthinking it.',
        badge: 'Stable',
    },
    {
        id: 'cash',
        label: 'Cash rhythm',
        value: 'City cards + island cash',
        detail: 'Bangkok and Chiang Mai feel card-friendly, but island and night-market days still lean cash.',
        badge: 'Updated weekly',
    },
    {
        id: 'sim',
        label: 'Connectivity',
        value: 'Strong cities, weaker boat days',
        detail: 'Use one eSIM plan and keep screenshots for bookings, ferry piers, and hotel names.',
        badge: 'Updated this season',
    },
];

export const THAILAND_TRAVEL_KIT_EMERGENCY_CARDS: TripWorkspaceTravelKitEmergencyCard[] = [
    {
        id: 'tourist-police',
        title: 'Tourist Police',
        contact: '1155',
        detail: 'Best first call for tourist-facing help when you need an English-speaking bridge fast.',
        tone: 'secondary',
    },
    {
        id: 'medical',
        title: 'Medical emergency',
        contact: '1669',
        detail: 'Keep this close even if it never leaves the demo support layer.',
        tone: 'outline',
    },
    {
        id: 'marine-weather',
        title: 'Marine weather watch',
        contact: 'Check the TMD marine bulletin',
        detail: 'Boat-day choices are the first disruption risk for the south Thailand leg.',
        tone: 'outline',
    },
];

export const THAILAND_TRAVEL_KIT_PACKS: TripWorkspaceTravelKitPack[] = [
    {
        id: 'arrival-pack',
        label: 'Arrival night',
        detail: 'Use this when the first 24 hours should feel easy, clean, and low-friction.',
        includes: ['eSIM QR ready', 'Cash buffer', 'Hotel name screenshot', 'One fresh outfit'],
    },
    {
        id: 'temple-pack',
        label: 'Temple and city day',
        detail: 'A lighter city kit works better than carrying everything all day in Bangkok or Chiang Mai.',
        includes: ['Shoulder cover', 'Easy shoes', 'Water bottle', 'Battery pack'],
    },
    {
        id: 'island-pack',
        label: 'Island transfer day',
        detail: 'This keeps the coastal leg calm when ferries, rain, and wet bags start to stack.',
        includes: ['Waterproof pouch', 'Quick-dry layer', 'Cash split', 'Offline booking screenshots'],
    },
];

export const THAILAND_DOCUMENT_RECORDS: TripWorkspaceDocumentRecord[] = [
    {
        id: 'passport',
        section: 'entry',
        title: 'Passport and validity check',
        status: 'Verified',
        scope: 'General destination',
        carryMode: 'Either',
        detail: 'Keep the passport-validity rule visible before departure and store one offline copy in case airport Wi-Fi is unreliable.',
        referenceLabel: 'Passport holder',
        referenceValue: 'Primary traveler',
        sourceLine: 'General entry prep',
        tags: ['Identity', 'Entry', 'Before departure'],
    },
    {
        id: 'onward-proof',
        section: 'entry',
        title: 'Onward travel proof',
        status: 'Review',
        scope: 'Trip-specific',
        carryMode: 'Offline',
        detail: 'Keep the Bangkok arrival flight plus the next booked exit or onward leg ready in one offline folder.',
        referenceLabel: 'Current proof',
        referenceValue: 'Bangkok → Chiang Mai flight',
        sourceLine: 'Trip-specific entry handoff',
        tags: ['Arrival', 'Flight', 'Keep offline'],
    },
    {
        id: 'insurance',
        section: 'coverage',
        title: 'Insurance summary and emergency contact',
        status: 'Verified',
        scope: 'Trip-specific',
        carryMode: 'Offline',
        detail: 'Store policy number, support phone, and the “what counts as covered” summary where you can open it fast.',
        referenceLabel: 'Policy ref',
        referenceValue: 'TF-TH-4821',
        sourceLine: 'Demo insurance packet',
        tags: ['Medical', 'Support', 'Policy'],
    },
    {
        id: 'flight-booking',
        section: 'transport',
        title: 'Domestic flight and baggage proof',
        status: 'Review',
        scope: 'Trip-specific',
        carryMode: 'Offline',
        detail: 'This one matters because cabin-only assumptions can break the route if baggage rules change on the Bangkok → Chiang Mai hop.',
        referenceLabel: 'Booking code',
        referenceValue: 'CNX84Q',
        sourceLine: 'Trip-specific transport hinge',
        tags: ['Flight', 'Baggage', 'Check-in'],
    },
    {
        id: 'ferry-pack',
        section: 'transport',
        title: 'Island ferry confirmations',
        status: 'Missing',
        scope: 'Trip-specific',
        carryMode: 'Printed',
        detail: 'Boat counters and piers are the most likely part of the route to reward a printed backup when phone battery, rain, or signal gets messy.',
        referenceLabel: 'Needed for',
        referenceValue: 'Phuket → Phi Phi → Krabi',
        sourceLine: 'South Thailand transfer packet',
        tags: ['Ferry', 'Printed backup', 'Coast leg'],
    },
    {
        id: 'hotel-sheet',
        section: 'stays',
        title: 'First-night stay sheet',
        status: 'Verified',
        scope: 'Trip-specific',
        carryMode: 'Offline',
        detail: 'Keep the Bangkok arrival hotel name, address, booking code, and map screenshot together for the first-night handoff.',
        referenceLabel: 'Hotel code',
        referenceValue: 'SATHORN-01',
        sourceLine: 'Arrival stay handoff',
        tags: ['Hotel', 'Arrival', 'Map screenshot'],
    },
    {
        id: 'stay-balance',
        section: 'stays',
        title: 'Unbooked coast-base decision',
        status: 'Missing',
        scope: 'Trip-specific',
        carryMode: 'Either',
        detail: 'The route still needs one final coast-base decision before the full hotel packet can be trusted from end to end.',
        referenceLabel: 'Blocked by',
        referenceValue: 'Ao Nang vs Railay stay choice',
        sourceLine: 'Booking-dependent packet',
        tags: ['Missing stay', 'Coast leg', 'Decision blocker'],
    },
];

export const THAILAND_DOCUMENT_PACKETS: TripWorkspaceDocumentPacket[] = [
    {
        id: 'entry-file',
        label: 'Entry file',
        detail: 'Everything needed to clear the first arrival without rummaging through email.',
        documentIds: ['passport', 'onward-proof', 'hotel-sheet'],
    },
    {
        id: 'coverage-file',
        label: 'Coverage file',
        detail: 'Support numbers, policy references, and medical context in one calm place.',
        documentIds: ['insurance'],
    },
    {
        id: 'air-and-rail',
        label: 'Air and inland transport',
        detail: 'The domestic flight packet matters because it shapes the rhythm of the north Thailand handoff.',
        documentIds: ['flight-booking'],
    },
    {
        id: 'island-transfer',
        label: 'Island transfer packet',
        detail: 'The coastal route is the one part of this trip where printed backups still make emotional sense.',
        documentIds: ['ferry-pack', 'stay-balance'],
    },
];

export const THAILAND_BUDGET_SCENARIOS: TripWorkspaceBudgetScenario[] = [
    {
        id: 'lean',
        label: 'Lean',
        vibe: 'Save the cash for one or two signature days and keep the route simple elsewhere.',
        dailyTarget: 74,
        totalEstimate: 1920,
        reserveBuffer: 180,
    },
    {
        id: 'balanced',
        label: 'Balanced',
        vibe: 'Comfortable city stays, a few strong activity days, and room for a weather detour.',
        dailyTarget: 112,
        totalEstimate: 2910,
        reserveBuffer: 360,
    },
    {
        id: 'comfort',
        label: 'Comfort',
        vibe: 'Nicer rooms, cleaner transfer buffers, and less need to optimize every small spend.',
        dailyTarget: 158,
        totalEstimate: 4100,
        reserveBuffer: 620,
    },
];

export const THAILAND_BUDGET_LINE_ITEMS: TripWorkspaceBudgetLineItem[] = [
    {
        id: 'budget-bangkok-stay',
        cityId: 'bangkok',
        title: 'Bangkok arrival stay',
        category: 'stay',
        status: 'Locked',
        amount: 320,
        detail: 'Three nights in Sathorn with the easy airport handoff already solved.',
    },
    {
        id: 'budget-chiang-mai-flight',
        cityId: 'chiang-mai',
        title: 'Bangkok → Chiang Mai flight',
        category: 'transport',
        status: 'Watch',
        amount: 96,
        detail: 'Carry-on fare looks fine, but baggage rules could still nudge the real total upward.',
    },
    {
        id: 'budget-chiang-mai-stay',
        cityId: 'chiang-mai',
        title: 'Chiang Mai stay block',
        category: 'stay',
        status: 'Flexible',
        amount: 290,
        detail: 'Old City is easiest, Nimman is nicer, and the cost swing changes the north rhythm fast.',
    },
    {
        id: 'budget-food-rhythm',
        cityId: 'bangkok',
        title: 'Street food and café rhythm',
        category: 'food',
        status: 'Locked',
        amount: 210,
        detail: 'This route does not need big restaurant spending to feel rich if the day pacing is right.',
    },
    {
        id: 'budget-signature-activities',
        cityId: 'krabi',
        title: 'Signature activity pocket',
        category: 'activity',
        status: 'Flexible',
        amount: 175,
        detail: 'Cooking class, one sunrise long-tail day, and one skyline or spa splurge still fit cleanly.',
    },
    {
        id: 'budget-krabi-base',
        cityId: 'krabi',
        title: 'Krabi coast-base decision',
        category: 'stay',
        status: 'Watch',
        amount: 420,
        detail: 'Ao Nang keeps logistics cheaper; Railay pushes atmosphere up and transfer friction with it.',
    },
    {
        id: 'budget-island-transfers',
        cityId: 'phi-phi',
        title: 'Island transfer chain',
        category: 'transport',
        status: 'Flexible',
        amount: 165,
        detail: 'Boat days are usually where the route quietly leaks money once timing gets sloppy.',
    },
    {
        id: 'budget-weather-buffer',
        cityId: 'krabi',
        title: 'Weather and ferry buffer',
        category: 'buffer',
        status: 'Watch',
        amount: 120,
        detail: 'One protected cushion keeps the coast leg from turning one rough sea day into a cascade.',
    },
];

export const THAILAND_WEATHER_STOPS: TripWorkspaceWeatherStop[] = [
    {
        id: 'bangkok',
        title: 'Bangkok',
        updateLine: 'Updated hourly demo pulse',
        headline: 'Hot city start with late-day storm chances and a real need to front-load the good hours.',
        travelFeel: 'Bangkok works best before the pavement stores heat. Mornings feel productive; afternoons feel heavier than the map suggests.',
        caution: 'River hops and rooftop timing both get worse if you pretend a 16:00 departure feels like a 09:00 departure.',
        activityWindow: 'Best window: 07:30-10:30 for temples, 18:00 onward for skyline and food.',
        seaNote: 'No sea risk here. Treat Bangkok as the place to recover energy before the weather-sensitive south.',
        packNotes: ['Light overshirt for malls and trains', 'Electrolytes on arrival day', 'Umbrella after lunch'],
        forecast: [
            { label: 'Fri', tempC: '34°', condition: 'Humid sun', rainChance: '20%' },
            { label: 'Sat', tempC: '35°', condition: 'Late shower', rainChance: '45%' },
            { label: 'Sun', tempC: '33°', condition: 'Cloud breaks', rainChance: '35%' },
            { label: 'Mon', tempC: '34°', condition: 'Storm watch', rainChance: '60%' },
        ],
        signals: [
            { label: 'Heat feel', value: 'High after noon', tone: 'secondary' },
            { label: 'Transit risk', value: 'Traffic spikes in rain', tone: 'outline' },
            { label: 'Photo light', value: 'Best at dawn and blue hour', tone: 'outline' },
        ],
    },
    {
        id: 'chiang-mai',
        title: 'Chiang Mai',
        updateLine: 'Updated daily demo pulse',
        headline: 'Softer mornings, easier evenings, and a calmer pace as long as rain haze does not steal the hills.',
        travelFeel: 'Chiang Mai rewards slower pacing more than density. You can do more with one quiet café block than with a packed checklist.',
        caution: 'If the route wants mountain views, keep one fallback plan because haze and rain flatten the high-impact outings first.',
        activityWindow: 'Best window: sunrise to 11:00 for temple or hill trips, after 17:30 for markets.',
        seaNote: 'No marine risk, but haze can play the same role as rough water by killing the scenic version of the day.',
        packNotes: ['Light layer for early scooters or songthaews', 'Mask if haze spikes', 'Portable fan helps less than you think'],
        forecast: [
            { label: 'Tue', tempC: '31°', condition: 'Bright and dry', rainChance: '15%' },
            { label: 'Wed', tempC: '32°', condition: 'Cloudy heat', rainChance: '25%' },
            { label: 'Thu', tempC: '30°', condition: 'Storm edge', rainChance: '55%' },
            { label: 'Fri', tempC: '29°', condition: 'Rain break', rainChance: '40%' },
        ],
        signals: [
            { label: 'Walk comfort', value: 'Good before lunch', tone: 'secondary' },
            { label: 'Hill clarity', value: 'Variable this week', tone: 'outline' },
            { label: 'Market nights', value: 'Safe bet after sunset', tone: 'secondary' },
        ],
    },
    {
        id: 'krabi',
        title: 'Krabi / Ao Nang',
        updateLine: 'Updated marine-aware demo pulse',
        headline: 'This is the weather hinge of the route: sea mood, storm timing, and transfer windows all matter more than the temperature itself.',
        travelFeel: 'The south is where the weather stops being background and starts changing the quality of the whole trip day.',
        caution: 'Boat mornings can still look fine on land while turning rough enough to scramble the scenic plan by mid-route.',
        activityWindow: 'Best window: sunrise to early lunch for long-tail or beach moves, inland fallback after 15:00.',
        seaNote: 'Keep one flexible coast day. That single decision protects both your mood and your budget.',
        packNotes: ['Dry bag for ferries', 'Quick-dry shirt', 'One clean inland fallback plan', 'Offline pier screenshots'],
        forecast: [
            { label: 'Sat', tempC: '32°', condition: 'Bright start', rainChance: '30%' },
            { label: 'Sun', tempC: '31°', condition: 'Sea breeze', rainChance: '25%' },
            { label: 'Mon', tempC: '30°', condition: 'Storm pockets', rainChance: '65%' },
            { label: 'Tue', tempC: '31°', condition: 'Cloud + sun', rainChance: '40%' },
        ],
        signals: [
            { label: 'Boat confidence', value: 'Watch Monday closely', tone: 'outline' },
            { label: 'Beach payoff', value: 'Best before noon', tone: 'secondary' },
            { label: 'Transfer drag', value: 'High in rain', tone: 'outline' },
        ],
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
