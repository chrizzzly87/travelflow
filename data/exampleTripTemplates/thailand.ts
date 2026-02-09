import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const THAILAND_TEMPLATE: Partial<ITrip> = {
    title: "Thailand Explorer (Test Plan)",
    countryInfo: {
        currencyCode: "THB",
        currencyName: "Thai Baht",
        exchangeRate: 39.5,
        languages: ["Thai"],
        electricSockets: "Type A, B, C, F, O (220V)",
        visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_Thailand",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/thailand-node/thailandsicherheit/201558"
    },
    items: [
        {
            id: 'city-bkk',
            type: 'city',
            title: 'Bangkok',
            startDateOffset: 0,
            duration: 4,
            color: 'bg-rose-200 border-rose-300 text-rose-900',
            location: 'Bangkok, Thailand',
            coordinates: { lat: 13.7563, lng: 100.5018 },
            description: "### Must See\n- [ ] Grand Palace\n- [ ] Wat Arun\n- [ ] Chatuchak Market\n### Must Try\n- [ ] Pad Thai at Thip Samai\n- [ ] Mango Sticky Rice\n- [ ] Tom Yum Goong\n### Must Do\n- [ ] Boat ride on Chao Phraya\n- [ ] Rooftop Bar at sunset",
            hotels: [
                { id: 'h-bkk', name: 'Lebua at State Tower', address: '1055 Si Lom, Silom, Bang Rak, Bangkok 10500, Thailand' }
            ]
        },
        {
            id: 'act-songkran',
            type: 'activity',
            title: 'Songkran Festival',
            startDateOffset: 0.5,
            duration: 1,
            color: 'bg-blue-100 border-blue-300 text-blue-900',
            location: 'Silom Road, Bangkok',
            activityType: ['culture', 'adventure'],
            description: "World's biggest water fight celebrating Thai New Year.",
            aiInsights: {
                cost: "Free",
                bestTime: "10:00 - 18:00",
                tips: "Buy a waterproof phone pouch and water gun!"
            }
        },
        {
            id: 'travel-bkk-cnx',
            type: 'travel',
            title: 'Flight to Chiang Mai',
            transportMode: 'plane',
            startDateOffset: 4,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "1h 15m Flight"
        },
        {
            id: 'city-cnx',
            type: 'city',
            title: 'Chiang Mai',
            startDateOffset: 4,
            duration: 5,
            color: 'bg-emerald-200 border-emerald-300 text-emerald-900',
            location: 'Chiang Mai, Thailand',
            coordinates: { lat: 18.7883, lng: 98.9853 },
            description: "### Must See\n- [ ] Doi Suthep Temple\n- [ ] Old City Temples\n### Must Try\n- [ ] Khao Soi (Curry Noodles)\n### Must Do\n- [ ] Sunday Night Walking Street"
        },
        {
            id: 'act-ele',
            type: 'activity',
            title: 'Elephant Nature Park',
            startDateOffset: 5.5,
            duration: 0.8,
            color: 'bg-green-100 border-green-300 text-green-900',
            location: 'Chiang Mai Province',
            activityType: ['wildlife', 'nature'],
            description: "Spend a day with rescued elephants. No riding.",
            aiInsights: {
                cost: "~2500 THB",
                bestTime: "Full Day (08:00 - 17:00)",
                tips: "Book weeks in advance."
            }
        },
        {
            id: 'travel-cnx-pai',
            type: 'travel',
            title: 'Minivan to Pai',
            transportMode: 'bus',
            startDateOffset: 9,
            duration: 0.25,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "Winding road with 762 curves"
        },
        {
            id: 'city-pai',
            type: 'city',
            title: 'Pai',
            startDateOffset: 9,
            duration: 3,
            color: 'bg-teal-200 border-teal-300 text-teal-900',
            location: 'Pai, Mae Hong Son',
            coordinates: { lat: 19.3582, lng: 98.4405 },
            description: "Relaxed hippie vibe in the mountains."
        },
        {
            id: 'travel-pai-hkt',
            type: 'travel',
            title: 'Travel to Phuket',
            transportMode: 'plane',
            startDateOffset: 12,
            duration: 0.4,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "Bus back to Chiang Mai, then flight to Phuket"
        },
        {
            id: 'city-hkt',
            type: 'city',
            title: 'Phuket',
            startDateOffset: 12,
            duration: 4,
            color: 'bg-cyan-200 border-cyan-300 text-cyan-900',
            location: 'Phuket, Thailand',
            coordinates: { lat: 7.8804, lng: 98.3923 },
            description: "Beaches, Nightlife, and Island Tours."
        },
        {
            id: 'travel-hkt-pp',
            type: 'travel',
            title: 'Ferry to Phi Phi',
            transportMode: 'boat',
            startDateOffset: 16,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "Ferry from Rassada Pier"
        },
        {
            id: 'city-pp',
            type: 'city',
            title: 'Ko Phi Phi',
            startDateOffset: 16,
            duration: 3,
            color: 'bg-indigo-200 border-indigo-300 text-indigo-900',
            location: 'Ko Phi Phi Don',
            coordinates: { lat: 7.7407, lng: 98.7784 },
            description: "The Beach (Maya Bay) and viewpoints."
        },
        {
            id: 'act-dive',
            type: 'activity',
            title: 'Scuba Diving',
            startDateOffset: 17.5,
            duration: 0.5,
            color: 'bg-blue-100 border-blue-300 text-blue-900',
            location: 'Phi Phi Leh',
            activityType: ['sports', 'nature'],
            description: "Discover the coral reefs.",
        },
        {
            id: 'travel-pp-kb',
            type: 'travel',
            title: 'Boat to Krabi',
            transportMode: 'boat',
            startDateOffset: 19,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "Speedboat to Ao Nang"
        },
        {
            id: 'city-kb',
            type: 'city',
            title: 'Krabi (Ao Nang)',
            startDateOffset: 19,
            duration: 5,
            color: 'bg-orange-200 border-orange-300 text-orange-900',
            location: 'Ao Nang, Krabi',
            coordinates: { lat: 8.0363, lng: 98.8239 },
            description: "Railay Beach, Rock Climbing, and Thale Waek."
        },
        {
            id: 'travel-kb-bkk',
            type: 'travel',
            title: 'Flight to Bangkok',
            transportMode: 'plane',
            startDateOffset: 24,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "Return to capital"
        },
        {
            id: 'city-bkk-end',
            type: 'city',
            title: 'Bangkok',
            startDateOffset: 24,
            duration: 2,
            color: 'bg-rose-200 border-rose-300 text-rose-900',
            location: 'Bangkok, Thailand',
            coordinates: { lat: 13.7563, lng: 100.5018 },
            description: "Last minute shopping at MBK and Siam Paragon."
        }
    ]
};

export const createThailandTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(THAILAND_TEMPLATE);
    if (!validation.isValid) {
        console.error("Test Data Validation Failed:", validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = THAILAND_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];

    return {
        id: `trip-thailand-test-${uniqueSuffix}`,
        title: THAILAND_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: THAILAND_TEMPLATE.countryInfo,
        items: items
    };
};
