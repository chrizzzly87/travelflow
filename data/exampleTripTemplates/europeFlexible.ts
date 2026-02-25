import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const EUROPE_FLEXIBLE_TEMPLATE: Partial<ITrip> = {
    title: 'Mediterranean Forked Itinerary',
    countryInfo: {
        currencyCode: 'EUR',
        currencyName: 'Euro',
        exchangeRate: 1,
        languages: ['Spanish', 'Catalan', 'Italian'],
        electricSockets: 'Type C, F, L (230V)',
        visaInfoUrl: 'https://en.wikipedia.org/wiki/Visa_policy_of_the_Schengen_Area',
        auswaertigesAmtUrl: 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit',
    },
    items: [
        {
            id: 'city-bcn',
            type: 'city',
            title: 'Barcelona',
            startDateOffset: 0,
            duration: 3,
            color: '#2563eb',
            location: 'Barcelona, Spain',
            coordinates: { lat: 41.3851, lng: 2.1734 },
            description: 'Start in Barcelona with architecture, beach walks, and tapas.',
            cityPlanStatus: 'confirmed',
        },
        {
            id: 'city-valencia-option',
            type: 'city',
            title: 'Valencia',
            startDateOffset: 3,
            duration: 2,
            color: '#f97316',
            location: 'Valencia, Spain',
            coordinates: { lat: 39.4699, lng: -0.3763 },
            description: 'Option A: modern arts district and paella by the coast.',
            cityPlanStatus: 'uncertain',
            cityPlanGroupId: 'mediterranean-middle-leg',
            cityPlanOptionIndex: 0,
            isApproved: false,
        },
        {
            id: 'city-palma-option',
            type: 'city',
            title: 'Palma de Mallorca',
            startDateOffset: 3,
            duration: 2,
            color: '#06b6d4',
            location: 'Palma de Mallorca, Spain',
            coordinates: { lat: 39.5696, lng: 2.6502 },
            description: 'Option B: island base for coves and sunset viewpoints.',
            cityPlanStatus: 'uncertain',
            cityPlanGroupId: 'mediterranean-middle-leg',
            cityPlanOptionIndex: 1,
            isApproved: false,
        },
        {
            id: 'city-rome',
            type: 'city',
            title: 'Rome',
            startDateOffset: 5,
            duration: 3,
            color: '#dc2626',
            location: 'Rome, Italy',
            coordinates: { lat: 41.9028, lng: 12.4964 },
            description: 'Converge in Rome for the Colosseum, Trastevere, and Vatican highlights.',
            cityPlanStatus: 'confirmed',
        },
        {
            id: 'act-valencia-bike',
            type: 'activity',
            title: 'Cycle Turia Gardens',
            startDateOffset: 3.4,
            duration: 0.35,
            color: 'bg-emerald-100 border-emerald-300 text-emerald-900',
            location: 'Valencia',
            activityType: ['sports', 'nature'],
            description: 'Bike through the Turia river park and City of Arts and Sciences.',
        },
        {
            id: 'act-palma-boat',
            type: 'activity',
            title: 'Coastal Boat Day',
            startDateOffset: 3.5,
            duration: 0.35,
            color: 'bg-cyan-100 border-cyan-300 text-cyan-900',
            location: 'Palma de Mallorca',
            activityType: ['beach', 'adventure'],
            description: 'Explore nearby calas by boat and swim stops.',
        },
    ],
};

export const createEuropeFlexibleTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(EUROPE_FLEXIBLE_TEMPLATE);
    if (!validation.isValid) {
        console.error('Example Data Validation Failed:', validation.error);
        throw new Error(`Example Data Schema Error: ${validation.error}`);
    }

    const items = EUROPE_FLEXIBLE_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
    })) as ITimelineItem[];

    return {
        id: `trip-europe-flexible-${uniqueSuffix}`,
        title: EUROPE_FLEXIBLE_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: EUROPE_FLEXIBLE_TEMPLATE.countryInfo,
        items,
    };
};
