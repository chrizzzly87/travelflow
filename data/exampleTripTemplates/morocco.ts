import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const MOROCCO_TEMPLATE: Partial<ITrip> = {
    title: "Medinas & Sahara Nights",
    countryInfo: {
        currencyCode: "MAD",
        currencyName: "Moroccan Dirham",
        exchangeRate: 11.0,
        languages: ["Arabic", "French", "Berber"],
        electricSockets: "Type C, E (220V)",
        visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_Morocco",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/marokko-node/marokkosicherheit/224080"
    },
    items: [
        {
            id: 'city-mkc',
            type: 'city',
            title: 'Marrakech',
            startDateOffset: 0,
            duration: 3,
            color: 'bg-yellow-200 border-yellow-300 text-yellow-900',
            location: 'Marrakech, Morocco',
            coordinates: { lat: 31.6295, lng: -7.9811 },
            description: "### Must See\n- [ ] Jemaa el-Fnaa square\n- [ ] Bahia Palace\n- [ ] Koutoubia Mosque & gardens\n### Must Try\n- [ ] Tagine with preserved lemons\n- [ ] Mint tea at a rooftop café\n- [ ] Freshly squeezed orange juice from the square\n### Must Do\n- [ ] Get lost in the souks of the Medina\n- [ ] Visit the Majorelle Garden\n- [ ] Hammam spa experience",
            hotels: [
                { id: 'h-mkc', name: 'Riad Yasmine', address: 'Kaat Benahid, 43 Derb El Arsa, Marrakech 40000, Morocco' }
            ]
        },
        {
            id: 'act-jemaa',
            type: 'activity',
            title: 'Jemaa el-Fnaa Food Tour',
            startDateOffset: 0.6,
            duration: 0.5,
            color: 'bg-yellow-100 border-yellow-300 text-yellow-900',
            location: 'Jemaa el-Fnaa, Marrakech',
            activityType: ['food', 'culture'],
            description: "Explore the iconic night market with a local guide, sampling street food stalls serving snail soup, grilled meats, and traditional Moroccan sweets.",
            aiInsights: {
                cost: "~€20-35 per person (guided tour with tastings)",
                bestTime: "18:00 - 21:00 (when the square comes alive)",
                tips: "Go with a guide to find the best stalls and avoid tourist traps. Bring cash in small MAD denominations. Try the tangia and sheep head if you're adventurous."
            }
        },
        {
            id: 'travel-mkc-chf',
            type: 'travel',
            title: 'Bus to Chefchaouen',
            transportMode: 'bus',
            startDateOffset: 3,
            duration: 0.4,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "~8-9h bus via CTM or Supratours (overnight or early departure recommended)"
        },
        {
            id: 'city-chf',
            type: 'city',
            title: 'Chefchaouen',
            startDateOffset: 3,
            duration: 2,
            color: 'bg-amber-200 border-amber-300 text-amber-900',
            location: 'Chefchaouen, Morocco',
            coordinates: { lat: 35.1688, lng: -5.2636 },
            description: "### Must See\n- [ ] Blue-washed Medina streets\n- [ ] Kasbah Museum & gardens\n- [ ] Ras El Maa waterfall\n### Must Try\n- [ ] Goat cheese from the Rif Mountains\n- [ ] Ras el hanout spiced dishes\n- [ ] Bissara (fava bean soup)\n### Must Do\n- [ ] Sunrise photography walk through the blue streets\n- [ ] Hike to the Spanish Mosque viewpoint\n- [ ] Shop for handwoven blankets and leather goods"
        },
        {
            id: 'act-blue-city',
            type: 'activity',
            title: 'Blue City Photography Walk',
            startDateOffset: 3.3,
            duration: 0.5,
            color: 'bg-amber-100 border-amber-300 text-amber-900',
            location: 'Medina, Chefchaouen',
            activityType: ['sightseeing', 'culture'],
            description: "Wander through the famously blue-painted alleys of Chefchaouen's Medina at golden hour. Every corner offers a postcard-worthy shot.",
            aiInsights: {
                cost: "Free (self-guided) or ~€15-20 with a local photo guide",
                bestTime: "07:00 - 09:00 (soft morning light, empty streets)",
                tips: "Start early before day-trippers arrive. The quieter northern alleys have the most vivid blues. Respect locals — always ask before photographing people."
            }
        },
        {
            id: 'travel-chf-fes',
            type: 'travel',
            title: 'Bus to Fes',
            transportMode: 'bus',
            startDateOffset: 5,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "~4h bus via CTM from Chefchaouen to Fes"
        },
        {
            id: 'city-fes',
            type: 'city',
            title: 'Fes',
            startDateOffset: 5,
            duration: 2,
            color: 'bg-orange-200 border-orange-300 text-orange-900',
            location: 'Fes, Morocco',
            coordinates: { lat: 34.0181, lng: -5.0078 },
            description: "### Must See\n- [ ] Fes el-Bali (oldest medina in the world)\n- [ ] Chouara Tannery (leather dyeing pits)\n- [ ] Bou Inania Madrasa\n### Must Try\n- [ ] Pastilla (sweet & savory pigeon pie)\n- [ ] Mechoui (slow-roasted lamb)\n- [ ] Moroccan harira soup\n### Must Do\n- [ ] Hire a local guide for the labyrinthine medina\n- [ ] Visit a traditional pottery workshop\n- [ ] Explore the spice and textile souks",
            hotels: [
                { id: 'h-fes', name: 'Riad Fes Maya Suite & Spa', address: '12 Derb Bennis, Ziat, Fes Medina 30110, Morocco' }
            ]
        },
        {
            id: 'travel-fes-mrz',
            type: 'travel',
            title: 'Drive to Merzouga',
            transportMode: 'car',
            startDateOffset: 7,
            duration: 0.4,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "~7-8h drive through the Middle Atlas and Ziz Gorge — scenic route via Ifrane and Errachidia"
        },
        {
            id: 'city-mrz',
            type: 'city',
            title: 'Merzouga / Sahara',
            startDateOffset: 7,
            duration: 2,
            color: 'bg-red-200 border-red-300 text-red-900',
            location: 'Merzouga, Morocco',
            coordinates: { lat: 31.0802, lng: -4.0133 },
            description: "### Must See\n- [ ] Erg Chebbi sand dunes\n- [ ] Sunrise over the Sahara\n- [ ] Starry night sky (zero light pollution)\n### Must Try\n- [ ] Berber pizza (madfouna)\n- [ ] Traditional desert tea ceremony\n- [ ] Sand-baked bread\n### Must Do\n- [ ] Camel trek into the dunes at sunset\n- [ ] Overnight in a luxury desert camp\n- [ ] Sandboarding on the dunes"
        },
        {
            id: 'act-sahara-trek',
            type: 'activity',
            title: 'Sahara Camel Trek & Desert Camp',
            startDateOffset: 7.5,
            duration: 1,
            color: 'bg-red-100 border-red-300 text-red-900',
            location: 'Erg Chebbi, Merzouga',
            activityType: ['adventure', 'nature'],
            description: "Ride camels into the Erg Chebbi dunes at sunset, spend the night in a Berber desert camp with traditional drumming, dinner under the stars, and a breathtaking Sahara sunrise.",
            aiInsights: {
                cost: "~€50-120 per person (depending on camp tier)",
                bestTime: "Depart 16:00 for sunset trek, return after sunrise",
                tips: "Book a mid-range or luxury camp for proper bedding and hot showers. Bring a warm layer — desert nights drop to 5-10°C even in spring. Charge your camera fully beforehand."
            }
        }
    ]
};

export const createMoroccoTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(MOROCCO_TEMPLATE);
    if (!validation.isValid) {
        console.error("Test Data Validation Failed:", validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = MOROCCO_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];

    return {
        id: `trip-morocco-${uniqueSuffix}`,
        title: MOROCCO_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: MOROCCO_TEMPLATE.countryInfo,
        items: items
    };
};
