import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const ICELAND_TEMPLATE: Partial<ITrip> = {
    title: "Ring Road Circuit",
    countryInfo: {
        currencyCode: "ISK",
        currencyName: "Icelandic Króna",
        exchangeRate: 152.0,
        languages: ["Icelandic"],
        electricSockets: "Type C, F (230V)",
        visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_the_Schengen_Area",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/island-node/islandsicherheit/223396"
    },
    items: [
        {
            id: 'city-rvk',
            type: 'city',
            title: 'Reykjavik',
            startDateOffset: 0,
            duration: 2,
            color: 'bg-indigo-200 border-indigo-300 text-indigo-900',
            location: 'Reykjavik, Iceland',
            coordinates: { lat: 64.1466, lng: -21.9426 },
            description: "### Must See\n- [ ] Hallgrímskirkja church & tower viewpoint\n- [ ] Harpa Concert Hall\n- [ ] Sun Voyager sculpture\n### Must Try\n- [ ] Icelandic lamb soup (kjötsúpa)\n- [ ] Skyr dessert\n- [ ] Pylsur (Icelandic hot dog) at Bæjarins Beztu\n### Must Do\n- [ ] Walk the colorful Laugavegur shopping street\n- [ ] Soak in a geothermal pool\n- [ ] Visit the National Museum of Iceland",
            hotels: [
                { id: 'h-rvk', name: 'CenterHotel Midgardur', address: 'Laugavegur 120, 105 Reykjavik, Iceland' }
            ]
        },
        {
            id: 'act-golden-circle',
            type: 'activity',
            title: 'Golden Circle Day Tour',
            startDateOffset: 0.3,
            duration: 0.7,
            color: 'bg-indigo-100 border-indigo-300 text-indigo-900',
            location: 'Þingvellir, Geysir & Gullfoss',
            activityType: ['sightseeing', 'nature'],
            description: "Full-day loop covering Iceland's three most iconic natural landmarks: the rift valley at Þingvellir National Park, the erupting Strokkur geyser, and the thundering Gullfoss waterfall.",
            aiInsights: {
                cost: "Free (self-drive) or ~€80 guided tour",
                bestTime: "08:00 start — full daylight in summer, shorter window in winter",
                tips: "Bring layers and waterproof clothing. Strokkur erupts every 5-10 minutes so be patient for the perfect photo. Stop at Friðheimar tomato farm for lunch."
            }
        },
        {
            id: 'travel-rvk-vik',
            type: 'travel',
            title: 'Drive to Vík',
            transportMode: 'car',
            startDateOffset: 2,
            duration: 0.25,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "~2.5h drive along Route 1 (Ring Road) past Seljalandsfoss & Skógafoss waterfalls"
        },
        {
            id: 'city-vik',
            type: 'city',
            title: 'Vík',
            startDateOffset: 2,
            duration: 2,
            color: 'bg-violet-200 border-violet-300 text-violet-900',
            location: 'Vík í Mýrdal, Iceland',
            coordinates: { lat: 63.4186, lng: -19.0060 },
            description: "### Must See\n- [ ] Reynisfjara black sand beach & basalt columns\n- [ ] Dyrhólaey arch & puffin cliffs\n- [ ] Seljalandsfoss & Skógafoss waterfalls (en route)\n### Must Try\n- [ ] Fresh-caught fish at a local restaurant\n- [ ] Icelandic rye bread (rúgbrauð)\n### Must Do\n- [ ] Walk behind Seljalandsfoss waterfall\n- [ ] Photograph Reynisdrangar sea stacks at sunset\n- [ ] Explore the village church on the hilltop"
        },
        {
            id: 'act-glacier-lagoon',
            type: 'activity',
            title: 'Jökulsárlón Glacier Lagoon',
            startDateOffset: 3,
            duration: 0.6,
            color: 'bg-violet-100 border-violet-300 text-violet-900',
            location: 'Jökulsárlón, Iceland',
            activityType: ['sightseeing', 'nature'],
            description: "Visit the stunning glacier lagoon filled with floating icebergs calved from Breiðamerkurjökull glacier. Walk across to Diamond Beach to see ice chunks glittering on black sand.",
            aiInsights: {
                cost: "Free entry; boat tour ~€45-60",
                bestTime: "10:00 - 14:00 for best light on the icebergs",
                tips: "Take the amphibian boat tour to get close to the icebergs. Diamond Beach across the road is a must-see. Dress warmly — wind off the glacier is cold even in summer."
            }
        },
        {
            id: 'travel-vik-aku',
            type: 'travel',
            title: 'Drive to Akureyri',
            transportMode: 'car',
            startDateOffset: 4,
            duration: 0.4,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "~5h drive continuing the Ring Road north through the highland plateau and Mývatn area"
        },
        {
            id: 'city-aku',
            type: 'city',
            title: 'Akureyri',
            startDateOffset: 4,
            duration: 3,
            color: 'bg-slate-200 border-slate-300 text-slate-900',
            location: 'Akureyri, Iceland',
            coordinates: { lat: 65.6835, lng: -18.0878 },
            description: "### Must See\n- [ ] Akureyrarkirkja church\n- [ ] Goðafoss waterfall (nearby)\n- [ ] Mývatn Nature Baths\n### Must Try\n- [ ] Fresh seafood at Rub23\n- [ ] Icelandic craft beer at Einstök brewery\n### Must Do\n- [ ] Stroll the botanical garden (northernmost in the world)\n- [ ] Day trip to Dettifoss — Europe's most powerful waterfall\n- [ ] Explore the heart-shaped traffic lights"
        },
        {
            id: 'act-whale-watching',
            type: 'activity',
            title: 'Whale Watching from Akureyri',
            startDateOffset: 5,
            duration: 0.5,
            color: 'bg-slate-100 border-slate-300 text-slate-900',
            location: 'Akureyri Harbour, Iceland',
            activityType: ['wildlife', 'nature'],
            description: "Sail into Eyjafjörður, Iceland's longest fjord, for a chance to spot humpback whales, dolphins, and porpoises in their natural habitat.",
            aiInsights: {
                cost: "~€75-90 per person",
                bestTime: "June - September for highest sighting rates (near 100%)",
                tips: "Book with a traditional sailing company for a quieter experience. Bring binoculars, a warm hat, and seasickness tablets if needed. Tours run ~3 hours."
            }
        }
    ]
};

export const createIcelandTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(ICELAND_TEMPLATE);
    if (!validation.isValid) {
        console.error("Test Data Validation Failed:", validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = ICELAND_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];

    return {
        id: `trip-iceland-${uniqueSuffix}`,
        title: ICELAND_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: ICELAND_TEMPLATE.countryInfo,
        items: items
    };
};
