import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const NEW_ZEALAND_TEMPLATE: Partial<ITrip> = {
    title: "South Island Wilderness",
    countryInfo: {
        currencyCode: "NZD",
        currencyName: "New Zealand Dollar",
        exchangeRate: 1.85,
        languages: ["English", "Māori"],
        electricSockets: "Type I (230V)",
        visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_New_Zealand",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/neuseeland-node/neuseelandsicherheit/220146"
    },
    items: [
        {
            id: 'city-chc',
            type: 'city',
            title: 'Christchurch',
            startDateOffset: 0,
            duration: 2,
            color: 'bg-teal-200 border-teal-300 text-teal-900',
            location: 'Christchurch, New Zealand',
            coordinates: { lat: -43.5321, lng: 172.6362 },
            description: "### Must See\n- [ ] Christchurch Botanic Gardens\n- [ ] Cardboard Cathedral\n- [ ] Re:START Mall\n### Must Try\n- [ ] Flat White at C1 Espresso\n- [ ] Fish & Chips at The Smokehouse\n### Must Do\n- [ ] Punting on the Avon River\n- [ ] Pick up rental car & supplies",
            hotels: [
                { id: 'h-chc', name: 'The George Christchurch', address: '50 Park Terrace, Christchurch Central, Christchurch 8013, New Zealand' }
            ]
        },
        {
            id: 'travel-chc-kai',
            type: 'travel',
            title: 'Drive to Kaikoura',
            transportMode: 'car',
            startDateOffset: 2,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "2.5h scenic coastal drive via SH1"
        },
        {
            id: 'city-kai',
            type: 'city',
            title: 'Kaikoura',
            startDateOffset: 2,
            duration: 2,
            color: 'bg-emerald-200 border-emerald-300 text-emerald-900',
            location: 'Kaikoura, New Zealand',
            coordinates: { lat: -42.4008, lng: 173.6814 },
            description: "### Must See\n- [ ] Kaikoura Peninsula Walkway\n- [ ] Seal Colony at Point Kean\n### Must Try\n- [ ] Crayfish from Nin's Bin\n### Must Do\n- [ ] Whale watching tour\n- [ ] Sunrise at the beach"
        },
        {
            id: 'act-whale',
            type: 'activity',
            title: 'Whale Watching Kaikoura',
            startDateOffset: 2.5,
            duration: 0.5,
            color: 'bg-cyan-100 border-cyan-300 text-cyan-900',
            location: 'Kaikoura, New Zealand',
            activityType: ['wildlife', 'nature'],
            description: "Encounter sperm whales, dusky dolphins, and albatross off the Kaikoura coast.",
            aiInsights: {
                cost: "~160 NZD per person",
                bestTime: "Early morning (06:00 - 10:00)",
                tips: "Book at least 2 weeks ahead. Take seasickness tablets if needed. Refund offered if no whales spotted."
            }
        },
        {
            id: 'travel-kai-abel',
            type: 'travel',
            title: 'Drive to Abel Tasman',
            transportMode: 'car',
            startDateOffset: 4,
            duration: 0.25,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "5h drive via SH1 and SH6 through Blenheim and Nelson"
        },
        {
            id: 'city-abel',
            type: 'city',
            title: 'Abel Tasman',
            startDateOffset: 4,
            duration: 3,
            color: 'bg-green-200 border-green-300 text-green-900',
            location: 'Abel Tasman National Park, New Zealand',
            coordinates: { lat: -40.8833, lng: 172.9000 },
            description: "### Must See\n- [ ] Split Apple Rock\n- [ ] Cleopatra's Pool\n- [ ] Torrent Bay\n### Must Do\n- [ ] Kayak the coastline\n- [ ] Walk part of the Abel Tasman Coast Track\n- [ ] Water taxi to secluded beaches"
        },
        {
            id: 'act-kayak',
            type: 'activity',
            title: 'Abel Tasman Kayak Tour',
            startDateOffset: 5,
            duration: 0.8,
            color: 'bg-green-100 border-green-300 text-green-900',
            location: 'Abel Tasman National Park',
            activityType: ['adventure', 'nature'],
            description: "Paddle through golden bays, spot fur seals, and land on pristine beaches only reachable by water.",
            aiInsights: {
                cost: "~120 NZD half day / ~195 NZD full day",
                bestTime: "Full day (08:30 - 16:30)",
                tips: "Full day tour is worth it — includes beach lunch. Bring reef-safe sunscreen and dry bag for phone."
            }
        },
        {
            id: 'travel-abel-franz',
            type: 'travel',
            title: 'Drive to Franz Josef',
            transportMode: 'car',
            startDateOffset: 7,
            duration: 0.3,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "6h drive down the wild West Coast via SH6 — Buller Gorge, Pancake Rocks stop"
        },
        {
            id: 'city-franz',
            type: 'city',
            title: 'Franz Josef',
            startDateOffset: 7,
            duration: 3,
            color: 'bg-cyan-200 border-cyan-300 text-cyan-900',
            location: 'Franz Josef Glacier, New Zealand',
            coordinates: { lat: -43.3872, lng: 170.1834 },
            description: "### Must See\n- [ ] Franz Josef Glacier viewpoint\n- [ ] Lake Matheson (mirror lake)\n### Must Try\n- [ ] Hot pools at Franz Josef Glacier Hot Pools\n### Must Do\n- [ ] Heli-hike on the glacier\n- [ ] Sunset walk to Lake Matheson"
        },
        {
            id: 'act-glacier',
            type: 'activity',
            title: 'Franz Josef Glacier Heli-Hike',
            startDateOffset: 8,
            duration: 0.5,
            color: 'bg-sky-100 border-sky-300 text-sky-900',
            location: 'Franz Josef Glacier',
            activityType: ['adventure', 'nature'],
            description: "Helicopter onto the glacier, then strap on crampons and explore ice caves, seracs, and blue ice formations with an expert guide.",
            aiInsights: {
                cost: "~499 NZD per person",
                bestTime: "Morning departures (08:30 - 11:00)",
                tips: "Weather-dependent — book for your first day so you have backup days. Wear sturdy shoes, all gear provided."
            }
        },
        {
            id: 'travel-franz-wan',
            type: 'travel',
            title: 'Drive to Wanaka',
            transportMode: 'car',
            startDateOffset: 10,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "3.5h drive via Haast Pass — stunning river valleys and rainforest"
        },
        {
            id: 'city-wan',
            type: 'city',
            title: 'Wanaka',
            startDateOffset: 10,
            duration: 2,
            color: 'bg-lime-200 border-lime-300 text-lime-900',
            location: 'Wanaka, New Zealand',
            coordinates: { lat: -44.6980, lng: 169.1320 },
            description: "### Must See\n- [ ] That Wanaka Tree\n- [ ] Roys Peak (weather permitting)\n### Must Try\n- [ ] Brunch at Federal Diner\n### Must Do\n- [ ] Lakefront walk at sunset\n- [ ] Puzzling World"
        },
        {
            id: 'travel-wan-qtn',
            type: 'travel',
            title: 'Drive to Queenstown',
            transportMode: 'car',
            startDateOffset: 12,
            duration: 0.1,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "1h scenic drive via Crown Range Road — highest paved road in NZ"
        },
        {
            id: 'city-qtn',
            type: 'city',
            title: 'Queenstown',
            startDateOffset: 12,
            duration: 4,
            color: 'bg-teal-200 border-teal-300 text-teal-900',
            location: 'Queenstown, New Zealand',
            coordinates: { lat: -45.0312, lng: 168.6626 },
            description: "### Must See\n- [ ] Skyline Gondola & Luge\n- [ ] Bob's Peak viewpoint\n- [ ] Arrowtown historic village\n### Must Try\n- [ ] Fergburger (iconic burger joint)\n- [ ] Patagonia Chocolates\n### Must Do\n- [ ] Bungee at Kawarau Bridge\n- [ ] Jet boat on Shotover River\n- [ ] Lake Wakatipu sunset cruise",
            hotels: [
                { id: 'h-qtn', name: 'Eichardt\'s Private Hotel', address: 'Marine Parade, Queenstown 9300, New Zealand' }
            ]
        },
        {
            id: 'act-bungee',
            type: 'activity',
            title: 'Kawarau Bridge Bungee',
            startDateOffset: 13,
            duration: 0.3,
            color: 'bg-teal-100 border-teal-300 text-teal-900',
            location: 'Kawarau Bridge, Queenstown',
            activityType: ['adventure', 'sports'],
            description: "Jump 43m from the world's first commercial bungee site over the turquoise Kawarau River.",
            aiInsights: {
                cost: "~235 NZD per person",
                bestTime: "Anytime during opening hours (09:00 - 17:00)",
                tips: "Photos & video package available (~50 NZD extra). No booking needed but arrive early in peak season."
            }
        },
        {
            id: 'travel-qtn-mil',
            type: 'travel',
            title: 'Drive to Milford Sound',
            transportMode: 'car',
            startDateOffset: 16,
            duration: 0.25,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "4h drive through Te Anau and Homer Tunnel — stop at Mirror Lakes"
        },
        {
            id: 'city-mil',
            type: 'city',
            title: 'Milford Sound',
            startDateOffset: 16,
            duration: 2,
            color: 'bg-sky-200 border-sky-300 text-sky-900',
            location: 'Milford Sound, Fiordland, New Zealand',
            coordinates: { lat: -44.6714, lng: 167.9256 },
            description: "### Must See\n- [ ] Mitre Peak\n- [ ] Stirling Falls\n- [ ] Bowen Falls\n### Must Do\n- [ ] Overnight cruise on the fiord\n- [ ] Kayak beneath the waterfalls\n- [ ] Milford Track day walk"
        },
        {
            id: 'act-cruise',
            type: 'activity',
            title: 'Milford Sound Cruise',
            startDateOffset: 16.5,
            duration: 0.5,
            color: 'bg-sky-100 border-sky-300 text-sky-900',
            location: 'Milford Sound, Fiordland',
            activityType: ['nature', 'sightseeing'],
            description: "Cruise past towering Mitre Peak, through mist from Stirling Falls, and spot dolphins, seals, and penguins in the fiord.",
            aiInsights: {
                cost: "~95 NZD scenic cruise / ~600 NZD overnight cruise",
                bestTime: "Midday departures (11:00 - 13:00) for best light",
                tips: "Rainy days are actually spectacular — hundreds of temporary waterfalls appear. Bring layers, it's cold on deck."
            }
        },
        {
            id: 'travel-mil-qtn2',
            type: 'travel',
            title: 'Drive back to Queenstown',
            transportMode: 'car',
            startDateOffset: 18,
            duration: 0.25,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "4h return drive via Te Anau"
        },
        {
            id: 'city-qtn-end',
            type: 'city',
            title: 'Queenstown',
            startDateOffset: 18,
            duration: 3,
            color: 'bg-slate-200 border-slate-300 text-slate-900',
            location: 'Queenstown, New Zealand',
            coordinates: { lat: -45.0312, lng: 168.6626 },
            description: "### Final Days\n- [ ] Wine tasting in Gibbston Valley\n- [ ] Onsen Hot Pools\n- [ ] Glenorchy & Paradise day trip\n### Last Minute\n- [ ] Pick up souvenirs on the Mall\n- [ ] Return rental car\n- [ ] Final Fergburger"
        }
    ]
};

export const createNewZealandTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(NEW_ZEALAND_TEMPLATE);
    if (!validation.isValid) {
        console.error("Test Data Validation Failed:", validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = NEW_ZEALAND_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];

    return {
        id: `trip-new-zealand-${uniqueSuffix}`,
        title: NEW_ZEALAND_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: NEW_ZEALAND_TEMPLATE.countryInfo,
        items: items
    };
};
