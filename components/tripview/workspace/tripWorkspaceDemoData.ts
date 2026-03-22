import type { ActivityType, ITrip, ITimelineItem, TripWorkspaceContextSelection } from '../../../types';

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

export interface TripWorkspaceMapPercentPoint {
    x: number;
    y: number;
}

export interface TripWorkspaceCityNeighborhood {
    name: string;
    fit: string;
    mapPosition: TripWorkspaceMapPercentPoint;
    mapRadius: 'sm' | 'md' | 'lg';
}

export interface TripWorkspaceCityStay {
    area: string;
    vibe: string;
    reason: string;
    mapPosition: TripWorkspaceMapPercentPoint;
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
    focusPath: TripWorkspaceMapPercentPoint[];
    callout: {
        label: string;
        detail: string;
        position: TripWorkspaceMapPercentPoint;
    };
}

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

export interface TripWorkspaceCityWeatherProfile {
    updateLine: string;
    headline: string;
    travelFeel: string;
    caution: string;
    activityWindow: string;
    seaNote: string;
    packNotes: string[];
    routeImpact: string;
    forecast: TripWorkspaceWeatherForecastDay[];
    signals: TripWorkspaceWeatherSignal[];
}

export interface TripWorkspaceCityGuide {
    id: string;
    title: string;
    matchers: string[];
    countryCode?: string;
    countryName?: string;
    role: string;
    freshness: string;
    sourceLine: string;
    idealStay: string;
    arrival: string;
    transit: string;
    bestFor?: string[];
    dayTrips?: Array<{ title: string; detail: string }>;
    practicalNotes?: string[];
    officialLinks: Array<{ label: string; href: string }>;
    neighborhoods: TripWorkspaceCityNeighborhood[];
    highlights: string[];
    mapLayers: TripWorkspaceCityMapLayer[];
    tripInsights: string[];
    generalInsights: string[];
    savedStays: TripWorkspaceCityStay[];
    events: Array<{ title: string; detail: string }>;
    weather?: TripWorkspaceCityWeatherProfile;
}

export interface TripWorkspaceExploreLead {
    id: string;
    countryCode?: string;
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
    countryCode?: string;
    cityId: string;
    type?: 'stay' | 'transport' | 'activity' | 'entry';
    meta: string;
}

export interface TripWorkspaceNoteRecord {
    id: string;
    countryCode?: string;
    cityId?: string;
    title: string;
    type: 'arrival' | 'rhythm' | 'fallback';
    moment?: string;
    body: string;
}

export interface TripWorkspacePhotoRecord {
    id: string;
    countryCode?: string;
    cityId?: string;
    title: string;
    caption: string;
    mood: string;
}

export interface TripWorkspacePhraseCard {
    id: string;
    countryCode?: string;
    cityId: string;
    languageCode?: string;
    languageName?: string;
    category: PhraseCategory;
    phrase: string;
    local: string;
    pronunciation: string;
    usage: string;
}

export type TripWorkspaceTravelKitSectionId = 'entry' | 'arrival' | 'border' | 'regional' | 'islands';

export interface TripWorkspaceTravelKitChecklistItem {
    id: string;
    section: TripWorkspaceTravelKitSectionId;
    countryCode?: string;
    cityId?: string;
    label: string;
    detail: string;
    scope: 'Trip-specific' | 'General destination';
}

export interface TripWorkspaceTravelKitUtility {
    id: string;
    countryCode?: string;
    label: string;
    value: string;
    detail: string;
    badge: string;
}

export interface TripWorkspaceTravelKitEmergencyCard {
    id: string;
    countryCode?: string;
    title: string;
    contact: string;
    detail: string;
    tone: 'secondary' | 'outline';
}

export interface TripWorkspaceTravelKitPack {
    id: string;
    countryCode?: string;
    label: string;
    detail: string;
    includes: string[];
}

export type TripWorkspaceDocumentSectionId = 'entry' | 'transport' | 'stays' | 'coverage';

export interface TripWorkspaceDocumentRecord {
    id: string;
    section: TripWorkspaceDocumentSectionId;
    countryCode?: string;
    cityId?: string;
    legLabel?: string;
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
    countryCode?: string;
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
    countryCode?: string;
    cityId: string;
    title: string;
    category: TripWorkspaceBudgetCategoryId;
    status: 'Locked' | 'Flexible' | 'Watch';
    amount: number;
    detail: string;
}

export type TripWorkspaceWeatherLensId = 'feel' | 'rain' | 'sea' | 'pack';

export interface TripWorkspaceWeatherStop {
    id: string;
    countryCode?: string;
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

export interface TripWorkspaceCountrySeasonCard {
    title: string;
    detail: string;
    tone: 'secondary' | 'outline';
}

export interface TripWorkspaceCountryGuide {
    code: string;
    name: string;
    summary: string;
    routeRole: string;
    freshness: string;
    sourceLine: string;
    bestTime: string;
    officialLinks: Array<{ label: string; href: string }>;
    facts: TripWorkspaceCountryFact[];
    safety: TripWorkspaceSafetySnapshot[];
    seasonCards: TripWorkspaceCountrySeasonCard[];
    languageName: string;
    languageCode: string;
    currencyCode: string;
    currencyName: string;
    cashRhythm: string;
    emergencyNumbers: Array<{ label: string; value: string; detail: string }>;
    routeCityIds?: string[];
    routeDayCount?: number;
    cityCount?: number;
}

export interface TripWorkspaceCountryProgress {
    code: string;
    name: string;
    cityCount: number;
    dayCount: number;
}

export interface TripWorkspaceBorderCrossing {
    id: string;
    fromCode: string;
    fromName: string;
    toCode: string;
    toName: string;
    fromCityId: string;
    toCityId: string;
    label: string;
    detail: string;
}

export interface TripWorkspaceRouteSummary {
    progression: TripWorkspaceCountryProgress[];
    borderCrossings: TripWorkspaceBorderCrossing[];
    nextBorderCrossing: TripWorkspaceBorderCrossing | null;
    countryCount: number;
    cityCount: number;
}

export interface TripWorkspaceDemoDataset {
    routeSummary: TripWorkspaceRouteSummary;
    countries: TripWorkspaceCountryGuide[];
    cities: TripWorkspaceCityGuide[];
    bookings: TripWorkspaceBookingRecord[];
    notes: TripWorkspaceNoteRecord[];
    photos: TripWorkspacePhotoRecord[];
    phrases: TripWorkspacePhraseCard[];
    travelKitChecklist: TripWorkspaceTravelKitChecklistItem[];
    travelKitUtilities: TripWorkspaceTravelKitUtility[];
    travelKitEmergencyCards: TripWorkspaceTravelKitEmergencyCard[];
    travelKitPacks: TripWorkspaceTravelKitPack[];
    documentRecords: TripWorkspaceDocumentRecord[];
    documentPackets: TripWorkspaceDocumentPacket[];
    budgetScenarios: TripWorkspaceBudgetScenario[];
    budgetLineItems: TripWorkspaceBudgetLineItem[];
    weatherStops: TripWorkspaceWeatherStop[];
    exploreLeads: TripWorkspaceExploreLead[];
}

const normalizeValue = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '');
const point = (x: number, y: number): TripWorkspaceMapPercentPoint => ({ x, y });

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

