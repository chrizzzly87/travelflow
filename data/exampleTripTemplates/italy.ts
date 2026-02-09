import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const ITALY_TEMPLATE: Partial<ITrip> = {
    title: "Italian Grand Tour",
    countryInfo: {
        currencyCode: "EUR",
        currencyName: "Euro",
        exchangeRate: 1.0,
        languages: ["Italian"],
        electricSockets: "Type F, L (230V)",
        visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_the_Schengen_Area",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/italien-node/italiensicherheit/211322"
    },
    items: [
        {
            id: 'city-rome',
            type: 'city',
            title: 'Rome',
            startDateOffset: 0,
            duration: 4,
            color: 'bg-amber-200 border-amber-300 text-amber-900',
            location: 'Rome, Italy',
            coordinates: { lat: 41.9028, lng: 12.4964 },
            description: "### Must See\n- [ ] Colosseum & Roman Forum\n- [ ] Vatican Museums & Sistine Chapel\n- [ ] Pantheon\n- [ ] Trevi Fountain\n### Must Try\n- [ ] Cacio e Pepe at Roscioli\n- [ ] Supplì (fried rice balls)\n- [ ] Gelato at Giolitti\n### Must Do\n- [ ] Sunset walk along the Tiber\n- [ ] Explore Trastevere at night\n- [ ] Toss a coin at Trevi Fountain",
            hotels: [
                { id: 'h-rome', name: 'Hotel de Russie', address: 'Via del Babuino, 9, 00187 Roma RM, Italy' }
            ]
        },
        {
            id: 'act-colosseum',
            type: 'activity',
            title: 'Colosseum & Forum Tour',
            startDateOffset: 0.5,
            duration: 0.5,
            color: 'bg-red-100 border-red-300 text-red-900',
            location: 'Piazza del Colosseo, Rome',
            coordinates: { lat: 41.8902, lng: 12.4922 },
            activityType: ['culture', 'sightseeing'],
            description: "Guided tour of the Colosseum, Roman Forum, and Palatine Hill including underground chambers.",
            aiInsights: {
                cost: "~€25-40 per person",
                bestTime: "08:30 - early entry avoids crowds",
                tips: "Book skip-the-line tickets at least a week ahead. Underground and arena floor access requires a special ticket."
            }
        },
        {
            id: 'act-vatican',
            type: 'activity',
            title: 'Vatican Museums & Sistine Chapel',
            startDateOffset: 1.5,
            duration: 0.5,
            color: 'bg-violet-100 border-violet-300 text-violet-900',
            location: 'Vatican City',
            coordinates: { lat: 41.9065, lng: 12.4536 },
            activityType: ['culture', 'sightseeing'],
            description: "Explore the vast Vatican Museums and marvel at Michelangelo's Sistine Chapel ceiling.",
            aiInsights: {
                cost: "~€17 per person",
                bestTime: "Wednesday mornings (Papal audience clears crowds inside)",
                tips: "Book online to skip the enormous queue. No shorts or bare shoulders allowed inside St. Peter's."
            }
        },
        {
            id: 'travel-rome-florence',
            type: 'travel',
            title: 'Train to Florence',
            transportMode: 'train',
            startDateOffset: 4,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "1h 30m High-speed Frecciarossa from Roma Termini to Firenze S.M.N."
        },
        {
            id: 'city-florence',
            type: 'city',
            title: 'Florence',
            startDateOffset: 4,
            duration: 3,
            color: 'bg-yellow-200 border-yellow-300 text-yellow-900',
            location: 'Florence, Italy',
            coordinates: { lat: 43.7696, lng: 11.2558 },
            description: "### Must See\n- [ ] Uffizi Gallery\n- [ ] Duomo & Brunelleschi's Dome\n- [ ] Ponte Vecchio\n- [ ] Piazzale Michelangelo\n### Must Try\n- [ ] Bistecca alla Fiorentina\n- [ ] Lampredotto sandwich\n- [ ] Chianti wine tasting\n### Must Do\n- [ ] Climb the Duomo for panoramic views\n- [ ] Browse leather goods at San Lorenzo Market\n- [ ] Sunset from Piazzale Michelangelo",
            hotels: [
                { id: 'h-florence', name: 'Hotel Lungarno', address: 'Borgo San Jacopo, 14, 50125 Firenze FI, Italy' }
            ]
        },
        {
            id: 'act-uffizi',
            type: 'activity',
            title: 'Uffizi Gallery Visit',
            startDateOffset: 4.5,
            duration: 0.4,
            color: 'bg-pink-100 border-pink-300 text-pink-900',
            location: 'Piazzale degli Uffizi, Florence',
            coordinates: { lat: 43.7677, lng: 11.2553 },
            activityType: ['culture', 'sightseeing'],
            description: "Home to Botticelli's Birth of Venus, works by Leonardo, Raphael, and Caravaggio.",
            aiInsights: {
                cost: "~€20-25 per person",
                bestTime: "Tuesday-Friday mornings, less crowded",
                tips: "Reserve a timed-entry ticket online. Plan 3-4 hours minimum — it's massive."
            }
        },
        {
            id: 'travel-florence-cinqueterre',
            type: 'travel',
            title: 'Train to Cinque Terre',
            transportMode: 'train',
            startDateOffset: 7,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "2h 30m Regional train from Firenze S.M.N. to La Spezia, then local to Riomaggiore"
        },
        {
            id: 'city-cinqueterre',
            type: 'city',
            title: 'Cinque Terre',
            startDateOffset: 7,
            duration: 2,
            color: 'bg-orange-200 border-orange-300 text-orange-900',
            location: 'Cinque Terre, Italy',
            coordinates: { lat: 44.1286, lng: 9.7097 },
            description: "### Must See\n- [ ] Riomaggiore's colorful harbor\n- [ ] Manarola at sunset\n- [ ] Vernazza from the trail above\n### Must Try\n- [ ] Fresh pesto with trofie pasta\n- [ ] Fried seafood cone (fritto misto)\n- [ ] Local Sciacchetrà dessert wine\n### Must Do\n- [ ] Hike the Sentiero Azzurro trail\n- [ ] Swim at Monterosso beach\n- [ ] Take the local train between all 5 villages"
        },
        {
            id: 'travel-cinqueterre-venice',
            type: 'travel',
            title: 'Train to Venice',
            transportMode: 'train',
            startDateOffset: 9,
            duration: 0.3,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "4h Train from La Spezia to Venezia Santa Lucia (via Milan or Florence)"
        },
        {
            id: 'city-venice',
            type: 'city',
            title: 'Venice',
            startDateOffset: 9,
            duration: 3,
            color: 'bg-amber-300 border-amber-400 text-amber-900',
            location: 'Venice, Italy',
            coordinates: { lat: 45.4408, lng: 12.3155 },
            description: "### Must See\n- [ ] St. Mark's Basilica & Square\n- [ ] Doge's Palace\n- [ ] Rialto Bridge & Market\n- [ ] Murano glass island\n### Must Try\n- [ ] Cicchetti (Venetian tapas) at a bacaro\n- [ ] Sarde in saor (sweet & sour sardines)\n- [ ] Spritz Aperol at a canalside bar\n### Must Do\n- [ ] Gondola ride through the canals\n- [ ] Get lost in the narrow alleyways\n- [ ] Visit Burano for colorful houses"
        },
        {
            id: 'act-gondola',
            type: 'activity',
            title: 'Gondola Ride',
            startDateOffset: 10,
            duration: 0.15,
            color: 'bg-sky-100 border-sky-300 text-sky-900',
            location: 'Grand Canal, Venice',
            coordinates: { lat: 45.4375, lng: 12.3358 },
            activityType: ['relaxation', 'sightseeing'],
            description: "Classic Venetian gondola ride through the Grand Canal and smaller waterways.",
            aiInsights: {
                cost: "€80 daytime / €100 after 19:00 (per gondola, up to 6 people)",
                bestTime: "Late afternoon for golden light on the palazzi",
                tips: "Negotiate the route before boarding. Shared gondolas from near St. Mark's are cheaper at ~€33/person."
            }
        },
        {
            id: 'travel-venice-amalfi',
            type: 'travel',
            title: 'Train to Amalfi Coast',
            transportMode: 'train',
            startDateOffset: 12,
            duration: 0.4,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "5h High-speed train Venice to Naples, then Circumvesuviana + ferry to Amalfi"
        },
        {
            id: 'city-amalfi',
            type: 'city',
            title: 'Amalfi Coast',
            startDateOffset: 12,
            duration: 3,
            color: 'bg-yellow-300 border-yellow-400 text-yellow-900',
            location: 'Amalfi Coast, Italy',
            coordinates: { lat: 40.6333, lng: 14.6029 },
            description: "### Must See\n- [ ] Positano cliffside village\n- [ ] Ravello's Villa Rufolo gardens\n- [ ] Amalfi Cathedral\n### Must Try\n- [ ] Limoncello (locally made)\n- [ ] Fresh seafood risotto\n- [ ] Delizia al Limone pastry\n### Must Do\n- [ ] Hike the Path of the Gods (Sentiero degli Dei)\n- [ ] Boat trip along the coast\n- [ ] Visit the Emerald Grotto"
        },
        {
            id: 'act-pathofgods',
            type: 'activity',
            title: 'Path of the Gods Hike',
            startDateOffset: 13,
            duration: 0.5,
            color: 'bg-lime-100 border-lime-300 text-lime-900',
            location: 'Bomerano to Nocelle, Amalfi Coast',
            coordinates: { lat: 40.6380, lng: 14.5550 },
            activityType: ['hiking', 'nature'],
            description: "Spectacular cliffside trail high above the Amalfi Coast with breathtaking Mediterranean views.",
            aiInsights: {
                cost: "Free (bus to trailhead ~€2)",
                bestTime: "Early morning (07:00-08:00 start) to avoid midday heat",
                tips: "Start from Bomerano and hike downhill to Nocelle. Wear sturdy shoes. Bring plenty of water — no shade for long stretches."
            }
        },
        {
            id: 'travel-amalfi-milan',
            type: 'travel',
            title: 'Train to Milan',
            transportMode: 'train',
            startDateOffset: 15,
            duration: 0.4,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "5h Ferry to Salerno, then high-speed Frecciarossa to Milano Centrale"
        },
        {
            id: 'city-milan',
            type: 'city',
            title: 'Milan',
            startDateOffset: 15,
            duration: 3,
            color: 'bg-orange-300 border-orange-400 text-orange-900',
            location: 'Milan, Italy',
            coordinates: { lat: 45.4642, lng: 9.1900 },
            description: "### Must See\n- [ ] Duomo di Milano & rooftop\n- [ ] The Last Supper (Santa Maria delle Grazie)\n- [ ] Galleria Vittorio Emanuele II\n### Must Try\n- [ ] Risotto alla Milanese\n- [ ] Cotoletta alla Milanese\n- [ ] Aperitivo with free buffet in Navigli\n### Must Do\n- [ ] Climb the Duomo terraces\n- [ ] Stroll the Navigli canal district\n- [ ] Browse luxury fashion in Quadrilatero della Moda"
        }
    ]
};

export const createItalyTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(ITALY_TEMPLATE);
    if (!validation.isValid) {
        console.error("Test Data Validation Failed:", validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = ITALY_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];

    return {
        id: `trip-italy-${uniqueSuffix}`,
        title: ITALY_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: ITALY_TEMPLATE.countryInfo,
        items: items
    };
};
