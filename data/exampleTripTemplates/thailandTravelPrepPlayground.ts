import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const THAILAND_TRAVEL_PREP_PLAYGROUND_TEMPLATE: Partial<ITrip> = {
    title: 'Thailand Travel Prep Playground',
    countryInfo: {
        countryCode: 'TH',
        countryName: 'Thailand',
        currencyCode: 'THB',
        currencyName: 'Thai Baht',
        exchangeRate: 43.35,
        languages: ['Thai'],
        electricSockets: 'Type A, Type B, Type C, Type O (220V / 50Hz)',
        visaInfoUrl: 'https://www.gov.uk/foreign-travel-advice/thailand/entry-requirements',
        auswaertigesAmtUrl: 'https://www.auswaertiges-amt.de/de/service/laender/thailand-node/thailandsicherheit/201558',
        travelGuide: {
            title: 'Thailand travel-prep snapshot',
            summary: 'This hidden example trip turns country-guide content into a planner companion so TravelFlow can test trip-prep UX before shipping public country pages.',
            disclaimer: 'Testing snapshot only. Practical details, prices, and advisories can change quickly. Verify current official travel advice before departure.',
            quickFacts: [
                {
                    label: 'Visa-free stay',
                    value: 'Up to 60 days',
                    helper: 'Tourism stays can usually be extended once for up to 30 more days.',
                    tone: 'accent',
                },
                {
                    label: 'Arrival card',
                    value: 'Complete it within 3 days before arrival',
                    helper: 'Best model: treat this as a dated reminder attached to the trip.',
                    tone: 'warning',
                },
                {
                    label: 'Local SIM snapshot',
                    value: '15 GB for about 499 THB',
                    helper: 'Useful as a planning signal, but this should move to a fresher data source later.',
                    tone: 'neutral',
                },
                {
                    label: 'Emergency numbers',
                    value: '191 / 1669 / 199',
                    helper: 'Police, ambulance, and fire services.',
                    tone: 'warning',
                },
            ],
            sections: [
                {
                    id: 'entry',
                    eyebrow: 'Before you fly',
                    title: 'Entry requirements',
                    summary: 'The highest-value planning content is passport validity, visa-free duration, arrival-card timing, and overstay risk.',
                    bullets: [
                        'Passport should stay valid for at least 6 months after arrival and have at least 1 blank page.',
                        'Visa-free tourism stays can run up to 60 days, with a one-time extension path for many travelers.',
                        'The digital arrival card belongs in a countdown reminder, not buried in long-form copy.',
                        'Overstay risk is serious enough to surface as a clear warning before departure.',
                    ],
                    tone: 'accent',
                },
                {
                    id: 'safety',
                    eyebrow: 'Travel advice',
                    title: 'Safety and legal rules',
                    summary: 'The strongest safety layer is short, practical, and action-led: border disruptions, drinks, valuables, rental rules, and local legal traps.',
                    bullets: [
                        'Active tensions near the Malaysia and Cambodia borders should stay visible as a compact warning banner.',
                        'Do not leave drinks unattended in tourist nightlife areas and keep bags secure around motorbikes and tuk-tuks.',
                        'Vapes and e-cigarettes can lead to fines or detention, so this should be a top-level legal warning.',
                        'Do not hand over your passport as rental collateral for scooters, jet-skis, or similar hires.',
                    ],
                    tone: 'warning',
                },
                {
                    id: 'health',
                    eyebrow: 'Stay healthy',
                    title: 'Health and insurance',
                    summary: 'Travel health content works best as insurance, mosquito, and water-safety prompts instead of long encyclopedia text.',
                    bullets: [
                        'Comprehensive travel insurance should cover medical treatment and repatriation.',
                        'Dengue and other mosquito-borne risks make bite prevention a practical packing and reminder input.',
                        'Traveler hygiene prompts should focus on food, water, and heat management, especially on beach-heavy itineraries.',
                    ],
                    tone: 'neutral',
                },
                {
                    id: 'money',
                    eyebrow: 'On the ground',
                    title: 'Payments, cash, and tipping',
                    summary: 'Card confidence, cash fallback, and lightweight tipping guidance add immediate practical value in trip-prep mode.',
                    bullets: [
                        'Cards work well in many tourist areas, but markets, small shops, and street food still lean cash-first.',
                        'A quick tipping snapshot is more useful than a long etiquette article: round up taxis, small change in cafes, and 10-15% for strong restaurant service.',
                        'This category should eventually connect to trip budgeting and expense split features.',
                    ],
                    tone: 'accent',
                },
            ],
            utilities: [
                {
                    label: 'Power',
                    value: '220V / 50Hz',
                    helper: 'Thailand commonly uses Types A, B, C, and O. UK adapters are usually needed.',
                },
                {
                    label: 'Wi-Fi snapshot',
                    value: 'Around 50 Mbps',
                    helper: 'Hotels, cafes, and malls often have free Wi-Fi. Mobile data remains the better fallback.',
                },
                {
                    label: 'Mobile coverage',
                    value: '4G and 5G are common on major tourist routes',
                    helper: 'A local SIM is usually easier than relying on roaming.',
                },
                {
                    label: 'British Embassy Bangkok',
                    value: '+66 (0)2 305 8333',
                    helper: '14 Wireless Road, Bangkok 10330.',
                },
            ],
            officialLinks: [
                {
                    label: 'UK travel advice for Thailand',
                    url: 'https://www.gov.uk/foreign-travel-advice/thailand',
                    helper: 'Use this for current entry, safety, and legal guidance.',
                },
                {
                    label: 'Thailand entry requirements',
                    url: 'https://www.gov.uk/foreign-travel-advice/thailand/entry-requirements',
                    helper: 'Best source for passport, visa-free stay, and arrival requirement checks.',
                },
                {
                    label: 'British Embassy Bangkok',
                    url: 'https://www.gov.uk/world/organisations/british-embassy-bangkok',
                    helper: 'Embassy contact details and consular support entry point.',
                },
            ],
            updates: [
                {
                    id: 'hire',
                    category: 'Vehicle hire',
                    ageLabel: 'Reference snapshot',
                    title: 'Scooter hire and insurance wording got sharper',
                    summary: 'A strong example of why guide updates should become a compact change feed with timestamps and clear action implications.',
                },
                {
                    id: 'border',
                    category: 'Border risk',
                    ageLabel: 'Reference snapshot',
                    title: 'Border disruption advice became more explicit',
                    summary: 'This belongs in a warning banner and in trip-prep reminders when a route gets close to affected regions.',
                },
            ],
        },
    },
    items: [
        {
            id: 'city-bangkok-arrival',
            type: 'city',
            title: 'Bangkok',
            startDateOffset: 0,
            duration: 2,
            color: 'bg-rose-200 border-rose-300 text-rose-900',
            location: 'Bangkok, Thailand',
            coordinates: { lat: 13.7563, lng: 100.5018 },
            description: 'Arrival buffer, temple circuit, river dinner, and a first-night setup base for cards, cash, and local SIM testing.',
            hotels: [
                {
                    id: 'hotel-bkk-playground',
                    name: 'The Standard, Bangkok Mahanakhon',
                    address: '114 Naradhiwas Rajanagarindra Rd, Silom, Bang Rak, Bangkok 10500, Thailand',
                },
            ],
        },
        {
            id: 'activity-bkk-arrival-card',
            type: 'activity',
            title: 'Arrival-card and insurance check',
            startDateOffset: 0.2,
            duration: 0.2,
            color: 'bg-amber-100 border-amber-300 text-amber-900',
            location: 'Bangkok',
            activityType: ['general'],
            description: 'Testing placeholder for future trip-prep tasks: arrival card, insurance screenshot, and embassy contact save.',
            aiInsights: {
                cost: 'Free',
                bestTime: 'Before departure',
                tips: 'This activity exists to test future reminder and prep-state UI.',
            },
        },
        {
            id: 'travel-bkk-cnx-prep',
            type: 'travel',
            title: 'Flight to Chiang Mai',
            transportMode: 'plane',
            startDateOffset: 2,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: 'Short domestic flight to start the inland leg.',
        },
        {
            id: 'city-chiang-mai-prep',
            type: 'city',
            title: 'Chiang Mai',
            startDateOffset: 2,
            duration: 3,
            color: 'bg-emerald-200 border-emerald-300 text-emerald-900',
            location: 'Chiang Mai, Thailand',
            coordinates: { lat: 18.7883, lng: 98.9853 },
            description: 'Temple mornings, café work sessions, and a good place to test health, safety, and road-hire guidance surfaces.',
        },
        {
            id: 'activity-chiang-mai-hire',
            type: 'activity',
            title: 'Scooter-hire risk checkpoint',
            startDateOffset: 3.2,
            duration: 0.3,
            color: 'bg-blue-100 border-blue-300 text-blue-900',
            location: 'Chiang Mai',
            activityType: ['adventure', 'culture'],
            description: 'Playground activity for rental guidance, helmet reminders, and no-passport-deposit warnings.',
            aiInsights: {
                cost: 'Variable',
                bestTime: 'Morning pickup',
                tips: 'Ideal scenario for future legal-warning chips and checklist tasks.',
            },
        },
        {
            id: 'travel-cnx-hkt-prep',
            type: 'travel',
            title: 'Flight to Phuket',
            transportMode: 'plane',
            startDateOffset: 5,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: 'Move south for the beach and ferry testing leg.',
        },
        {
            id: 'city-phuket-prep',
            type: 'city',
            title: 'Phuket',
            startDateOffset: 5,
            duration: 3,
            color: 'bg-cyan-200 border-cyan-300 text-cyan-900',
            location: 'Phuket, Thailand',
            coordinates: { lat: 7.8804, lng: 98.3923 },
            description: 'Base for beach time, mobile-data testing, and a realistic card-vs-cash scenario in a tourist-heavy zone.',
        },
        {
            id: 'travel-phuket-krabi-prep',
            type: 'travel',
            title: 'Boat transfer to Krabi',
            transportMode: 'boat',
            startDateOffset: 8,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: 'Ferry-style leg for weather and sea-condition notes.',
        },
        {
            id: 'city-krabi-prep',
            type: 'city',
            title: 'Krabi',
            startDateOffset: 8,
            duration: 4,
            color: 'bg-orange-200 border-orange-300 text-orange-900',
            location: 'Ao Nang, Krabi, Thailand',
            coordinates: { lat: 8.0363, lng: 98.8239 },
            description: 'Railay cliffs, long-tail transfers, and monsoon-aware beach safety testing.',
        },
        {
            id: 'activity-krabi-red-flag',
            type: 'activity',
            title: 'Beach red-flag awareness',
            startDateOffset: 9.1,
            duration: 0.2,
            color: 'bg-red-100 border-red-300 text-red-900',
            location: 'Railay Beach',
            activityType: ['beach', 'nature'],
            description: 'Scenario placeholder for surf warnings, monsoon-season caution, and emergency-contact visibility.',
            aiInsights: {
                cost: 'Free',
                bestTime: 'Before swimming',
                tips: 'Pairs well with future weather and trip-alert integrations.',
            },
        },
        {
            id: 'travel-krabi-bkk-prep',
            type: 'travel',
            title: 'Flight back to Bangkok',
            transportMode: 'plane',
            startDateOffset: 12,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: 'Final city handoff for departure prep.',
        },
        {
            id: 'city-bangkok-departure',
            type: 'city',
            title: 'Bangkok',
            startDateOffset: 12,
            duration: 1,
            color: 'bg-rose-200 border-rose-300 text-rose-900',
            location: 'Bangkok, Thailand',
            coordinates: { lat: 13.7563, lng: 100.5018 },
            description: 'Departure night with airport transfer, remaining cash burn-down, and airport-ready checklist review.',
        },
    ],
};

export const createThailandTravelPrepPlaygroundTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(THAILAND_TRAVEL_PREP_PLAYGROUND_TEMPLATE);
    if (!validation.isValid) {
        console.error('Test Data Validation Failed:', validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = THAILAND_TRAVEL_PREP_PLAYGROUND_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map((hotel) => ({ ...hotel, id: `${hotel.id}-${uniqueSuffix}` })),
    })) as ITimelineItem[];

    return {
        id: `trip-thailand-travel-prep-${uniqueSuffix}`,
        title: THAILAND_TRAVEL_PREP_PLAYGROUND_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: THAILAND_TRAVEL_PREP_PLAYGROUND_TEMPLATE.countryInfo,
        items,
    };
};