export const SEA_VIETNAM_LAOS_CITY_GUIDES: TripWorkspaceCityGuide[] = [
    {
        id: 'hcmc',
        title: 'Ho Chi Minh City',
        matchers: ['hochiminhcity', 'hochiminh', 'saigon', 'hcmc'],
        countryCode: 'VN',
        countryName: 'Vietnam',
        role: 'Fast urban entry point where street pace, coffee breaks, and district choice matter more than landmark count.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '3-4 nights',
        arrival: 'District 1 or 3 gives the easiest first stay if the route wants a clean city handoff.',
        transit: 'Walking plus Grab works best. Heat and crossings change what “close” feels like.',
        bestFor: ['Street-food energy', 'Museum + café city days', 'Strong Vietnam entry reset'],
        dayTrips: [
            { title: 'Cu Chi Tunnels', detail: 'A classic contrast day if you want history outside the city core.' },
            { title: 'Mekong Delta', detail: 'Worth it if the route wants a fuller contrast than another district walk.' },
        ],
        practicalNotes: ['Crossing the street is a rhythm skill.', 'Protect one cooler indoor break every afternoon.'],
        officialLinks: [
            createLink('Tan Son Nhat Airport', 'https://www.vietnamairport.vn/tansonnhatairport'),
            createLink('Vietnam Tourism', 'https://vietnam.travel'),
        ],
        neighborhoods: [
            createNeighborhood('District 1', 'Best first-entry base', 50, 52, 'lg'),
            createNeighborhood('District 3', 'Softer local-city balance', 63, 46, 'md'),
            createNeighborhood('Riverside edge', 'Best for skyline evenings', 38, 57, 'md'),
        ],
        highlights: ['District 1 / 3 walking loop', 'Coffee + museum split', 'Evening food crawl'],
        mapLayers: [
            createLayer(
                'arrival-core',
                'Arrival core',
                'Trip-specific',
                'The best first days stay tight around the easiest districts instead of scattering across the whole city.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['District 1', 'District 3'],
                ['District 1'],
                [point(63, 45), point(50, 52), point(39, 57)],
                { label: 'First-city arc', detail: 'Keep the first city days close, cool, and food-friendly.', position: point(53, 49) },
            ),
            createLayer(
                'food-drifts',
                'Food drifts',
                'General destination',
                'The city lands better when one night is reserved for eating through districts rather than over-scheduling sights.',
                'Updated this season',
                'General city context',
                ['District 1', 'Riverside edge'],
                ['District 3'],
                [point(51, 53), point(44, 58), point(36, 61)],
                { label: 'Night energy corridor', detail: 'Food, coffee, and skyline walks usually beat one more museum stop.', position: point(44, 58) },
            ),
        ],
        tripInsights: ['Trip-specific: this is the right place to regain urban rhythm before the central Vietnam leg.'],
        generalInsights: ['General destination: do less, but do it in the right district pair.'],
        savedStays: [
            createStay('District 1', 'Easy first stay', 'Best for a clean Vietnam arrival and strong walking access.', 50, 53),
            createStay('District 3', 'Calmer city base', 'Better if the stop should feel less tourist-dense.', 64, 46),
        ],
        events: [{ title: 'Evening café peak', detail: 'Night cafés and food runs are the easiest way to make the city feel fun, not just intense.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Humidity shapes energy more than dramatic weather swings do.',
            'HCMC is still workable in mixed weather if the route leans into indoor breaks and evening city time.',
            'Sudden rain mostly changes crossing comfort and ride timing.',
            'Best window: early morning to lunch for long walking plans.',
            'No sea risk; urban rain and heat are the main friction.',
            'The forecast mainly changes how dense the city day should be.',
            ['Breathable shirt', 'Mini umbrella', 'Portable fan or paper towel pack'],
            [
                createForecastDay('Tue', '34°', 'Humid sun', '20%'),
                createForecastDay('Wed', '33°', 'Cloud + bursts', '45%'),
                createForecastDay('Thu', '32°', 'Storm edge', '55%'),
                createForecastDay('Fri', '33°', 'Brighter afternoon', '30%'),
            ],
            [
                createSignal('Crossing comfort', 'Better before lunch', 'secondary'),
                createSignal('Rain spikes', 'Short but meaningful', 'outline'),
                createSignal('Night energy', 'Strong', 'secondary'),
            ],
        ),
    },
    {
        id: 'hoi-an',
        title: 'Hoi An',
        matchers: ['hoian', 'hoi'],
        countryCode: 'VN',
        countryName: 'Vietnam',
        role: 'Gentler central Vietnam stop where the route should slow down and get slightly more tactile.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '3-4 nights',
        arrival: 'Arrive via Da Nang, then keep the first Hoi An evening simple around the lantern-lit center.',
        transit: 'Bikes, short rides, and walking are enough if you stay near the old town or beach corridor.',
        bestFor: ['Tailor stops', 'Cooking classes', 'Soft evenings'],
        dayTrips: [
            { title: 'An Bang morning + old town night', detail: 'Good if the stop should feel breezy without becoming a beach-only break.' },
            { title: 'Cooking class', detail: 'Easy rainy-day or softer second-day anchor.' },
        ],
        practicalNotes: ['Tailor fittings reshape the timing of the whole stay.', 'Lantern-hour crowds are real, so protect a quieter morning rhythm.'],
        officialLinks: [
            createLink('Vietnam Tourism', 'https://vietnam.travel'),
        ],
        neighborhoods: [
            createNeighborhood('Old Town edge', 'Best lantern-night access', 49, 53, 'lg'),
            createNeighborhood('Cam Chau', 'Softer boutique balance', 63, 47, 'md'),
            createNeighborhood('An Bang corridor', 'Beach reset without losing Hoi An access', 31, 58, 'md'),
        ],
        highlights: ['Tailor fitting block', 'Cooking class', 'Lantern-lit river walk'],
        mapLayers: [
            createLayer(
                'tailor-flow',
                'Tailor flow',
                'Trip-specific',
                'Hoi An timing works best when fittings, pickups, and easy evening loops are treated as one system.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Old Town edge', 'Cam Chau'],
                ['Cam Chau'],
                [point(63, 46), point(54, 50), point(49, 53)],
                { label: 'Fitting arc', detail: 'The smartest stay keeps tailor logistics close to the old town night loop.', position: point(56, 49) },
            ),
            createLayer(
                'soft-beach',
                'Soft beach',
                'General destination',
                'The town improves when one day leans toward the beach and a slower evening, not just photo-hour density.',
                'Updated this season',
                'General city context',
                ['An Bang corridor', 'Old Town edge'],
                ['An Bang corridor'],
                [point(31, 58), point(40, 56), point(49, 53)],
                { label: 'Sea-breeze version', detail: 'A softer beach-plus-lantern split usually beats a fully packed old-town stay.', position: point(38, 57) },
            ),
        ],
        tripInsights: ['Trip-specific: Hoi An is where the route should exhale a little.'],
        generalInsights: ['General destination: lantern hours are lovely, but morning softness is the real quality marker.'],
        savedStays: [
            createStay('Cam Chau', 'Balanced base', 'Best if you want old town access without sleeping inside the busiest pocket.', 63, 47),
            createStay('An Bang corridor', 'Soft beach base', 'Best if the stop should feel wider and breezier.', 31, 58),
        ],
        events: [{ title: 'Lantern-hour compression', detail: 'Old town feels best if you accept one crowded hour and plan around it.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Central Vietnam shifts fast between sticky heat and short weather disruptions.',
            'Hoi An still feels good in mixed weather if the route has one indoor-soft fallback like tailoring or cooking.',
            'Heavy rain changes bike comfort and lantern-night ease quickly.',
            'Best window: morning for walks and bike loops, evening after heat fades.',
            'Beach payoff weakens first when rain or wind picks up.',
            'Forecast changes mostly decide whether the day leans beachy or town-heavy.',
            ['Small umbrella', 'Sandals that dry fast', 'Extra tote for tailor pickups'],
            [
                createForecastDay('Sat', '31°', 'Warm sun', '20%'),
                createForecastDay('Sun', '30°', 'Cloud + humidity', '35%'),
                createForecastDay('Mon', '29°', 'Heavy bursts', '60%'),
                createForecastDay('Tue', '30°', 'Recovering sun', '30%'),
            ],
            [
                createSignal('Beach payoff', 'Best in dry mornings', 'secondary'),
                createSignal('Bike comfort', 'Drops in rain', 'outline'),
                createSignal('Evening mood', 'Strong after heat fades', 'secondary'),
            ],
        ),
    },
    {
        id: 'hanoi',
        title: 'Hanoi',
        matchers: ['hanoi'],
        countryCode: 'VN',
        countryName: 'Vietnam',
        role: 'Dense northern capital where food, train timing, and old-quarter intensity create the route’s sharpest urban contrast.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '3-4 nights',
        arrival: 'Old Quarter is easiest for a short food-first stay, but French Quarter edges make arrivals calmer.',
        transit: 'Walking plus short rides. Noise and crossings mean district choice matters a lot.',
        bestFor: ['Street food', 'Northern route handoff', 'Dense city texture'],
        dayTrips: [
            { title: 'Ha Long Bay overnight', detail: 'Only worth it if the weather and route energy support a real two-day swing.' },
            { title: 'Train Street timing block', detail: 'A short novelty stop, not the whole reason to stay in Hanoi.' },
        ],
        practicalNotes: ['Give the city at least one unstructured food window.', 'Old Quarter density is the point, but not for every waking hour.'],
        officialLinks: [
            createLink('Noi Bai Airport', 'https://vietnamairport.vn/noibaiairport'),
            createLink('Vietnam Railways', 'https://dsvn.vn'),
        ],
        neighborhoods: [
            createNeighborhood('Old Quarter', 'Best for short high-texture stays', 46, 53, 'lg'),
            createNeighborhood('French Quarter edge', 'Calmer arrival base', 60, 47, 'md'),
            createNeighborhood('West Lake edge', 'Longer-stay softener', 32, 38, 'md'),
        ],
        highlights: ['Old Quarter food tour', 'Train Street timing slot', 'French Quarter dawn walk'],
        mapLayers: [
            createLayer(
                'old-quarter',
                'Old Quarter',
                'Trip-specific',
                'Hanoi works best when the route consciously limits how much of the stay happens in maximum density mode.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Old Quarter', 'French Quarter edge'],
                ['French Quarter edge'],
                [point(60, 46), point(52, 49), point(46, 53)],
                { label: 'Density control', detail: 'Sleep slightly calmer, then enter the core when you want full street energy.', position: point(54, 49) },
            ),
            createLayer(
                'food-arcs',
                'Food arcs',
                'General destination',
                'The best Hanoi version usually has one long food walk and one much quieter morning.',
                'Updated this season',
                'General city context',
                ['Old Quarter', 'West Lake edge'],
                ['Old Quarter'],
                [point(33, 39), point(39, 46), point(46, 53)],
                { label: 'Texture curve', detail: 'The city shines when the route alternates chaos and calm on purpose.', position: point(39, 45) },
            ),
        ],
        tripInsights: ['Trip-specific: this is the last big dense city before the quieter north loop.'],
        generalInsights: ['General destination: food and atmosphere do more work here than another landmark list.'],
        savedStays: [
            createStay('French Quarter edge', 'Calmer city base', 'Best if you want easier arrivals and one strong Old Quarter walk each day.', 60, 47),
            createStay('Old Quarter', 'Maximum texture', 'Best if short-stay energy matters more than quiet sleep.', 46, 53),
        ],
        events: [{ title: 'Food-tour sweet spot', detail: 'Hanoi opens up most after dark, once the heat drops and the streets stay alive.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Northern weather adds more variation here than in HCMC, which is part of the city’s texture.',
            'Hanoi feels sharp and lively in mixed weather as long as the route gives it one softer café or museum block.',
            'Rain increases crossing stress and weakens long food-walk plans.',
            'Best window: dawn to late morning for longer walks, after dark for food runs.',
            'No sea risk inside the city, but Ha Long side-trip quality changes with forecast quickly.',
            'Weather here changes both city walking comfort and the viability of side trips.',
            ['Light layer for cooler mornings', 'Mini umbrella', 'Shoes that handle slick sidewalks'],
            [
                createForecastDay('Tue', '28°', 'Soft sun', '20%'),
                createForecastDay('Wed', '27°', 'Cloud + mist', '35%'),
                createForecastDay('Thu', '26°', 'Rain pockets', '55%'),
                createForecastDay('Fri', '27°', 'Brighter afternoon', '30%'),
            ],
            [
                createSignal('Walk comfort', 'Good in the morning', 'secondary'),
                createSignal('Ha Long odds', 'Watch the rain day', 'outline'),
                createSignal('Night food energy', 'Excellent', 'secondary'),
            ],
        ),
    },
    {
        id: 'ninh-binh',
        title: 'Ninh Binh',
        matchers: ['ninhbinh', 'tamcoc'],
        countryCode: 'VN',
        countryName: 'Vietnam',
        role: 'The soft scenic pause in north Vietnam where river landscapes do the work.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '2-3 nights',
        arrival: 'Tam Coc is the easiest base if the route wants short bike loops and quick restaurant access.',
        transit: 'Bikes, boats, and short rides. Very little reason to overcomplicate it.',
        bestFor: ['Boat scenery', 'Bike loops', 'North Vietnam decompression'],
        dayTrips: [{ title: 'Trang An route', detail: 'The cleanest signature activity if weather stays cooperative.' }],
        practicalNotes: ['Start scenic outings early.', 'This stop works best as a breath, not as another fast checklist.'],
        officialLinks: [
            createLink('Vietnam Tourism', 'https://vietnam.travel'),
        ],
        neighborhoods: [
            createNeighborhood('Tam Coc core', 'Best easy scenic base', 49, 54, 'lg'),
            createNeighborhood('Trang An edge', 'Closer to boat routes and quieter nights', 63, 43, 'md'),
        ],
        highlights: ['Trang An boat route', 'Pagoda or viewpoint morning', 'Sunset rice-field bike ride'],
        mapLayers: [
            createLayer(
                'boat-day',
                'Boat day',
                'Trip-specific',
                'The stop is strongest when the boat route and one easy bike block form the whole day.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Tam Coc core', 'Trang An edge'],
                ['Tam Coc core'],
                [point(63, 43), point(56, 48), point(49, 54)],
                { label: 'Scenic core', detail: 'Keep the stay simple so the scenery does the work.', position: point(55, 48) },
            ),
            createLayer(
                'quiet-reset',
                'Quiet reset',
                'General destination',
                'Ninh Binh usually pays off more when it slows the route down instead of trying to compete with Hanoi.',
                'Updated this season',
                'General city context',
                ['Tam Coc core'],
                ['Trang An edge'],
                [point(49, 54), point(40, 61)],
                { label: 'Recovery mode', detail: 'The stop is about breathing room and scenery, not density.', position: point(43, 59) },
            ),
        ],
        tripInsights: ['Trip-specific: this stop protects route energy before Sapa.'],
        generalInsights: ['General destination: over-planning weakens the point of being here.'],
        savedStays: [
            createStay('Tam Coc core', 'Easy scenic base', 'Best if you want simple access and soft evenings.', 49, 54),
        ],
        events: [{ title: 'Sunset bike hour', detail: 'Golden hour is the clearest mood-maker of the whole stop.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Weather mainly changes scenic clarity and whether the bike loops still feel dreamy.',
            'Ninh Binh can handle light cloud, but downpours quickly flatten the scenic version of the day.',
            'Rain affects boats, bikes, and viewpoints together.',
            'Best window: dawn to late morning for boats and viewpoints.',
            'No sea risk, but rain affects the same kind of scenic payoff.',
            'Forecast changes directly alter the postcard value of the stop.',
            ['Light rain shell', 'Dry phone pouch', 'Second pair of socks'],
            [
                createForecastDay('Sat', '29°', 'Soft sun', '15%'),
                createForecastDay('Sun', '28°', 'Cloud relief', '25%'),
                createForecastDay('Mon', '27°', 'Rain pockets', '50%'),
                createForecastDay('Tue', '28°', 'Bright return', '20%'),
            ],
            [
                createSignal('Scenic clarity', 'Good in the morning', 'secondary'),
                createSignal('Bike comfort', 'Drops fast in rain', 'outline'),
                createSignal('Boat payoff', 'Strong when dry', 'secondary'),
            ],
        ),
    },
    {
        id: 'sapa',
        title: 'Sapa',
        matchers: ['sapa'],
        countryCode: 'VN',
        countryName: 'Vietnam',
        role: 'Cooler mountain leg where altitude, mist, and trekking rhythm change the route completely.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '2-3 nights',
        arrival: 'Arrivals often feel slower than expected after the overnight transfer, so build in one gentle first block.',
        transit: 'Short rides and walking. Terrain matters more than distance.',
        bestFor: ['Mountain contrast', 'Trek day', 'Cool-air reset'],
        dayTrips: [{ title: 'Village trek', detail: 'The core Sapa day, as long as mist and route energy cooperate.' }],
        practicalNotes: ['Treat the first day as partial.', 'Mountain weather wins every argument eventually.'],
        officialLinks: [
            createLink('Vietnam Tourism', 'https://vietnam.travel'),
        ],
        neighborhoods: [
            createNeighborhood('Town center', 'Easiest if transfer fatigue is high', 49, 50, 'lg'),
            createNeighborhood('Valley edge', 'Better views, slightly more weather exposure', 64, 58, 'md'),
        ],
        highlights: ['Trek day', 'Mist-break viewpoint', 'Warm dinner after the hills'],
        mapLayers: [
            createLayer(
                'trek-ready',
                'Trek ready',
                'Trip-specific',
                'Sapa works when the route protects one real trek window instead of trying to force scenery every hour.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Town center', 'Valley edge'],
                ['Town center'],
                [point(50, 50), point(57, 54), point(64, 58)],
                { label: 'Trek weather hinge', detail: 'The whole stop should orbit the clearest walking window.', position: point(58, 53) },
            ),
            createLayer(
                'mist-days',
                'Mist days',
                'General destination',
                'Sapa can still work beautifully in mist if the route accepts a moodier version of the mountains.',
                'Updated this season',
                'General city context',
                ['Town center'],
                ['Town center'],
                [point(46, 49), point(38, 45)],
                { label: 'Low-visibility mode', detail: 'When views disappear, comfort and warmth should take over the plan.', position: point(41, 45) },
            ),
        ],
        tripInsights: ['Trip-specific: this stop should feel different enough to justify the overnight transfer.'],
        generalInsights: ['General destination: scenery payoff is real, but not on command.'],
        savedStays: [
            createStay('Town center', 'Transfer-friendly base', 'Best if the route wants easier first and last hours.', 50, 50),
        ],
        events: [{ title: 'Mist-window volatility', detail: 'Views can go from flat to stunning in a short stretch.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Cooler, wetter, and much less predictable than the rest of the Vietnam leg.',
            'Sapa is where weather genuinely decides what the day is.',
            'Mist, rain, and slippery trails reshape everything quickly.',
            'Best window: early morning if the clouds lift.',
            'No sea risk; mountain visibility is the core risk and reward.',
            'Forecast here directly changes whether the stop feels spectacular or simply calm.',
            ['Light fleece', 'Waterproof shell', 'Dry socks'],
            [
                createForecastDay('Tue', '19°', 'Cloud breaks', '30%'),
                createForecastDay('Wed', '18°', 'Mist + drizzle', '55%'),
                createForecastDay('Thu', '17°', 'Heavy rain edge', '70%'),
                createForecastDay('Fri', '19°', 'Clearer morning', '25%'),
            ],
            [
                createSignal('Trail confidence', 'Mixed this week', 'outline'),
                createSignal('View odds', 'Best at sunrise', 'secondary'),
                createSignal('Layer need', 'Real', 'secondary'),
            ],
        ),
    },
    {
        id: 'vang-vieng',
        title: 'Vang Vieng',
        matchers: ['vangvieng', 'vang'],
        countryCode: 'LA',
        countryName: 'Laos',
        role: 'Scenic adventure pocket where the route can choose playful or calm without leaving town.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '2-3 nights',
        arrival: 'Stay near the center if you want to keep tubing, cafés, and transfers easy.',
        transit: 'Bikes, tuk-tuks, and short rides. Town scale is friendly once you arrive.',
        bestFor: ['River-day fun', 'Karst scenery', 'Adventure without a huge logistics load'],
        dayTrips: [{ title: 'Blue lagoon or cave loop', detail: 'Good if the route wants one active day besides tubing.' }],
        practicalNotes: ['Decide early if this stop is playful or restorative.', 'Sun and hydration matter more than people admit on tubing days.'],
        officialLinks: [
            createLink('Laos Tourism', 'https://tourismlaos.org'),
        ],
        neighborhoods: [
            createNeighborhood('Central Vang Vieng', 'Best all-round base', 50, 53, 'lg'),
            createNeighborhood('River edge', 'Better scenery, softer mornings', 35, 57, 'md'),
        ],
        highlights: ['Nam Song tubing', 'Karst sunrise', 'Cafe + river reset'],
        mapLayers: [
            createLayer(
                'play-day',
                'Play day',
                'Trip-specific',
                'The stop works best when one main active day is enough and the rest of the time stays easy.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Central Vang Vieng', 'River edge'],
                ['Central Vang Vieng'],
                [point(50, 53), point(43, 55), point(35, 57)],
                { label: 'One-big-day model', detail: 'Let the scenery and one river day define the stop.', position: point(44, 55) },
            ),
            createLayer(
                'quiet-karst',
                'Quiet karst',
                'General destination',
                'Vang Vieng can be scenic and calm if the route avoids treating every day like an activity challenge.',
                'Updated this season',
                'General city context',
                ['River edge'],
                ['River edge'],
                [point(34, 57), point(27, 51)],
                { label: 'Softer version', detail: 'The route often benefits more from scenery and slack than from more intensity.', position: point(28, 52) },
            ),
        ],
        tripInsights: ['Trip-specific: choose one strong activity day, then let the rest breathe.'],
        generalInsights: ['General destination: karst scenery is the big asset, not just the tubing clichés.'],
        savedStays: [
            createStay('Central Vang Vieng', 'Easy base', 'Best if you want adventure access without transport fuss.', 50, 53),
            createStay('River edge', 'Scenic slower base', 'Better if calm mornings matter more.', 35, 57),
        ],
        events: [{ title: 'Sunset mountain glow', detail: 'Evenings do a lot of the emotional work here.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Warm and scenic, with storm timing mostly affecting outdoor-play confidence.',
            'Vang Vieng stays enjoyable if the route keeps the active day flexible.',
            'Rain changes tubing, cave loops, and bike roads quickly.',
            'Best window: morning through early afternoon for adventure-heavy ideas.',
            'No sea risk; river and outdoor confidence are the comparable lever.',
            'Weather changes whether the stop leans adventurous or simply scenic.',
            ['Waterproof phone pouch', 'Quick-dry clothes', 'Sun cover'],
            [
                createForecastDay('Sat', '30°', 'Bright start', '20%'),
                createForecastDay('Sun', '31°', 'Humid sun', '25%'),
                createForecastDay('Mon', '29°', 'Storm edge', '55%'),
                createForecastDay('Tue', '30°', 'Cloud breaks', '30%'),
            ],
            [
                createSignal('Tubing confidence', 'Best before rain builds', 'secondary'),
                createSignal('Road comfort', 'Watch storm days', 'outline'),
                createSignal('Scenery payoff', 'High', 'secondary'),
            ],
        ),
    },
    {
        id: 'luang-prabang',
        title: 'Luang Prabang',
        matchers: ['luangprabang', 'luang'],
        countryCode: 'LA',
        countryName: 'Laos',
        role: 'Gentle river city where the route should become quieter, softer, and a little more reflective.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '3-4 nights',
        arrival: 'Stay near the peninsula or morning-market edge if you want the stop to feel walkable and light.',
        transit: 'Walking plus short rides. The city should feel pleasantly small after Hanoi and the trains.',
        bestFor: ['Soft river mornings', 'Temple and market rhythm', 'Low-pressure finale before Thailand'],
        dayTrips: [{ title: 'Kuang Si day', detail: 'The signature outing if the route wants one clear scenic day.' }],
        practicalNotes: ['Protect a slow morning here.', 'This city is where the route should stop hurrying.'],
        officialLinks: [
            createLink('Luang Prabang Airport', 'https://www.luangprabangairport.com'),
            createLink('Laos Tourism', 'https://tourismlaos.org'),
        ],
        neighborhoods: [
            createNeighborhood('Peninsula core', 'Best walkable old-town stay', 47, 49, 'lg'),
            createNeighborhood('Morning market edge', 'Easier quiet boutique base', 59, 57, 'md'),
            createNeighborhood('Mekong side', 'Best sunset mood', 34, 58, 'md'),
        ],
        highlights: ['Kuang Si day', 'Alms-route early walk', 'Mekong sunset'],
        mapLayers: [
            createLayer(
                'slow-rhythm',
                'Slow rhythm',
                'Trip-specific',
                'Luang Prabang should feel intentionally slower than the entire Vietnam section before it.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Peninsula core', 'Morning market edge'],
                ['Peninsula core'],
                [point(59, 57), point(52, 53), point(47, 49)],
                { label: 'Quiet-center arc', detail: 'Keep the stay walkable so the city can do its calm work.', position: point(52, 53) },
            ),
            createLayer(
                'sunset-mekong',
                'Sunset Mekong',
                'General destination',
                'One of the best versions of the city ends with a river sunset instead of another errand or transfer scramble.',
                'Updated this season',
                'General city context',
                ['Mekong side', 'Peninsula core'],
                ['Mekong side'],
                [point(47, 49), point(40, 54), point(34, 58)],
                { label: 'Evening release', detail: 'The city’s mood settles in most clearly at the river edge.', position: point(39, 55) },
            ),
        ],
        tripInsights: ['Trip-specific: this is where the route should feel resolved again before Thailand.'],
        generalInsights: ['General destination: the city pays off through mood and pace, not density.'],
        savedStays: [
            createStay('Peninsula core', 'Walkable classic base', 'Best for an easy old-town flow.', 47, 49),
            createStay('Mekong side', 'Sunset-first base', 'Better if evening calm matters most.', 34, 58),
        ],
        events: [{ title: 'Morning-market calm', detail: 'Early mornings are the city’s clearest identity moment.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Warm and mostly gentle, with weather shifting outing comfort more than city identity.',
            'Luang Prabang stays pleasant in mixed weather as long as the route lets it remain slow.',
            'Rain mostly changes waterfall and walking comfort, not the city’s basic charm.',
            'Best window: early morning for markets and riverside walks.',
            'No sea risk; scenic side-trip quality changes first.',
            'Forecast here mostly changes how scenic the day trips feel.',
            ['Light rain layer', 'Temple-ready layer', 'Reusable water bottle'],
            [
                createForecastDay('Tue', '29°', 'Soft sun', '20%'),
                createForecastDay('Wed', '30°', 'Humid cloud', '30%'),
                createForecastDay('Thu', '29°', 'Rain break', '45%'),
                createForecastDay('Fri', '30°', 'Brighter sunset', '25%'),
            ],
            [
                createSignal('Walk comfort', 'Good in the morning', 'secondary'),
                createSignal('Waterfall odds', 'Watch rain days', 'outline'),
                createSignal('Sunset quality', 'Strong this week', 'secondary'),
            ],
        ),
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
            { name: 'Sathorn', fit: 'Arrival-friendly and polished stays', mapPosition: point(49, 60), mapRadius: 'lg' },
            { name: 'Ari', fit: 'Cafe mornings and calmer rhythm', mapPosition: point(69, 34), mapRadius: 'md' },
            { name: 'Talat Noi', fit: 'Texture, galleries, and riverside walks', mapPosition: point(38, 48), mapRadius: 'md' },
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
                focusPath: [point(78, 22), point(61, 41), point(49, 60)],
                callout: {
                    label: 'Arrival hinge',
                    detail: 'Airport handoff, first-night base, then an easy BTS reach on day one.',
                    position: point(63, 43),
                },
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
                focusPath: [point(33, 49), point(48, 43), point(69, 34)],
                callout: {
                    label: 'Late food drift',
                    detail: 'Best when the route wants markets, river texture, and a softer café morning after.',
                    position: point(50, 40),
                },
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
            { area: 'Sathorn', vibe: 'Polished base', reason: 'Easiest handoff from airport to hotel to first dinner.', mapPosition: point(50, 64) },
            { area: 'Ari', vibe: 'Soft urban reset', reason: 'Better if the trip wants design cafés over nightlife.', mapPosition: point(71, 31) },
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
            { name: 'Old City', fit: 'Best first-timer orientation', mapPosition: point(48, 49), mapRadius: 'lg' },
            { name: 'Nimman', fit: 'Cafe density and softer work blocks', mapPosition: point(33, 35), mapRadius: 'md' },
            { name: 'Riverside', fit: 'Slower evenings and calmer stays', mapPosition: point(67, 56), mapRadius: 'md' },
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
                focusPath: [point(36, 32), point(48, 47), point(67, 55)],
                callout: {
                    label: 'First two days',
                    detail: 'Temple loop first, river dinner second, then an easy airport return.',
                    position: point(55, 46),
                },
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
                focusPath: [point(28, 34), point(42, 43), point(64, 54)],
                callout: {
                    label: 'Slow-work arc',
                    detail: 'Nimman mornings land best when they taper into a calmer riverside evening.',
                    position: point(38, 39),
                },
            },
        ],
        tripInsights: [
            'Trip-specific: keep one unscheduled afternoon for slower café recovery.',
        ],
        generalInsights: [
            'General destination: haze and rain season layers should become live later.',
        ],
        savedStays: [
            { area: 'Old City', vibe: 'Easy orientation', reason: 'Best for a short first Chiang Mai stop.', mapPosition: point(49, 51) },
            { area: 'Nimman', vibe: 'Design-heavy and social', reason: 'Stronger if cafés and shops matter more.', mapPosition: point(30, 33) },
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
            { name: 'Walking Street core', fit: 'Easy without a scooter', mapPosition: point(48, 53), mapRadius: 'lg' },
            { name: 'Riverside edge', fit: 'Quieter sleep and slower mornings', mapPosition: point(67, 45), mapRadius: 'md' },
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
                focusPath: [point(45, 56), point(53, 50)],
                callout: {
                    label: 'Low-friction base',
                    detail: 'Keep the stop close enough that no extra transport is required once you arrive.',
                    position: point(52, 47),
                },
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
                focusPath: [point(49, 53), point(63, 46), point(72, 43)],
                callout: {
                    label: 'Morning reset',
                    detail: 'Trade late-night spill for the calmer river-edge version of Pai.',
                    position: point(66, 39),
                },
            },
        ],
        tripInsights: [
            'Trip-specific: Pai works best as a breath, not as a productivity sprint.',
        ],
        generalInsights: [
            'General destination: roads and rain matter more than distance.',
        ],
        savedStays: [
            { area: 'Central Pai', vibe: 'Low-friction base', reason: 'Keeps the stop easy without extra transport.', mapPosition: point(50, 54) },
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
            { name: 'Old Town', fit: 'Culture and food over beach resort mode', mapPosition: point(48, 56), mapRadius: 'md' },
            { name: 'Kata', fit: 'Balanced beach stay', mapPosition: point(62, 72), mapRadius: 'lg' },
            { name: 'Mai Khao', fit: 'Quiet reset close to the airport', mapPosition: point(36, 19), mapRadius: 'md' },
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
                focusPath: [point(35, 22), point(48, 45), point(61, 71)],
                callout: {
                    label: 'Logistics hinge',
                    detail: 'The airport-to-beach handoff matters more here than trying to sample the whole island.',
                    position: point(49, 42),
                },
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
                focusPath: [point(34, 20), point(42, 37), point(48, 55)],
                callout: {
                    label: 'Quieter island mood',
                    detail: 'The gentler Phuket version pairs calmer beaches with one Old Town evening instead of strip energy.',
                    position: point(42, 35),
                },
            },
        ],
        tripInsights: [
            'Trip-specific: use Phuket as the logistics hinge, not necessarily the best atmosphere stay.',
        ],
        generalInsights: [],
        savedStays: [
            { area: 'Kata', vibe: 'Balanced beach base', reason: 'Easier mix of calm beach and restaurant access.', mapPosition: point(64, 75) },
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
            { name: 'Tonsai edge', fit: 'Easy access with less late-night spillover', mapPosition: point(49, 48), mapRadius: 'md' },
            { name: 'Long Beach', fit: 'Quieter sleep and scenic mornings', mapPosition: point(69, 63), mapRadius: 'lg' },
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
                focusPath: [point(47, 46), point(58, 53), point(68, 62)],
                callout: {
                    label: 'Pier day buffer',
                    detail: 'First and last nights should minimize wet-bag, pier, and ferry friction.',
                    position: point(57, 50),
                },
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
                focusPath: [point(54, 51), point(63, 57), point(70, 62)],
                callout: {
                    label: 'Calmer postcard mood',
                    detail: 'Shift away from the core and the island starts feeling scenic instead of crowded.',
                    position: point(65, 58),
                },
            },
        ],
        tripInsights: [
            'Trip-specific: keep one flexible island day for rough water or tour changes.',
        ],
        generalInsights: [],
        savedStays: [
            { area: 'Long Beach', vibe: 'Calmer postcard base', reason: 'Better if the trip wants atmosphere over party spill.', mapPosition: point(71, 64) },
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
            { name: 'Ao Nang', fit: 'Easiest logistics and day-trip base', mapPosition: point(55, 56), mapRadius: 'lg' },
            { name: 'Railay', fit: 'Best scenery and atmosphere', mapPosition: point(66, 49), mapRadius: 'md' },
            { name: 'Koh Lanta', fit: 'Best slower island reset', mapPosition: point(30, 76), mapRadius: 'lg' },
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
                focusPath: [point(50, 58), point(58, 53), point(66, 49)],
                callout: {
                    label: 'Boat timing core',
                    detail: 'This layer makes it obvious where transfer ease wins over the prettiest base.',
                    position: point(58, 51),
                },
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
                focusPath: [point(33, 73), point(44, 64), point(66, 49)],
                callout: {
                    label: 'Scenery + recovery',
                    detail: 'The coast gets softer when you bias toward calm beaches and fewer daily transfers.',
                    position: point(43, 66),
                },
            },
        ],
        tripInsights: [
            'Trip-specific: this is the main booking-decision page because scenery and logistics pull in different directions.',
        ],
        generalInsights: [],
        savedStays: [
            { area: 'Ao Nang', vibe: 'Planner-friendly', reason: 'Best if the trip values easy boat and transfer control.', mapPosition: point(53, 59) },
            { area: 'Railay', vibe: 'Signature scenery', reason: 'Best if the coast leg should feel unforgettable first.', mapPosition: point(69, 47) },
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

const DAY_MILLISECONDS = 1000 * 60 * 60 * 24;

function createLink(label: string, href: string) {
    return { label, href };
}

function createSeasonCard(
    title: string,
    detail: string,
    tone: TripWorkspaceCountrySeasonCard['tone'],
): TripWorkspaceCountrySeasonCard {
    return { title, detail, tone };
}

function createForecastDay(
    label: string,
    tempC: string,
    condition: string,
    rainChance: string,
): TripWorkspaceWeatherForecastDay {
    return { label, tempC, condition, rainChance };
}

function createSignal(
    label: string,
    value: string,
    tone: TripWorkspaceWeatherSignal['tone'],
): TripWorkspaceWeatherSignal {
    return { label, value, tone };
}

function createNeighborhood(
    name: string,
    fit: string,
    x: number,
    y: number,
    mapRadius: TripWorkspaceCityNeighborhood['mapRadius'],
): TripWorkspaceCityNeighborhood {
    return {
        name,
        fit,
        mapPosition: point(x, y),
        mapRadius,
    };
}

function createStay(
    area: string,
    vibe: string,
    reason: string,
    x: number,
    y: number,
): TripWorkspaceCityStay {
    return {
        area,
        vibe,
        reason,
        mapPosition: point(x, y),
    };
}

function createLayer(
    id: string,
    label: string,
    scope: TripWorkspaceCityMapLayer['scope'],
    detail: string,
    freshness: string,
    sourceLine: string,
    neighborhoodNames: string[],
    stayAreas: string[],
    focusPath: TripWorkspaceMapPercentPoint[],
    callout: TripWorkspaceCityMapLayer['callout'],
): TripWorkspaceCityMapLayer {
    return {
        id,
        label,
        scope,
        detail,
        freshness,
        sourceLine,
        neighborhoodNames,
        stayAreas,
        focusPath,
        callout,
    };
}

function createWeatherProfile(
    updateLine: string,
    headline: string,
    travelFeel: string,
    caution: string,
    activityWindow: string,
    seaNote: string,
    routeImpact: string,
    packNotes: string[],
    forecast: TripWorkspaceWeatherForecastDay[],
    signals: TripWorkspaceWeatherSignal[],
): TripWorkspaceCityWeatherProfile {
    return {
        updateLine,
        headline,
        travelFeel,
        caution,
        activityWindow,
        seaNote,
        routeImpact,
        packNotes,
        forecast,
        signals,
    };
}

const COUNTRY_GUIDE_REGISTRY: TripWorkspaceCountryGuide[] = [
    {
        code: 'TH',
        name: 'Thailand',
        summary: 'Warm arrival energy, strong infrastructure in the north, and weather-sensitive coast decisions in the south.',
        routeRole: 'The route opens and closes here, so Thailand holds the arrival reset and the re-entry landing.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        bestTime: 'November to February for the broadest route comfort',
        officialLinks: [
            createLink('Thailand Immigration', 'https://www.immigration.go.th'),
            createLink('Tourism Authority', 'https://www.tourismthailand.org'),
        ],
        facts: THAILAND_COUNTRY_FACTS,
        safety: THAILAND_SAFETY_SNAPSHOTS,
        seasonCards: [
            createSeasonCard('Cool-season sweet spot', 'November to February gives the easiest mix of city comfort and coast reliability.', 'secondary'),
            createSeasonCard('Shoulder-season tradeoff', 'March and October still work, but heat or storm edges start changing pace.', 'outline'),
            createSeasonCard('Monsoon pressure', 'Southern boat legs become the first major route risk once weather swings harder.', 'outline'),
        ],
        languageName: 'Thai',
        languageCode: 'th',
        currencyCode: 'THB',
        currencyName: 'Thai baht',
        cashRhythm: 'Cards in major cities, cash still useful for boats, markets, and smaller guesthouses.',
        emergencyNumbers: [
            { label: 'Tourist Police', value: '1155', detail: 'Fastest English-speaking bridge for traveler support.' },
            { label: 'Medical emergency', value: '1669', detail: 'National medical emergency line.' },
        ],
    },
    {
        code: 'KH',
        name: 'Cambodia',
        summary: 'Temple-heavy arrival moments, moving border days, and a softer coastal inland rhythm around Kampot.',
        routeRole: 'Cambodia is the first border-crossing test in the route and shifts the trip from arrival mode into overland backpacking mode.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        bestTime: 'November to February for drier temple and overland days',
        officialLinks: [
            createLink('Cambodia eVisa', 'https://www.evisa.gov.kh'),
            createLink('Tourism Cambodia', 'https://www.tourismcambodia.com'),
        ],
        facts: [
            {
                label: 'Visa basics',
                value: 'Many passports can use eVisa or visa on arrival, but overland border handling still deserves a live check.',
                badge: 'General destination',
                freshness: 'Updated weekly',
                sourceLine: 'Official visa source',
                link: createLink('Cambodia eVisa', 'https://www.evisa.gov.kh'),
            },
            {
                label: 'Sockets & voltage',
                value: 'Type A, C and G • 230V. A universal adapter keeps city hotels and quieter guesthouses covered.',
                badge: 'Practical',
                freshness: 'Stable',
                sourceLine: 'Evergreen travel prep',
            },
            {
                label: 'Money and payments',
                value: 'USD still shows up constantly alongside riel. Cash matters more than card confidence outside polished hotels.',
                badge: 'Practical',
                freshness: 'Updated weekly',
                sourceLine: 'Route payment note',
            },
            {
                label: 'Driving side',
                value: 'Right-hand traffic. Road confidence varies more than the rule itself.',
                badge: 'Practical',
                freshness: 'Stable',
                sourceLine: 'Transport rule of thumb',
            },
            {
                label: 'Connectivity',
                value: 'Siem Reap and Phnom Penh are easy; slower bus and border days are where offline prep starts paying off.',
                badge: 'Trip-ready',
                freshness: 'Updated this season',
                sourceLine: 'Carrier + traveler summary',
            },
            {
                label: 'Cultural context',
                value: 'Temple respect, genocide-site sensitivity, and slower service rhythm matter more than memorizing every etiquette rule.',
                badge: 'Context',
                freshness: 'Stable',
                sourceLine: 'General destination context',
            },
        ],
        safety: [
            { label: 'LGBTQIA+ comfort', score: 'Usually workable in traveler hubs', detail: 'Siem Reap reads easier than rural transit stretches.', tone: 'secondary' },
            { label: 'Solo women at night', score: 'Mixed by block and hour', detail: 'Stay more deliberate around bus arrivals and quieter riversides.', tone: 'outline' },
            { label: 'Petty crime', score: 'Medium in busy visitor zones', detail: 'Bag awareness and transport bargaining matter more than high-alert fear.', tone: 'outline' },
            { label: 'Transport safety', score: 'Watch road quality and night transfers', detail: 'Overland comfort changes fast once the day runs late.', tone: 'secondary' },
        ],
        seasonCards: [
            createSeasonCard('Dry-season momentum', 'Temple circuits and bus days feel easiest in the cooler dry window.', 'secondary'),
            createSeasonCard('Hot-season fatigue', 'Heat turns Angkor and intercity transfers into much more physical days.', 'outline'),
            createSeasonCard('Rain-season softness', 'The country stays lush and beautiful, but road and sunset plans get less reliable.', 'outline'),
        ],
        languageName: 'Khmer',
        languageCode: 'km',
        currencyCode: 'KHR',
        currencyName: 'Cambodian riel',
        cashRhythm: 'Carry small USD and riel notes; card coverage is still selective outside stronger hotels and restaurants.',
        emergencyNumbers: [
            { label: 'Police', value: '117', detail: 'National police emergency line.' },
            { label: 'Ambulance', value: '119', detail: 'Medical emergency support line.' },
        ],
    },
    {
        code: 'VN',
        name: 'Vietnam',
        summary: 'Dense city energy, stronger rail structure, and huge north-south range in weather, pace, and packing needs.',
        routeRole: 'Vietnam is the longest section of the SEA route, so it holds the biggest rhythm reset between cities and climates.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        bestTime: 'Split by region, but spring and autumn usually give the broadest north-to-south comfort',
        officialLinks: [
            createLink('Vietnam eVisa', 'https://evisa.gov.vn'),
            createLink('Vietnam Tourism', 'https://vietnam.travel'),
        ],
        facts: [
            {
                label: 'Visa basics',
                value: 'Vietnam eVisa rules are straightforward for many passports, but entry dates and border point details matter.',
                badge: 'General destination',
                freshness: 'Updated weekly',
                sourceLine: 'Official eVisa source',
                link: createLink('Vietnam eVisa', 'https://evisa.gov.vn'),
            },
            {
                label: 'Sockets & voltage',
                value: 'Type A, C and F • 220V. Most travelers are fine with one universal adapter.',
                badge: 'Practical',
                freshness: 'Stable',
                sourceLine: 'Evergreen travel prep',
            },
            {
                label: 'Money and payments',
                value: 'Cards are easy in larger city venues, but local transport, markets, and smaller stays still lean cash.',
                badge: 'Practical',
                freshness: 'Updated weekly',
                sourceLine: 'Route payment note',
            },
            {
                label: 'Driving side',
                value: 'Right-hand traffic. Scooter density changes how “simple” road moves feel in practice.',
                badge: 'Practical',
                freshness: 'Stable',
                sourceLine: 'Transport rule of thumb',
            },
            {
                label: 'Connectivity',
                value: 'Strong in Ho Chi Minh City, Hanoi, and Hoi An. Hill and train days deserve screenshots and offline backups.',
                badge: 'Trip-ready',
                freshness: 'Updated this season',
                sourceLine: 'Carrier + traveler summary',
            },
            {
                label: 'Cultural context',
                value: 'Street pace is fast, temple spaces are calmer, and the route feels better when you treat crossing the street as a rhythm skill.',
                badge: 'Context',
                freshness: 'Stable',
                sourceLine: 'General destination context',
            },
        ],
        safety: [
            { label: 'LGBTQIA+ comfort', score: 'Generally workable in major cities', detail: 'Larger cities and tourist corridors tend to feel easier than rural overnight transfers.', tone: 'secondary' },
            { label: 'Solo women at night', score: 'Mixed by district and transport mode', detail: 'Busy central districts feel easier than late bus and train edges.', tone: 'outline' },
            { label: 'Petty crime', score: 'Medium in dense urban hubs', detail: 'Phones, bags, and scooter snatch risk deserve normal city awareness.', tone: 'outline' },
            { label: 'Transport safety', score: 'Crowded roads and long transfer days matter most', detail: 'The biggest stress comes from tempo, not from one dramatic risk source.', tone: 'secondary' },
        ],
        seasonCards: [
            createSeasonCard('South vs north split', 'One route can move from humid southern heat to cool mountain layers in the same trip.', 'secondary'),
            createSeasonCard('Rain timing matters', 'Short heavy bursts change city walking plans more than they kill the whole day.', 'outline'),
            createSeasonCard('Mountain exceptions', 'Sapa and the north need a separate pack and weather mindset from Ho Chi Minh City.', 'outline'),
        ],
        languageName: 'Vietnamese',
        languageCode: 'vi',
        currencyCode: 'VND',
        currencyName: 'Vietnamese dong',
        cashRhythm: 'Cards help in polished city venues, but cash still smooths street food, trains, and smaller operators.',
        emergencyNumbers: [
            { label: 'Police', value: '113', detail: 'National police emergency line.' },
            { label: 'Ambulance', value: '115', detail: 'National medical emergency line.' },
        ],
    },
    {
        code: 'LA',
        name: 'Laos',
        summary: 'The route softens here: slower river cities, mountain transfer tradeoffs, and calmer support needs with fewer backup layers.',
        routeRole: 'Laos is the decompression leg, where the trip trades density for slower mornings and scenic transfer days.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        bestTime: 'November to February for cooler river and mountain comfort',
        officialLinks: [
            createLink('Lao eVisa', 'https://laoevisa.gov.la'),
            createLink('Laos Tourism', 'https://tourismlaos.org'),
        ],
        facts: [
            {
                label: 'Visa basics',
                value: 'Many travelers can use eVisa or visa on arrival, but border-point eligibility still matters.',
                badge: 'General destination',
                freshness: 'Updated weekly',
                sourceLine: 'Official visa source',
                link: createLink('Lao eVisa', 'https://laoevisa.gov.la'),
            },
            {
                label: 'Sockets & voltage',
                value: 'Type A, B, C, E and F • 230V. Universal adapters are still the easiest move.',
                badge: 'Practical',
                freshness: 'Stable',
                sourceLine: 'Evergreen travel prep',
            },
            {
                label: 'Money and payments',
                value: 'Cash matters more here. Keep ATM timing and small notes in mind once you leave arrival hubs.',
                badge: 'Practical',
                freshness: 'Updated weekly',
                sourceLine: 'Route payment note',
            },
            {
                label: 'Driving side',
                value: 'Right-hand traffic. Scenic roads are appealing, but route quality changes quickly outside town cores.',
                badge: 'Practical',
                freshness: 'Stable',
                sourceLine: 'Transport rule of thumb',
            },
            {
                label: 'Connectivity',
                value: 'Good enough in major traveler towns, but river and mountain days still reward offline backups.',
                badge: 'Trip-ready',
                freshness: 'Updated this season',
                sourceLine: 'Carrier + traveler summary',
            },
            {
                label: 'Cultural context',
                value: 'Temple etiquette and a slower pace are the big adjustments; Laos feels better when you stop rushing it.',
                badge: 'Context',
                freshness: 'Stable',
                sourceLine: 'General destination context',
            },
        ],
        safety: [
            { label: 'LGBTQIA+ comfort', score: 'Usually quiet but workable in traveler towns', detail: 'Less visible social energy than Bangkok or Hanoi, but often calm in backpacker hubs.', tone: 'secondary' },
            { label: 'Solo women at night', score: 'Calmer towns, thinner late-night support', detail: 'Route comfort depends more on transfer timing than nightlife blocks.', tone: 'outline' },
            { label: 'Petty crime', score: 'Low to medium', detail: 'Theft risk is lower than in denser regional cities, but transport vigilance still matters.', tone: 'outline' },
            { label: 'Transport safety', score: 'Road quality and timing matter most', detail: 'Mountain and river transfers are where the real friction sits.', tone: 'secondary' },
        ],
        seasonCards: [
            createSeasonCard('Cool dry season', 'This is when Luang Prabang and Vang Vieng feel easiest and most forgiving.', 'secondary'),
            createSeasonCard('Hot-season slowdown', 'Heat flattens active days quickly and makes transit feel longer.', 'outline'),
            createSeasonCard('Rain-season road caution', 'Road conditions and scenic visibility become the main quality swing.', 'outline'),
        ],
        languageName: 'Lao',
        languageCode: 'lo',
        currencyCode: 'LAK',
        currencyName: 'Lao kip',
        cashRhythm: 'Expect cash-first behavior outside the most polished hotels and cafés.',
        emergencyNumbers: [
            { label: 'Police', value: '191', detail: 'National police emergency line.' },
            { label: 'Ambulance', value: '195', detail: 'Medical emergency support line.' },
        ],
    },
];

const CITY_GUIDE_REGISTRY: TripWorkspaceCityGuide[] = [
    ...THAILAND_CITY_GUIDES.map((city) => {
        switch (city.id) {
            case 'bangkok':
                return {
                    ...city,
                    countryCode: 'TH',
                    countryName: 'Thailand',
                    bestFor: ['Arrival reset', 'Food-first city days', 'Temple + market contrast'],
                    dayTrips: [
                        { title: 'Ayutthaya', detail: 'Easy first route extension when you want history without re-packing.' },
                        { title: 'Canal day', detail: 'Good low-friction half-day when jet lag still shapes the schedule.' },
                    ],
                    practicalNotes: ['Keep the first evening local.', 'BTS/MRT wins over ambitious taxi plans at rush hour.'],
                    weather: createWeatherProfile(
                        'Updated daily demo pulse',
                        'Hot, humid, and very workable if the route respects early starts.',
                        'Bangkok works best when the day is built around cool mornings, indoor lunch resets, and lower-pressure evening plans.',
                        'Traffic and storm bursts matter more than the raw temperature.',
                        'Best window: sunrise to 11:30 for walking-heavy routes.',
                        'No sea risk here, but rain still changes airport and station transfers.',
                        'Heat changes how ambitious the first city days should be.',
                        ['Light layer for AC interiors', 'Refillable water bottle', 'Portable battery for long transit days'],
                        [
                            createForecastDay('Tue', '34°', 'Humid sun', '20%'),
                            createForecastDay('Wed', '35°', 'Late shower', '40%'),
                            createForecastDay('Thu', '33°', 'Cloud breaks', '35%'),
                            createForecastDay('Fri', '34°', 'Storm edge', '55%'),
                        ],
                        [
                            createSignal('Heat feel', 'High after noon', 'secondary'),
                            createSignal('Transit drag', 'Traffic spikes in rain', 'outline'),
                            createSignal('Best photo light', 'Dawn + blue hour', 'outline'),
                        ],
                    ),
                };
            case 'chiang-mai':
                return {
                    ...city,
                    countryCode: 'TH',
                    countryName: 'Thailand',
                    bestFor: ['Cafe rhythm', 'Temples without chaos', 'Northern reset'],
                    dayTrips: [
                        { title: 'Doi Suthep + cafés', detail: 'Best for a soft first full day without overpacking the schedule.' },
                        { title: 'Craft village loop', detail: 'Pairs well with a calmer afternoon when the route needs recovery.' },
                    ],
                    practicalNotes: ['Protect one unscheduled afternoon.', 'Night markets are better anchors than overscheduled temple lists.'],
                    weather: createWeatherProfile(
                        'Updated daily demo pulse',
                        'Softer mornings and calmer evenings keep Chiang Mai forgiving.',
                        'The city rewards pacing more than checklist density.',
                        'Hill visibility and rain haze can weaken scenic outings first.',
                        'Best window: sunrise to 11:00 for hills and temples.',
                        'No marine risk, but haze can play the same role by stealing the scenic version of the day.',
                        'Weather shifts here change the tone of day trips more than the city core.',
                        ['Mask if haze spikes', 'Light layer for early scooters', 'Portable fan helps less than shade'],
                        [
                            createForecastDay('Tue', '31°', 'Bright and dry', '15%'),
                            createForecastDay('Wed', '32°', 'Cloudy heat', '25%'),
                            createForecastDay('Thu', '30°', 'Storm edge', '55%'),
                            createForecastDay('Fri', '29°', 'Rain break', '40%'),
                        ],
                        [
                            createSignal('Walk comfort', 'Good before lunch', 'secondary'),
                            createSignal('Hill clarity', 'Variable this week', 'outline'),
                            createSignal('Market nights', 'Reliable after sunset', 'secondary'),
                        ],
                    ),
                };
            case 'pai':
                return {
                    ...city,
                    countryCode: 'TH',
                    countryName: 'Thailand',
                    bestFor: ['Quiet recovery', 'Mountain air change', 'Short slower leg'],
                    dayTrips: [{ title: 'Canyon + hot spring split', detail: 'Best when the route wants one scenic day and one soft afternoon.' }],
                    practicalNotes: ['Arrival energy is usually lower than you think after the curves.', 'Keep evenings intentionally quiet on short stays.'],
                    weather: createWeatherProfile(
                        'Updated daily demo pulse',
                        'Cooler mountain mornings make Pai feel easier than the route that gets you there.',
                        'The town is light on logistics once you arrive, which is exactly why it works as a reset.',
                        'Rain and fog matter more for road confidence than for town life.',
                        'Best window: 08:00 to 13:00 for viewpoints and scooter loops.',
                        'No marine risk; road and mist conditions are the real watch item.',
                        'Weather mainly changes the scenic value of loops and viewpoints.',
                        ['Light jacket', 'Dry bag for scooters', 'Headlamp for darker streets'],
                        [
                            createForecastDay('Sat', '27°', 'Cool morning sun', '15%'),
                            createForecastDay('Sun', '28°', 'Cloud + heat', '30%'),
                            createForecastDay('Mon', '26°', 'Mist pockets', '45%'),
                            createForecastDay('Tue', '27°', 'Late shower', '35%'),
                        ],
                        [
                            createSignal('Road comfort', 'Best before dusk', 'secondary'),
                            createSignal('Viewpoint clarity', 'Mixed this week', 'outline'),
                            createSignal('Town pace', 'Gentle', 'secondary'),
                        ],
                    ),
                };
            case 'phuket':
                return {
                    ...city,
                    countryCode: 'TH',
                    countryName: 'Thailand',
                    bestFor: ['Airport hinge', 'Easy beach reset', 'Island handoff'],
                    dayTrips: [{ title: 'Old Town + beach split', detail: 'Useful when you want both logistics and atmosphere without a full island scramble.' }],
                    practicalNotes: ['Choose the beach zone before arrival.', 'Cross-island ambition is usually the first quality killer.'],
                    weather: createWeatherProfile(
                        'Updated marine-aware demo pulse',
                        'Phuket is mostly about whether the transfer chain stays easy.',
                        'This stop can still feel good in mixed weather if the island is treated as a hinge, not as a whole checklist.',
                        'Storm timing turns cross-island and boat-handoff plans messy fast.',
                        'Best window: early morning beach or Old Town block before transfer heat builds.',
                        'Marine conditions matter once the route leans on ferries or long-tail plans.',
                        'Weather here changes onward boat confidence more than city comfort.',
                        ['Dry pouch', 'Screenshots for piers', 'Quick-dry layer'],
                        [
                            createForecastDay('Tue', '31°', 'Sea breeze', '25%'),
                            createForecastDay('Wed', '30°', 'Storm pockets', '60%'),
                            createForecastDay('Thu', '31°', 'Cloud + sun', '40%'),
                            createForecastDay('Fri', '30°', 'Heavy burst', '55%'),
                        ],
                        [
                            createSignal('Boat confidence', 'Watch tomorrow closely', 'outline'),
                            createSignal('Airport handoff', 'Easy in dry windows', 'secondary'),
                            createSignal('Beach payoff', 'Best before noon', 'secondary'),
                        ],
                    ),
                };
            case 'phi-phi':
                return {
                    ...city,
                    countryCode: 'TH',
                    countryName: 'Thailand',
                    bestFor: ['Signature scenery', 'Short island glow', 'Viewpoint sunrise'],
                    dayTrips: [{ title: 'Weather-first boat day', detail: 'Only lock a boat day after checking the marine read for the best-looking window.' }],
                    practicalNotes: ['Protect one flexible day.', 'Stay walkable on first and last night.'],
                    weather: createWeatherProfile(
                        'Updated marine-aware demo pulse',
                        'Phi Phi shines when the sea cooperates and transfer days stay light.',
                        'The island feels incredible when weather and crowd timing align, but much weaker when you lock the wrong boat day.',
                        'Marine conditions are the main trip-quality swing here.',
                        'Best window: dawn to lunch for viewpoints and boat plans.',
                        'This is one of the clearest marine-risk stops in the workspace.',
                        'Sea conditions change whether Phi Phi becomes a postcard day or a salvage day.',
                        ['Dry bag', 'Sandals that survive wet piers', 'Offline confirmation screenshots'],
                        [
                            createForecastDay('Sat', '31°', 'Bright start', '25%'),
                            createForecastDay('Sun', '30°', 'Cloudier seas', '45%'),
                            createForecastDay('Mon', '30°', 'Storm edge', '60%'),
                            createForecastDay('Tue', '31°', 'Clearer morning', '30%'),
                        ],
                        [
                            createSignal('Sea clarity', 'Best on calmer mornings', 'secondary'),
                            createSignal('Pier friction', 'High in rain', 'outline'),
                            createSignal('Viewpoint payoff', 'Excellent at sunrise', 'secondary'),
                        ],
                    ),
                };
            case 'krabi':
                return {
                    ...city,
                    countryCode: 'TH',
                    countryName: 'Thailand',
                    bestFor: ['Boat-base planning', 'Scenery vs logistics tradeoff', 'Coast buffer day'],
                    dayTrips: [{ title: 'Railay vs Ao Nang decision day', detail: 'Best when the route needs a smart base choice before stacking tours.' }],
                    practicalNotes: ['Protect one flexible coast day.', 'Ao Nang is easier, Railay is prettier, and the route should admit that tradeoff.'],
                    weather: createWeatherProfile(
                        'Updated marine-aware demo pulse',
                        'This is the weather hinge of the Thailand coast leg.',
                        'The south stops being background weather and starts changing the shape of the whole day here.',
                        'Boat mornings can look fine from land and still collapse the scenic plan mid-route.',
                        'Best window: sunrise to early lunch for boat-heavy ideas.',
                        'Keep one flexible coast day. That single choice protects mood and budget.',
                        'Marine conditions here directly change whether the whole coast leg feels polished or reactive.',
                        ['Dry bag for ferries', 'Quick-dry layer', 'One inland fallback plan'],
                        [
                            createForecastDay('Sat', '32°', 'Bright start', '30%'),
                            createForecastDay('Sun', '31°', 'Sea breeze', '25%'),
                            createForecastDay('Mon', '30°', 'Storm pockets', '65%'),
                            createForecastDay('Tue', '31°', 'Cloud + sun', '40%'),
                        ],
                        [
                            createSignal('Boat confidence', 'Watch Monday closely', 'outline'),
                            createSignal('Beach payoff', 'Best before noon', 'secondary'),
                            createSignal('Transfer drag', 'High in rain', 'outline'),
                        ],
                    ),
                };
            default:
                return {
                    ...city,
                    countryCode: 'TH',
                    countryName: 'Thailand',
                };
        }
    }),
    ...SEA_VIETNAM_LAOS_CITY_GUIDES,
    {
        id: 'siem-reap',
        title: 'Siem Reap',
        matchers: ['siemreap', 'siem'],
        countryCode: 'KH',
        countryName: 'Cambodia',
        role: 'Temple-entry city where early starts and hydration matter more than cramming too much into one pass.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '3-4 nights',
        arrival: 'Airport arrivals are simple; overland arrivals from Thailand deserve calmer first-evening expectations.',
        transit: 'Tuk-tuks and short rides dominate. The city core is small enough that logistics should stay easy.',
        bestFor: ['Angkor planning', 'Soft evening markets', 'Culture-heavy days with slower nights'],
        dayTrips: [
            { title: 'Angkor Small Circuit', detail: 'The clearest first full day when the route wants a signature payoff early.' },
            { title: 'Tonle Sap sunset', detail: 'Better as a second-day contrast than as the whole reason for the stop.' },
        ],
        practicalNotes: ['Protect the sunrise day with an early night.', 'Heat turns “one more temple” into a quality drop fast.'],
        officialLinks: [
            createLink('Angkor Enterprise', 'https://www.angkorenterprise.gov.kh'),
            createLink('Siem Reap Airport', 'https://www.sai-airport.com'),
        ],
        neighborhoods: [
            createNeighborhood('Old French Quarter', 'Calm base close to cafés and lower-friction evenings', 44, 46, 'lg'),
            createNeighborhood('Wat Bo', 'Softer boutique stay pocket', 59, 58, 'md'),
            createNeighborhood('Night Market edge', 'Livelier but noisier late', 36, 55, 'md'),
        ],
        highlights: ['Angkor sunrise', 'Bayon faces at first light', 'Slow old-market dinner'],
        mapLayers: [
            createLayer(
                'temple-days',
                'Temple days',
                'Trip-specific',
                'Keep the temple morning anchor obvious, then let the afternoon soften instead of forcing density.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Old French Quarter', 'Wat Bo'],
                ['Old French Quarter'],
                [point(28, 30), point(43, 44), point(58, 58)],
                { label: 'Temple morning hinge', detail: 'Stay close enough that sunrise days do not become logistics days.', position: point(42, 43) },
            ),
            createLayer(
                'soft-evening',
                'Soft evenings',
                'General destination',
                'Siem Reap feels better when evenings recover energy instead of trying to top the temples.',
                'Updated this season',
                'General city context',
                ['Wat Bo', 'Night Market edge'],
                ['Wat Bo'],
                [point(60, 59), point(47, 53), point(36, 55)],
                { label: 'Recovery corridor', detail: 'The best version of the city balances huge mornings with easier evenings.', position: point(49, 55) },
            ),
        ],
        tripInsights: ['Trip-specific: Angkor is the big swing, so build around it instead of stacking too many side plans.'],
        generalInsights: ['General destination: heat discipline matters more than squeezing in every temple name.'],
        savedStays: [
            createStay('Old French Quarter', 'Calm first base', 'Best if the route wants easy early mornings and softer evenings.', 44, 47),
            createStay('Wat Bo', 'Boutique reset', 'Better if the stop should feel quieter and more design-heavy.', 60, 59),
        ],
        events: [{ title: 'Dry-season sunrise rush', detail: 'Sunrise tickets and tuk-tuk timing matter most in peak season.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Hot temple mornings still beat hot temple afternoons by a wide margin.',
            'Siem Reap feels good when the route protects early starts and cool-down gaps.',
            'Heat is the real quality risk even on dry-looking days.',
            'Best window: 05:00 to 11:00 for Angkor-heavy plans.',
            'No sea risk; weather mainly changes stamina and photo quality.',
            'Forecast shifts here change temple timing more than city viability.',
            ['Sun cover', 'Electrolyte tabs', 'Backup shirt for temple days'],
            [
                createForecastDay('Tue', '34°', 'Dry heat', '10%'),
                createForecastDay('Wed', '35°', 'Bright and harsh', '15%'),
                createForecastDay('Thu', '33°', 'Cloud relief', '25%'),
                createForecastDay('Fri', '34°', 'Late storm edge', '35%'),
            ],
            [
                createSignal('Temple comfort', 'Best before lunch', 'secondary'),
                createSignal('Heat load', 'High', 'outline'),
                createSignal('Sunrise payoff', 'Excellent in dry windows', 'secondary'),
            ],
        ),
    },
    {
        id: 'phnom-penh',
        title: 'Phnom Penh',
        matchers: ['phnompenh', 'phnom'],
        countryCode: 'KH',
        countryName: 'Cambodia',
        role: 'Fast-moving capital stop that benefits from a narrow focus and a respectful pace.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '2-3 nights',
        arrival: 'Riverside and BKK1 are the easiest bases if the route wants low-friction evenings after a bus day.',
        transit: 'Grab/tuk-tuk mix. Heat and traffic make even short distances feel longer.',
        bestFor: ['History context', 'Riverfront evenings', 'Short focused city stays'],
        dayTrips: [{ title: 'Silk Island half-day', detail: 'Only worth it if the route has more room than a standard short capital stop.' }],
        practicalNotes: ['Respect emotional weight on history days.', 'Keep night plans simple after heavier museums.'],
        officialLinks: [
            createLink('Phnom Penh Airport', 'https://www.cambodia-airports.aero/en/airport/phnom-penh'),
        ],
        neighborhoods: [
            createNeighborhood('BKK1', 'Easier cafés and polished stays', 58, 42, 'lg'),
            createNeighborhood('Riverside', 'Best for short evening walks', 41, 56, 'md'),
            createNeighborhood('Tuol Tom Poung', 'More local energy and markets', 66, 61, 'md'),
        ],
        highlights: ['S21 + Killing Fields context visit', 'Riverside food walk', 'Golden-hour palace exterior'],
        mapLayers: [
            createLayer(
                'history-day',
                'History day',
                'Trip-specific',
                'The city works best when one heavy history block is balanced by a much lighter evening.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['BKK1', 'Riverside'],
                ['BKK1'],
                [point(64, 36), point(56, 43), point(42, 55)],
                { label: 'Heavy-then-light arc', detail: 'Pair the hardest content with an easy riverside night.', position: point(54, 46) },
            ),
            createLayer(
                'food-night',
                'Food night',
                'General destination',
                'Shorter stays improve when the city ends with food and river air instead of another museum block.',
                'Updated this season',
                'General city context',
                ['Riverside', 'Tuol Tom Poung'],
                ['Riverside'],
                [point(68, 60), point(54, 58), point(42, 56)],
                { label: 'Evening recovery', detail: 'The stop lands better when it gives you one genuinely easy night.', position: point(50, 58) },
            ),
        ],
        tripInsights: ['Trip-specific: keep the capital stay short and intentional.'],
        generalInsights: ['General destination: traffic and heat make overstuffed day plans weaker than they look.'],
        savedStays: [
            createStay('BKK1', 'Polished short-stop base', 'Best for a quick capital stay with easier café recovery.', 58, 43),
            createStay('Riverside', 'Evening-first base', 'Better if river walks and short nights matter most.', 41, 56),
        ],
        events: [{ title: 'Sunset riverfront peak', detail: 'Best energy comes right before and after sunset.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Capital heat and traffic make focus more important than ambition.',
            'Phnom Penh is usually more about pacing the day than chasing perfect weather.',
            'Storm bursts complicate tuk-tuk hops and riverside plans quickly.',
            'Best window: 08:00 to noon for history-heavy plans.',
            'No sea risk; weather mostly affects comfort and traffic.',
            'Forecast shifts here change how much you can comfortably stack into one day.',
            ['Umbrella', 'Water bottle', 'Small cash for quick transport switches'],
            [
                createForecastDay('Tue', '35°', 'Dry heat', '15%'),
                createForecastDay('Wed', '34°', 'Cloud + humidity', '30%'),
                createForecastDay('Thu', '33°', 'Late storm', '50%'),
                createForecastDay('Fri', '34°', 'Bright breaks', '25%'),
            ],
            [
                createSignal('Heat load', 'High', 'outline'),
                createSignal('Riverside comfort', 'Better after sunset', 'secondary'),
                createSignal('Traffic drag', 'Strong in rain', 'outline'),
            ],
        ),
    },
    {
        id: 'kampot',
        title: 'Kampot',
        matchers: ['kampot'],
        countryCode: 'KH',
        countryName: 'Cambodia',
        role: 'A softer Cambodia stop that resets the trip after the heavier city pair.',
        freshness: 'Updated this week',
        sourceLine: 'Demo sources + official links',
        idealStay: '2-3 nights',
        arrival: 'Central riverside stays keep the stop simple if you do not want scooter dependency immediately.',
        transit: 'Walking and short rides are enough if you stay near the river.',
        bestFor: ['Slow river evenings', 'Pepper-farm side trips', 'Low-pressure recovery'],
        dayTrips: [{ title: 'Bokor loop', detail: 'Best on clearer weather days when the road and viewpoint payoff stay strong.' }],
        practicalNotes: ['This stop is about easing off the throttle.', 'Do not turn Kampot into another capital-style checklist.'],
        officialLinks: [
            createLink('Tourism Cambodia', 'https://www.tourismcambodia.com'),
        ],
        neighborhoods: [
            createNeighborhood('Riverside core', 'Best without scooter pressure', 48, 54, 'lg'),
            createNeighborhood('Old market edge', 'More cafes and easy evenings', 36, 46, 'md'),
        ],
        highlights: ['Pepper farm trip', 'Slow sunset on the river', 'Bokor weather day'],
        mapLayers: [
            createLayer(
                'easy-kampot',
                'Easy Kampot',
                'Trip-specific',
                'Kampot works best when it feels noticeably slower than the cities before it.',
                'Updated this week',
                'Trip-specific demo planning layer',
                ['Riverside core'],
                ['Riverside core'],
                [point(35, 46), point(48, 54)],
                { label: 'Reset base', detail: 'Bias the stop toward one calm base and one scenic outing.', position: point(46, 52) },
            ),
            createLayer(
                'bokor-day',
                'Bokor day',
                'General destination',
                'Treat Bokor as the signature scenic day, not as a guaranteed condition-free plan.',
                'Updated this season',
                'General city context',
                ['Old market edge', 'Riverside core'],
                ['Riverside core'],
                [point(52, 52), point(66, 34)],
                { label: 'Scenic gamble', detail: 'Bokor only pays off fully when visibility cooperates.', position: point(63, 36) },
            ),
        ],
        tripInsights: ['Trip-specific: this is where the route should start feeling slower again.'],
        generalInsights: ['General destination: riverside mood is the point, not just another long activity list.'],
        savedStays: [
            createStay('Riverside core', 'Slow evening base', 'Best if Kampot is meant to reset energy.', 48, 54),
        ],
        events: [{ title: 'River sunset hour', detail: 'The town peaks in mood around sunset rather than late at night.' }],
        weather: createWeatherProfile(
            'Updated daily demo pulse',
            'Warm and manageable, with weather mostly changing the scenic side-trip quality.',
            'Kampot holds up well in mixed weather if the route keeps one softer day.',
            'Road visibility and rain affect Bokor more than the town itself.',
            'Best window: morning for Bokor, evening for riverside time.',
            'No sea risk; road and visibility matter more here.',
            'Forecast shifts mainly change whether the scenic day feels worth it.',
            ['Light rain layer', 'Small daypack', 'Bug spray near the river'],
            [
                createForecastDay('Sat', '32°', 'Bright morning', '20%'),
                createForecastDay('Sun', '31°', 'Cloud + humidity', '30%'),
                createForecastDay('Mon', '30°', 'Hill mist', '45%'),
                createForecastDay('Tue', '31°', 'Late shower', '35%'),
            ],
            [
                createSignal('Bokor clarity', 'Mixed', 'outline'),
                createSignal('Town comfort', 'Good after sunset', 'secondary'),
                createSignal('River mood', 'Strong this week', 'secondary'),
            ],
        ),
    },
];

const CITY_COUNTRY_CODE_BY_ID = new Map(
    CITY_GUIDE_REGISTRY.map((city) => [city.id, city.countryCode ?? 'TH']),
);

const CITY_LOOKUP_BY_ID = new Map(
    CITY_GUIDE_REGISTRY.map((city) => [city.id, city]),
);

const COUNTRY_LOOKUP_BY_CODE = new Map(
    COUNTRY_GUIDE_REGISTRY.map((country) => [country.code, country]),
);

const createPhraseCard = (
    id: string,
    countryCode: string,
    cityId: string,
    languageCode: string,
    languageName: string,
    category: PhraseCategory,
    phrase: string,
    local: string,
    pronunciation: string,
    usage: string,
): TripWorkspacePhraseCard => ({
    id,
    countryCode,
    cityId,
    languageCode,
    languageName,
    category,
    phrase,
    local,
    pronunciation,
    usage,
});

const PHRASE_CARD_REGISTRY: TripWorkspacePhraseCard[] = [
    ...THAILAND_PHRASE_CARDS.map((card) => ({
        ...card,
        countryCode: 'TH',
        languageCode: 'th',
        languageName: 'Thai',
    })),
    createPhraseCard('kh-hello', 'KH', 'siem-reap', 'km', 'Khmer', 'basics', 'Hello', 'Suosdei', 'soo-ahs-day', 'Friendly default greeting in Cambodia.'),
    createPhraseCard('kh-thank-you', 'KH', 'siem-reap', 'km', 'Khmer', 'basics', 'Thank you', 'Aw kun', 'ow-koon', 'Useful almost everywhere from tuk-tuks to cafés.'),
    createPhraseCard('kh-reservation', 'KH', 'phnom-penh', 'km', 'Khmer', 'transport', 'I have a reservation', 'Khnhom mean kar bok chong', 'knyom mean ka bok-jong', 'Good for hotels and bus desks.'),
    createPhraseCard('kh-market', 'KH', 'kampot', 'km', 'Khmer', 'food', 'No spicy, please', 'Som kom oy phet', 'som kom oy pet', 'Helpful for market meals when you want softer heat.'),
    createPhraseCard('kh-help', 'KH', 'phnom-penh', 'km', 'Khmer', 'emergency', 'Please help me', 'Som chuoy khnhom', 'som joo-ay knyom', 'Simple emergency handoff phrase.'),
    createPhraseCard('vi-hello', 'VN', 'hcmc', 'vi', 'Vietnamese', 'basics', 'Hello', 'Xin chào', 'sin chow', 'Works across the whole Vietnam leg.'),
    createPhraseCard('vi-thank-you', 'VN', 'hanoi', 'vi', 'Vietnamese', 'basics', 'Thank you', 'Cảm ơn', 'gahm uhn', 'Low-effort warmth that goes a long way.'),
    createPhraseCard('vi-train', 'VN', 'hanoi', 'vi', 'Vietnamese', 'transport', 'Where is the station?', 'Ga ở đâu?', 'gah uh dow', 'Especially handy in the northern rail stretch.'),
    createPhraseCard('vi-booking', 'VN', 'hoi-an', 'vi', 'Vietnamese', 'transport', 'I have a booking', 'Tôi có đặt chỗ', 'toy koh dat choh', 'Useful for hotels and transport counters.'),
    createPhraseCard('vi-vegetarian', 'VN', 'hoi-an', 'vi', 'Vietnamese', 'food', 'I am vegetarian', 'Tôi ăn chay', 'toy an chai', 'Good one to keep handy on cooking or market days.'),
    createPhraseCard('vi-help', 'VN', 'sapa', 'vi', 'Vietnamese', 'emergency', 'Where is the hospital?', 'Bệnh viện ở đâu?', 'benh vyen uh dow', 'Good for the northern mountain leg.'),
    createPhraseCard('lo-hello', 'LA', 'luang-prabang', 'lo', 'Lao', 'basics', 'Hello', 'Sabaidee', 'sa-bai-dee', 'Friendly everyday Lao greeting.'),
    createPhraseCard('lo-thank-you', 'LA', 'vang-vieng', 'lo', 'Lao', 'basics', 'Thank you', 'Khop chai', 'kop chai', 'Useful in cafés, stays, and markets.'),
    createPhraseCard('lo-transport', 'LA', 'vang-vieng', 'lo', 'Lao', 'transport', 'Where is the station?', 'Sathani yu sai?', 'sa-ta-nee yoo sai', 'Helpful for transfers between Laos stops.'),
    createPhraseCard('lo-food', 'LA', 'luang-prabang', 'lo', 'Lao', 'food', 'Not spicy, please', 'Bor phet der', 'bor pet der', 'Worth saving before your first night market dinner.'),
    createPhraseCard('lo-help', 'LA', 'luang-prabang', 'lo', 'Lao', 'emergency', 'Please help me', 'Suay khoy nae', 'su-ay koy nae', 'Broad handoff phrase when you need help fast.'),
];

const SEA_TRAVEL_KIT_CHECKLIST: TripWorkspaceTravelKitChecklistItem[] = [
    { id: 'entry-passport', section: 'entry', label: 'Keep passport validity and onward proof ready', detail: 'This matters on every SEA border hop, not just the first flight.', scope: 'Trip-specific' },
    { id: 'entry-esim', section: 'entry', label: 'Download one offline route pack before departure', detail: 'Border, pier, and overnight transfer days are where the screenshots save you.', scope: 'Trip-specific' },
    { id: 'arrival-city-cash', section: 'arrival', label: 'Carry a small first-arrival cash buffer', detail: 'Cards are inconsistent enough across the route that first-night cash still removes friction.', scope: 'Trip-specific' },
    { id: 'arrival-respect-layers', section: 'arrival', label: 'Keep one temple-ready layer and easy shoes close', detail: 'Temple etiquette matters in Thailand, Cambodia, Laos, and parts of Vietnam.', scope: 'General destination' },
    { id: 'border-proof-pack', section: 'border', label: 'Store border-day proof in one offline folder', detail: 'Passport scan, onward proof, first stay, and visa confirmation should live together.', scope: 'Trip-specific' },
    { id: 'border-cash-split', section: 'border', label: 'Split small cash across countries before long overland days', detail: 'Border and late-arrival transport friction is lower when you are not ATM-dependent immediately.', scope: 'Trip-specific' },
    { id: 'regional-laundry-rhythm', section: 'regional', label: 'Plan laundry around long transfer clusters', detail: 'Night trains, buses, and humid stretches stack faster than expected in SEA.', scope: 'Trip-specific' },
    { id: 'regional-battery-pack', section: 'regional', label: 'Keep a battery bank reachable on every transfer day', detail: 'It matters more across borders and mountain legs than it does in stable city days.', scope: 'Trip-specific' },
    { id: 'island-flex-day', section: 'islands', countryCode: 'TH', label: 'Protect one flexible day for Thai coast weather', detail: 'South Thailand still needs sea-weather slack even in a broader SEA route.', scope: 'Trip-specific' },
];

const SEA_TRAVEL_KIT_UTILITIES: TripWorkspaceTravelKitUtility[] = [
    { id: 'util-th-power', countryCode: 'TH', label: 'Thailand power', value: 'Type A/B/C/O • 220V', detail: 'Universal adapter covers most stays easily.', badge: 'Stable' },
    { id: 'util-kh-cash', countryCode: 'KH', label: 'Cambodia cash rhythm', value: 'USD + riel backup', detail: 'Small notes smooth markets and transport.', badge: 'Updated weekly' },
    { id: 'util-vn-connectivity', countryCode: 'VN', label: 'Vietnam connectivity', value: 'Strong cities, screenshots for trains', detail: 'Offline backups matter more in the north.', badge: 'Updated this season' },
    { id: 'util-la-cash', countryCode: 'LA', label: 'Laos cash rhythm', value: 'Cash-first outside polished hotels', detail: 'ATM timing matters more here than on the Thailand leg.', badge: 'Updated weekly' },
];

const SEA_TRAVEL_KIT_EMERGENCY_CARDS: TripWorkspaceTravelKitEmergencyCard[] = [
    { id: 'emg-th-tourist-police', countryCode: 'TH', title: 'Thailand Tourist Police', contact: '1155', detail: 'English-speaking bridge for traveler support.', tone: 'secondary' },
    { id: 'emg-kh-police', countryCode: 'KH', title: 'Cambodia Police', contact: '117', detail: 'National emergency police line.', tone: 'outline' },
    { id: 'emg-vn-ambulance', countryCode: 'VN', title: 'Vietnam Ambulance', contact: '115', detail: 'National medical emergency line.', tone: 'outline' },
    { id: 'emg-la-police', countryCode: 'LA', title: 'Laos Police', contact: '191', detail: 'National emergency police line.', tone: 'outline' },
];

const SEA_TRAVEL_KIT_PACKS: TripWorkspaceTravelKitPack[] = [
    { id: 'pack-border-day', label: 'Border day', detail: 'Keeps the cross-country handoff calm and low-friction.', includes: ['Passport scan', 'Visa proof', 'Small cash split', 'First-stay screenshot'] },
    { id: 'pack-city-heat', label: 'City heat day', detail: 'Better for Bangkok, HCMC, Phnom Penh, and Hanoi walking blocks.', includes: ['Water bottle', 'Battery pack', 'Sun cover', 'Mini umbrella'] },
    { id: 'pack-mountain-day', countryCode: 'VN', label: 'Mountain day', detail: 'Useful for Sapa and cooler hill stretches.', includes: ['Light fleece', 'Shell', 'Dry socks', 'Offline route screenshots'] },
    { id: 'pack-coast-day', countryCode: 'TH', label: 'Coast day', detail: 'Protects the weather-sensitive Thai island leg.', includes: ['Dry bag', 'Quick-dry shirt', 'Cash split', 'Pier screenshots'] },
];

const SEA_DOCUMENT_RECORDS: TripWorkspaceDocumentRecord[] = [
    { id: 'doc-passport', section: 'entry', title: 'Passport validity and scans', status: 'Verified', scope: 'General destination', carryMode: 'Either', detail: 'Keep one offline copy and one quick-access print or screenshot set.', sourceLine: 'Route entry packet', tags: ['Identity', 'Entry'], },
    { id: 'doc-onward', section: 'entry', title: 'Onward and border proof packet', status: 'Review', scope: 'Trip-specific', carryMode: 'Offline', detail: 'Your route crosses multiple land borders, so onward proof deserves one calm folder.', sourceLine: 'SEA route handoff', tags: ['Border', 'Onward proof'], },
    { id: 'doc-th-kh', section: 'transport', countryCode: 'KH', legLabel: 'Thailand -> Cambodia', title: 'Thailand to Cambodia border day packet', status: 'Review', scope: 'Trip-specific', carryMode: 'Offline', detail: 'Keep passport, visa proof, transport confirmation, and Siem Reap stay together.', sourceLine: 'Cross-border packet', tags: ['Border', 'Bus', 'Siem Reap'], },
    { id: 'doc-kh-vn', section: 'transport', countryCode: 'VN', legLabel: 'Cambodia -> Vietnam', title: 'Cambodia to Vietnam transfer proof', status: 'Missing', scope: 'Trip-specific', carryMode: 'Either', detail: 'Long border days get much easier when the next city packet is already grouped.', sourceLine: 'Cross-border packet', tags: ['Border', 'Vietnam entry'], },
    { id: 'doc-vn-la', section: 'transport', countryCode: 'LA', legLabel: 'Vietnam -> Laos', title: 'Vietnam to Laos onward packet', status: 'Review', scope: 'Trip-specific', carryMode: 'Offline', detail: 'Screenshots matter more once signal and fatigue start stacking together.', sourceLine: 'Cross-border packet', tags: ['Border', 'Laos entry'], },
    { id: 'doc-insurance', section: 'coverage', title: 'Insurance summary and emergency numbers', status: 'Verified', scope: 'Trip-specific', carryMode: 'Offline', detail: 'Keep policy reference, support line, and the covered-emergency summary in one spot.', referenceLabel: 'Policy', referenceValue: 'SEA-DEMO-2026', sourceLine: 'Coverage packet', tags: ['Insurance', 'Emergency'], },
    { id: 'doc-city-stays', section: 'stays', title: 'First-night and border-night stay sheet', status: 'Review', scope: 'Trip-specific', carryMode: 'Offline', detail: 'The smartest packet bundles the first stay after each border crossing, not just the first hotel of the whole trip.', sourceLine: 'Trip stay packet', tags: ['Hotels', 'Border nights'], },
];

const SEA_DOCUMENT_PACKETS: TripWorkspaceDocumentPacket[] = [
    { id: 'packet-entry', label: 'Entry packet', detail: 'Everything you need on the first flight or first border desk.', documentIds: ['doc-passport', 'doc-onward'] },
    { id: 'packet-borders', label: 'Border packets', detail: 'Cross-country handoff proofs and next-city anchors.', documentIds: ['doc-th-kh', 'doc-kh-vn', 'doc-vn-la'] },
    { id: 'packet-coverage', label: 'Coverage packet', detail: 'Insurance and emergency backup in one quick place.', documentIds: ['doc-insurance'] },
    { id: 'packet-stays', label: 'Stay packet', detail: 'First-night and border-night stays grouped for faster arrivals.', documentIds: ['doc-city-stays'] },
];

const SEA_NOTE_REGISTRY: TripWorkspaceNoteRecord[] = [
    { id: 'note-bkk-arrival', countryCode: 'TH', cityId: 'bangkok', title: 'Arrival reset', type: 'arrival', moment: 'Bangkok opening', body: 'Keep the first Bangkok evening light and do not mistake adrenaline for actual energy.' },
    { id: 'note-siem-reap', countryCode: 'KH', cityId: 'siem-reap', title: 'Temple pacing', type: 'rhythm', moment: 'Angkor days', body: 'Protect the sunrise block, then let the afternoon cool down instead of chasing a perfect temple count.' },
    { id: 'note-kampot', countryCode: 'KH', cityId: 'kampot', title: 'Slowdown permission', type: 'rhythm', moment: 'Cambodia reset', body: 'Kampot is the place to exhale a bit. Let the route breathe here.' },
    { id: 'note-hanoi', countryCode: 'VN', cityId: 'hanoi', title: 'Density control', type: 'fallback', moment: 'North Vietnam city days', body: 'Do not spend every waking hour in the Old Quarter. One calmer base move improves the whole stay.' },
    { id: 'note-sapa', countryCode: 'VN', cityId: 'sapa', title: 'Weather humility', type: 'fallback', moment: 'Mountain leg', body: 'If the views disappear, lean into the cooler reset instead of fighting the weather.' },
    { id: 'note-luang-prabang', countryCode: 'LA', cityId: 'luang-prabang', title: 'Final slowdown', type: 'rhythm', moment: 'Laos finale', body: 'Luang Prabang should feel like the route settling, not like one last sprint.' },
];

const SEA_PHOTO_REGISTRY: TripWorkspacePhotoRecord[] = [
    { id: 'photo-bangkok-neon', countryCode: 'TH', cityId: 'bangkok', title: 'Bangkok canal dusk', caption: 'Demo route texture for the SEA trip opener.', mood: 'Warm arrival haze' },
    { id: 'photo-angkor', countryCode: 'KH', cityId: 'siem-reap', title: 'Angkor first light', caption: 'The big temple-morning postcard moment.', mood: 'Stone and sunrise' },
    { id: 'photo-kampot', countryCode: 'KH', cityId: 'kampot', title: 'Kampot river blue hour', caption: 'A slower, softer postcard that changes the route’s energy.', mood: 'Quiet river dusk' },
    { id: 'photo-hcmc', countryCode: 'VN', cityId: 'hcmc', title: 'Saigon scooter glow', caption: 'Dense city movement without needing a skyline cliché.', mood: 'Urban rush' },
    { id: 'photo-hoi-an', countryCode: 'VN', cityId: 'hoi-an', title: 'Lantern hour in Hoi An', caption: 'The old town glow that should feel tactile, not generic.', mood: 'Lantern night' },
    { id: 'photo-sapa', countryCode: 'VN', cityId: 'sapa', title: 'Sapa cloud break', caption: 'The kind of mountain payoff the route has to earn.', mood: 'Mist and terraces' },
    { id: 'photo-luang-prabang', countryCode: 'LA', cityId: 'luang-prabang', title: 'Mekong sunset steps', caption: 'The route cooling down into its quietest finish.', mood: 'River calm' },
];

const SEA_BOOKING_REGISTRY: TripWorkspaceBookingRecord[] = [
    { id: 'booking-bkk-arrival', countryCode: 'TH', cityId: 'bangkok', type: 'stay', title: 'Bangkok arrival stay', status: 'Confirmed', meta: '3 nights • easy airport handoff • first-night reset base' },
    { id: 'booking-th-kh-bus', countryCode: 'KH', cityId: 'siem-reap', type: 'transport', title: 'Thailand → Cambodia border transfer', status: 'Needs review', meta: 'Cross-border bus details still need one final proof bundle.' },
    { id: 'booking-siem-reap-angkor', countryCode: 'KH', cityId: 'siem-reap', type: 'activity', title: 'Angkor circuit day', status: 'Confirmed', meta: 'Sunrise route and tuk-tuk plan already shaped.' },
    { id: 'booking-kampot-base', countryCode: 'KH', cityId: 'kampot', type: 'stay', title: 'Kampot riverside stay', status: 'Needs review', meta: 'Need to lock whether the stop is central riverside or quieter edge.' },
    { id: 'booking-vn-entry', countryCode: 'VN', cityId: 'hcmc', type: 'entry', title: 'Vietnam border and onward proof', status: 'Missing', meta: 'This is the current route hinge before the long Vietnam leg feels settled.' },
    { id: 'booking-hoi-an-train', countryCode: 'VN', cityId: 'hoi-an', type: 'transport', title: 'Central Vietnam train connection', status: 'Needs review', meta: 'Arrival timing into the Hoi An stretch still needs a cleaner handoff.' },
    { id: 'booking-sapa-transfer', countryCode: 'VN', cityId: 'sapa', type: 'transport', title: 'Sapa overnight transfer', status: 'Missing', meta: 'Lock the northbound transfer before the mountain leg starts feeling fragile.' },
    { id: 'booking-laos-entry', countryCode: 'LA', cityId: 'vang-vieng', type: 'transport', title: 'Vietnam → Laos handoff', status: 'Needs review', meta: 'Keep border proof and first Laos stay together in one offline packet.' },
    { id: 'booking-luang-prabang-stay', countryCode: 'LA', cityId: 'luang-prabang', type: 'stay', title: 'Luang Prabang calm stay', status: 'Confirmed', meta: 'Walkable old-town base already chosen.' },
];

const SEA_EXPLORE_LEADS: TripWorkspaceExploreLead[] = [
    ...THAILAND_EXPLORE_LEADS.map((lead) => ({ ...lead, countryCode: CITY_COUNTRY_CODE_BY_ID.get(lead.cityId) ?? 'TH' })),
    { id: 'siem-reap-angkor-circuit', countryCode: 'KH', cityId: 'siem-reap', title: 'Angkor sunrise circuit', type: 'activity', activityTypes: ['culture', 'sightseeing'], description: 'The strongest signature day in Cambodia when the route is ready for an early start.', query: 'Siem Reap Angkor sunrise tuk tuk tour', reason: 'High-payoff temple day that defines the stop.' },
    { id: 'kampot-river-stay', countryCode: 'KH', cityId: 'kampot', title: 'Kampot riverside stay shortlist', type: 'stay', description: 'Compare central river stays against quieter boutique edges.', query: 'Kampot riverside boutique hotel', reason: 'The stay choice shapes whether Kampot feels calm or too scattered.' },
    { id: 'hcmc-food-night', countryCode: 'VN', cityId: 'hcmc', title: 'District food crawl', type: 'activity', activityTypes: ['food', 'culture'], description: 'A better first-city Vietnam memory than trying to see every landmark in one sweep.', query: 'Ho Chi Minh City street food tour district 1 3', reason: 'Great first-night anchor with low planning friction.' },
    { id: 'hoi-an-tailor-window', countryCode: 'VN', cityId: 'hoi-an', title: 'Tailor + lantern evening plan', type: 'activity', activityTypes: ['shopping', 'culture'], description: 'A classic Hoi An day that becomes smoother when fittings are treated as schedule anchors.', query: 'Hoi An tailor fitting evening lantern old town', reason: 'This stop benefits from one strong tactile day.' },
    { id: 'hanoi-food-tour', countryCode: 'VN', cityId: 'hanoi', title: 'Old Quarter food walk', type: 'activity', activityTypes: ['food', 'culture'], description: 'A clean way to make Hanoi feel alive instead of exhausting.', query: 'Hanoi Old Quarter street food tour', reason: 'Best used as one defined night rather than constant grazing.' },
    { id: 'sapa-trek-day', countryCode: 'VN', cityId: 'sapa', title: 'Village trekking day', type: 'activity', activityTypes: ['nature', 'hiking'], description: 'Worth shortlisting when the forecast leaves one strong mountain window.', query: 'Sapa village trekking day guide', reason: 'Weather-sensitive but high emotional payoff.' },
    { id: 'vang-vieng-river-day', countryCode: 'LA', cityId: 'vang-vieng', title: 'Nam Song tubing day', type: 'activity', activityTypes: ['adventure', 'nature'], description: 'The playful signature day if the route wants one high-energy Laos stop.', query: 'Vang Vieng Nam Song tubing', reason: 'Best as one clear active day, not the whole stay.' },
    { id: 'luang-prabang-waterfall', countryCode: 'LA', cityId: 'luang-prabang', title: 'Kuang Si waterfall day', type: 'activity', activityTypes: ['nature', 'sightseeing'], description: 'The cleanest scenic day trip for the calmest part of the route.', query: 'Luang Prabang Kuang Si waterfall day trip', reason: 'Strong scenic contrast without overcomplicating the stop.' },
];

const BUDGET_SCENARIOS: TripWorkspaceBudgetScenario[] = [
    { id: 'lean', label: 'Lean backpacker', vibe: 'Protect the route shape and highlights, but keep stays and transit choices disciplined.', dailyTarget: 48, totalEstimate: 1850, reserveBuffer: 190 },
    { id: 'balanced', label: 'Balanced trip', vibe: 'Comfortable stays, a few strong activity days, and enough slack for weather or border friction.', dailyTarget: 72, totalEstimate: 2740, reserveBuffer: 260 },
    { id: 'comfort', label: 'Comfort-first', vibe: 'Stronger stay choices, more direct handoffs, and less tolerance for transport friction.', dailyTarget: 108, totalEstimate: 4040, reserveBuffer: 360 },
];

const COUNTRY_BUDGET_FACTORS: Record<string, { stay: number; food: number; transport: number; activity: number; buffer: number }> = {
    TH: { stay: 32, food: 17, transport: 9, activity: 22, buffer: 6 },
    KH: { stay: 24, food: 13, transport: 8, activity: 19, buffer: 5 },
    VN: { stay: 27, food: 14, transport: 10, activity: 21, buffer: 5 },
    LA: { stay: 29, food: 14, transport: 9, activity: 18, buffer: 5 },
};

const parseTripDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    if ([year, month, day].every((part) => Number.isFinite(part))) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    const parsed = new Date(value);
    parsed.setHours(12, 0, 0, 0);
    return parsed;
};

const resolveCurrentRouteCityStop = (trip: ITrip, cityStops: ITimelineItem[]): ITimelineItem | null => {
    const tripStartDate = parseTripDate(trip.startDate);
    const todayAtNoon = new Date();
    todayAtNoon.setHours(12, 0, 0, 0);
    const dayOffset = Math.round((todayAtNoon.getTime() - tripStartDate.getTime()) / DAY_MILLISECONDS);

    return cityStops.find((item) => (
        dayOffset >= Math.floor(item.startDateOffset)
        && dayOffset < Math.ceil(item.startDateOffset + item.duration)
    )) ?? cityStops[0] ?? null;
};

export const getTripWorkspaceCountryGuide = (countryCode: string): TripWorkspaceCountryGuide | null =>
    COUNTRY_LOOKUP_BY_CODE.get(countryCode.toUpperCase()) ?? null;

export const getTripWorkspaceCityGuideById = (guideId: string): TripWorkspaceCityGuide | null =>
    CITY_LOOKUP_BY_ID.get(guideId) ?? null;

export const getTripWorkspaceCountryCities = (
    dataset: TripWorkspaceDemoDataset,
    countryCode: string | null,
): TripWorkspaceCityGuide[] => {
    if (!countryCode) return dataset.cities;
    return dataset.cities.filter((city) => city.countryCode === countryCode);
};

export const getTripWorkspaceCityGuide = (cityTitle: string): TripWorkspaceCityGuide | null => {
    const normalized = normalizeValue(cityTitle);
    return CITY_GUIDE_REGISTRY.find((city) => city.matchers.some((matcher) => normalized.includes(matcher))) ?? null;
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

const buildTripWorkspaceRouteGuides = (trip: ITrip): TripWorkspaceCityGuide[] => (
    resolveTripWorkspaceCityStops(trip.items)
        .map((item) => getTripWorkspaceCityGuide(item.title))
        .filter((guide): guide is TripWorkspaceCityGuide => Boolean(guide))
);

const buildRouteProgression = (cities: TripWorkspaceCityGuide[], cityStops: ITimelineItem[]): TripWorkspaceCountryProgress[] => {
    const dayTotals = new Map<string, number>();
    const cityCounts = new Map<string, number>();
    const countryNames = new Map<string, string>();

    cityStops.forEach((stop) => {
        const guide = getTripWorkspaceCityGuide(stop.title);
        if (!guide?.countryCode) return;
        dayTotals.set(guide.countryCode, (dayTotals.get(guide.countryCode) ?? 0) + stop.duration);
        cityCounts.set(guide.countryCode, (cityCounts.get(guide.countryCode) ?? 0) + 1);
        countryNames.set(guide.countryCode, guide.countryName ?? guide.countryCode);
    });

    const orderedCodes = cities.reduce<string[]>((codes, city) => {
        if (!city.countryCode || codes.includes(city.countryCode)) return codes;
        codes.push(city.countryCode);
        return codes;
    }, []);

    return orderedCodes.map((code) => ({
        code,
        name: countryNames.get(code) ?? code,
        cityCount: cityCounts.get(code) ?? 0,
        dayCount: Math.round(dayTotals.get(code) ?? 0),
    }));
};

const buildBorderCrossings = (cities: TripWorkspaceCityGuide[]): TripWorkspaceBorderCrossing[] => {
    const crossings: TripWorkspaceBorderCrossing[] = [];
    for (let index = 1; index < cities.length; index += 1) {
        const previous = cities[index - 1];
        const current = cities[index];
        if (!previous.countryCode || !current.countryCode || previous.countryCode === current.countryCode) continue;
        crossings.push({
            id: `${previous.id}-${current.id}`,
            fromCode: previous.countryCode,
            fromName: previous.countryName ?? previous.countryCode,
            toCode: current.countryCode,
            toName: current.countryName ?? current.countryCode,
            fromCityId: previous.id,
            toCityId: current.id,
            label: `${previous.countryName ?? previous.countryCode} → ${current.countryName ?? current.countryCode}`,
            detail: `${previous.title} to ${current.title} is the point where proof packets, cash rhythm, and timing matter most.`,
        });
    }
    return crossings;
};

const buildBudgetLineItems = (cities: TripWorkspaceCityGuide[], cityStops: ITimelineItem[]): TripWorkspaceBudgetLineItem[] => {
    const lineItems: TripWorkspaceBudgetLineItem[] = [];
    cityStops.forEach((stop, index) => {
        const guide = getTripWorkspaceCityGuide(stop.title);
        if (!guide?.countryCode) return;
        const factors = COUNTRY_BUDGET_FACTORS[guide.countryCode];
        if (!factors) return;
        const duration = Math.max(1, Math.round(stop.duration));

        lineItems.push(
            {
                id: `${guide.id}-stay`,
                countryCode: guide.countryCode,
                cityId: guide.id,
                title: `${guide.title} stays`,
                category: 'stay',
                status: index < 2 ? 'Locked' : index < 6 ? 'Flexible' : 'Watch',
                amount: factors.stay * duration,
                detail: `Stay pressure across ${duration} night${duration === 1 ? '' : 's'} in ${guide.title}.`,
            },
            {
                id: `${guide.id}-food`,
                countryCode: guide.countryCode,
                cityId: guide.id,
                title: `${guide.title} food rhythm`,
                category: 'food',
                status: 'Flexible',
                amount: factors.food * duration,
                detail: `Street-food plus café pace for ${guide.title}.`,
            },
            {
                id: `${guide.id}-activity`,
                countryCode: guide.countryCode,
                cityId: guide.id,
                title: `${guide.title} signature day`,
                category: 'activity',
                status: index % 3 === 0 ? 'Watch' : 'Flexible',
                amount: factors.activity,
                detail: `One high-signal activity allowance for ${guide.title}.`,
            },
        );
    });

    buildBorderCrossings(cities).forEach((crossing, index) => {
        const factor = COUNTRY_BUDGET_FACTORS[crossing.toCode] ?? COUNTRY_BUDGET_FACTORS[crossing.fromCode];
        if (!factor) return;
        lineItems.push({
            id: `${crossing.id}-transport`,
            countryCode: crossing.toCode,
            cityId: crossing.toCityId,
            title: crossing.label,
            category: 'transport',
            status: index < 1 ? 'Flexible' : 'Watch',
            amount: factor.transport * 2,
            detail: `Cross-border transport hinge between ${crossing.fromName} and ${crossing.toName}.`,
        });
    });

    const representedCountries = Array.from(new Set(cities.map((city) => city.countryCode).filter(Boolean))) as string[];
    representedCountries.forEach((countryCode) => {
        const factor = COUNTRY_BUDGET_FACTORS[countryCode];
        if (!factor) return;
        lineItems.push({
            id: `${countryCode}-buffer`,
            countryCode,
            cityId: cities.find((city) => city.countryCode === countryCode)?.id ?? '',
            title: `${countryCode} route buffer`,
            category: 'buffer',
            status: 'Watch',
            amount: factor.buffer * 3,
            detail: `Protects weather, border, and timing disruption across the ${countryCode} stretch.`,
        });
    });

    return lineItems;
};

const filterByRouteContext = <T extends { countryCode?: string; cityId?: string }>(
    entries: T[],
    routeCountryCodes: Set<string>,
    routeCityIds: Set<string>,
): T[] => entries.filter((entry) => {
    const matchesCountry = !entry.countryCode || routeCountryCodes.has(entry.countryCode);
    const matchesCity = !entry.cityId || routeCityIds.has(entry.cityId);
    return matchesCountry && matchesCity;
});

export const buildTripWorkspaceDemoDataset = (trip: ITrip): TripWorkspaceDemoDataset => {
    const cityStops = resolveTripWorkspaceCityStops(trip.items);
    const cities = buildTripWorkspaceCityGuides(trip);
    const routeGuides = buildTripWorkspaceRouteGuides(trip);
    const routeCityIds = new Set(cities.map((city) => city.id));
    const routeCountryCodes = new Set(
        cities.map((city) => city.countryCode).filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const progression = buildRouteProgression(cities, cityStops);
    const borderCrossings = buildBorderCrossings(routeGuides);
    const countries = progression
        .map((entry) => {
            const base = getTripWorkspaceCountryGuide(entry.code);
            if (!base) return null;
            return {
                ...base,
                routeCityIds: cities.filter((city) => city.countryCode === entry.code).map((city) => city.id),
                routeDayCount: entry.dayCount,
                cityCount: entry.cityCount,
            };
        })
        .filter((country): country is NonNullable<typeof country> => country !== null);

    return {
        routeSummary: {
            progression,
            borderCrossings,
            nextBorderCrossing: borderCrossings[0] ?? null,
            countryCount: progression.length,
            cityCount: cities.length,
        },
        countries,
        cities,
        bookings: filterByRouteContext(SEA_BOOKING_REGISTRY, routeCountryCodes, routeCityIds),
        notes: filterByRouteContext(SEA_NOTE_REGISTRY, routeCountryCodes, routeCityIds),
        photos: filterByRouteContext(SEA_PHOTO_REGISTRY, routeCountryCodes, routeCityIds),
        phrases: filterByRouteContext(PHRASE_CARD_REGISTRY, routeCountryCodes, routeCityIds),
        travelKitChecklist: filterByRouteContext(SEA_TRAVEL_KIT_CHECKLIST, routeCountryCodes, routeCityIds),
        travelKitUtilities: filterByRouteContext(SEA_TRAVEL_KIT_UTILITIES, routeCountryCodes, routeCityIds),
        travelKitEmergencyCards: filterByRouteContext(SEA_TRAVEL_KIT_EMERGENCY_CARDS, routeCountryCodes, routeCityIds),
        travelKitPacks: filterByRouteContext(SEA_TRAVEL_KIT_PACKS, routeCountryCodes, routeCityIds),
        documentRecords: filterByRouteContext(SEA_DOCUMENT_RECORDS, routeCountryCodes, routeCityIds),
        documentPackets: SEA_DOCUMENT_PACKETS.filter((packet) => !packet.countryCode || routeCountryCodes.has(packet.countryCode)),
        budgetScenarios: BUDGET_SCENARIOS,
        budgetLineItems: buildBudgetLineItems(cities, cityStops),
        weatherStops: cities
            .filter((city): city is TripWorkspaceCityGuide & { weather: TripWorkspaceCityWeatherProfile } => Boolean(city.weather))
            .map((city) => ({
                id: city.id,
                countryCode: city.countryCode,
                title: city.title,
                updateLine: city.weather.updateLine,
                headline: city.weather.headline,
                travelFeel: city.weather.travelFeel,
                caution: city.weather.caution,
                activityWindow: city.weather.activityWindow,
                seaNote: city.weather.seaNote,
                packNotes: city.weather.packNotes,
                forecast: city.weather.forecast,
                signals: city.weather.signals,
            })),
        exploreLeads: filterByRouteContext(SEA_EXPLORE_LEADS, routeCountryCodes, routeCityIds),
    };
};

export const normalizeTripWorkspaceContextSelection = (
    dataset: TripWorkspaceDemoDataset,
    selection?: Partial<TripWorkspaceContextSelection> | null,
): TripWorkspaceContextSelection => {
    const firstCountryCode = dataset.countries[0]?.code ?? null;
    const firstCityId = dataset.cities[0]?.id ?? null;
    const selectedCity = selection?.cityGuideId ? getTripWorkspaceCityGuideById(selection.cityGuideId) : null;
    const preferredCountry = selection?.countryCode
        && dataset.countries.some((country) => country.code === selection.countryCode)
        ? selection.countryCode
        : selectedCity?.countryCode ?? firstCountryCode;
    const countryCities = dataset.cities.filter((city) => city.countryCode === preferredCountry);
    const preferredCity = selection?.cityGuideId
        && countryCities.some((city) => city.id === selection.cityGuideId)
        ? selection.cityGuideId
        : countryCities[0]?.id ?? firstCityId;

    return {
        countryCode: preferredCountry ?? null,
        cityGuideId: preferredCity ?? null,
    };
};

export const resolveTripWorkspaceDefaultContextSelection = (
    trip: ITrip,
    dataset: TripWorkspaceDemoDataset,
    preferredCityTitle?: string | null,
): TripWorkspaceContextSelection => {
    const cityStops = resolveTripWorkspaceCityStops(trip.items);
    const preferredGuide = preferredCityTitle ? getTripWorkspaceCityGuide(preferredCityTitle) : null;
    const currentGuide = preferredGuide ?? (() => {
        const currentStop = resolveCurrentRouteCityStop(trip, cityStops);
        return currentStop ? getTripWorkspaceCityGuide(currentStop.title) : null;
    })();

    return normalizeTripWorkspaceContextSelection(dataset, {
        countryCode: currentGuide?.countryCode ?? null,
        cityGuideId: currentGuide?.id ?? null,
    });
};

export const getTripWorkspacePhraseCardsForCategory = (
    dataset: TripWorkspaceDemoDataset,
    category: PhraseCategory,
    countryCode?: string | null,
): TripWorkspacePhraseCard[] => dataset.phrases.filter((card) => {
    if (card.category !== category) return false;
    if (countryCode && card.countryCode !== countryCode) return false;
    return true;
});
