import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const PORTUGAL_TEMPLATE: Partial<ITrip> = {
    title: "Atlantic Coast Road Trip",
    countryInfo: {
        currencyCode: "EUR",
        currencyName: "Euro",
        exchangeRate: 1.0,
        languages: ["Portuguese"],
        electricSockets: "Type F (230V)",
        visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_the_Schengen_Area",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/portugal-node/portugalsicherheit/210890"
    },
    items: [
        {
            id: 'city-lis',
            type: 'city',
            title: 'Lisbon',
            startDateOffset: 0,
            duration: 3,
            color: 'bg-sky-200 border-sky-300 text-sky-900',
            location: 'Lisbon, Portugal',
            coordinates: { lat: 38.7223, lng: -9.1393 },
            description: "### Must See\n- [ ] Belém Tower & Jerónimos Monastery\n- [ ] Alfama district & São Jorge Castle\n- [ ] Praça do Comércio\n### Must Try\n- [ ] Pastéis de Belém (original custard tarts)\n- [ ] Bacalhau à Brás\n- [ ] Ginjinha cherry liqueur\n### Must Do\n- [ ] Ride Tram 28 through the historic quarters\n- [ ] Sunset at Miradouro da Graça\n- [ ] Explore LX Factory market",
            hotels: [
                { id: 'h-lis', name: 'Hotel Bairro Alto', address: 'Praça Luís de Camões 2, 1200-243 Lisboa, Portugal' }
            ]
        },
        {
            id: 'act-pasteis',
            type: 'activity',
            title: 'Pastéis de Belém Tasting',
            startDateOffset: 0.5,
            duration: 0.5,
            color: 'bg-sky-100 border-sky-300 text-sky-900',
            location: 'Rua de Belém 84-92, Lisbon',
            activityType: ['food', 'culture'],
            description: "Visit the original bakery making pastéis de nata since 1837. The secret recipe has been passed down and never changed.",
            aiInsights: {
                cost: "~€5-8 per person",
                bestTime: "08:00 - 10:00 (before the queues)",
                tips: "Order at the counter for faster service. Sprinkle cinnamon and powdered sugar on top like a local."
            }
        },
        {
            id: 'travel-lis-sin',
            type: 'travel',
            title: 'Train to Sintra',
            transportMode: 'train',
            startDateOffset: 3,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "40 min train from Rossio station"
        },
        {
            id: 'city-sin',
            type: 'city',
            title: 'Sintra',
            startDateOffset: 3,
            duration: 1.5,
            color: 'bg-blue-200 border-blue-300 text-blue-900',
            location: 'Sintra, Portugal',
            coordinates: { lat: 38.7981, lng: -9.3880 },
            description: "### Must See\n- [ ] Pena Palace\n- [ ] Quinta da Regaleira & Initiation Well\n- [ ] Moorish Castle ruins\n### Must Try\n- [ ] Travesseiros pastry at Piriquita\n- [ ] Queijadas de Sintra\n### Must Do\n- [ ] Walk through the Sintra-Cascais Natural Park\n- [ ] Visit Cabo da Roca (westernmost point of mainland Europe)"
        },
        {
            id: 'act-pena',
            type: 'activity',
            title: 'Pena Palace Visit',
            startDateOffset: 3.3,
            duration: 0.6,
            color: 'bg-blue-100 border-blue-300 text-blue-900',
            location: 'Estrada da Pena, Sintra',
            activityType: ['sightseeing', 'culture'],
            description: "Explore the colorful Romanticist palace perched on the hilltop of the Sintra Mountains. A UNESCO World Heritage Site with stunning panoramic views.",
            aiInsights: {
                cost: "€14 (palace + park)",
                bestTime: "09:30 opening — arrive early to avoid crowds",
                tips: "Buy tickets online in advance. Wear comfortable shoes for the steep paths. The park entrance alone is worth visiting."
            }
        },
        {
            id: 'travel-sin-prt',
            type: 'travel',
            title: 'Train to Porto',
            transportMode: 'train',
            startDateOffset: 4.5,
            duration: 0.3,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "~3h high-speed Alfa Pendular train via Lisbon Oriente"
        },
        {
            id: 'city-prt',
            type: 'city',
            title: 'Porto',
            startDateOffset: 4.5,
            duration: 3,
            color: 'bg-cyan-200 border-cyan-300 text-cyan-900',
            location: 'Porto, Portugal',
            coordinates: { lat: 41.1579, lng: -8.6291 },
            description: "### Must See\n- [ ] Ribeira district & Dom Luís I Bridge\n- [ ] Livraria Lello bookstore\n- [ ] São Bento railway station azulejo tiles\n### Must Try\n- [ ] Francesinha sandwich\n- [ ] Port wine in Vila Nova de Gaia\n- [ ] Bifana (pork sandwich)\n### Must Do\n- [ ] Walk across the top deck of Dom Luís I Bridge\n- [ ] Sunset cruise on the Douro River\n- [ ] Explore Bolhão Market",
            hotels: [
                { id: 'h-prt', name: 'The Yeatman', address: 'Rua do Choupelo 250, 4400-088 Vila Nova de Gaia, Portugal' }
            ]
        },
        {
            id: 'act-port-wine',
            type: 'activity',
            title: 'Port Wine Tasting in Gaia',
            startDateOffset: 5.5,
            duration: 0.5,
            color: 'bg-cyan-100 border-cyan-300 text-cyan-900',
            location: 'Vila Nova de Gaia, Porto',
            activityType: ['food', 'culture'],
            description: "Cross the Dom Luís I Bridge to Vila Nova de Gaia and visit the historic Port wine cellars along the waterfront.",
            aiInsights: {
                cost: "€15-25 per tasting (varies by cellar)",
                bestTime: "14:00 - 17:00",
                tips: "Try Taylor's or Graham's for the best cellar tours. Book a premium tasting to sample aged tawnies and vintage ports."
            }
        },
        {
            id: 'travel-prt-alg',
            type: 'travel',
            title: 'Drive to Algarve',
            transportMode: 'car',
            startDateOffset: 7.5,
            duration: 0.4,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "~4.5h drive via A2 motorway (or bus/FlixBus alternative)"
        },
        {
            id: 'city-alg',
            type: 'city',
            title: 'Algarve (Lagos)',
            startDateOffset: 7.5,
            duration: 2.5,
            color: 'bg-slate-200 border-slate-300 text-slate-900',
            location: 'Lagos, Algarve, Portugal',
            coordinates: { lat: 37.1028, lng: -8.6732 },
            description: "### Must See\n- [ ] Ponta da Piedade sea cliffs\n- [ ] Benagil Cave (boat tour)\n- [ ] Praia do Camilo\n### Must Try\n- [ ] Cataplana seafood stew\n- [ ] Fresh grilled sardines\n- [ ] Medronho (strawberry tree brandy)\n### Must Do\n- [ ] Kayak tour through the sea caves\n- [ ] Watch sunset at Cape St. Vincent (Sagres)\n- [ ] Explore Lagos old town & marina"
        }
    ]
};

export const createPortugalTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(PORTUGAL_TEMPLATE);
    if (!validation.isValid) {
        console.error("Test Data Validation Failed:", validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = PORTUGAL_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];

    return {
        id: `trip-portugal-${uniqueSuffix}`,
        title: PORTUGAL_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: PORTUGAL_TEMPLATE.countryInfo,
        items: items
    };
};
