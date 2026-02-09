import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const PERU_TEMPLATE: Partial<ITrip> = {
    title: "Andes & Amazon Explorer",
    countryInfo: {
        currencyCode: "PEN",
        currencyName: "Peruvian Sol",
        exchangeRate: 4.1,
        languages: ["Spanish", "Quechua"],
        electricSockets: "Type A, B, C (220V)",
        visaInfoUrl: "https://en.wikipedia.org/wiki/Visa_policy_of_Peru",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/service/laender/peru-node/perusicherheit/211938"
    },
    items: [
        {
            id: 'city-lima',
            type: 'city',
            title: 'Lima',
            startDateOffset: 0,
            duration: 3,
            color: 'bg-orange-200 border-orange-300 text-orange-900',
            location: 'Lima, Peru',
            coordinates: { lat: -12.0464, lng: -77.0428 },
            description: "### Must See\n- [ ] Plaza Mayor & Cathedral\n- [ ] Larco Museum\n- [ ] Barranco District\n### Must Try\n- [ ] Ceviche at La Mar\n- [ ] Pisco Sour\n- [ ] Lomo Saltado\n### Must Do\n- [ ] Walk the Malecon in Miraflores\n- [ ] Explore Huaca Pucllana ruins",
            hotels: [
                { id: 'h-lima', name: 'Belmond Miraflores Park', address: 'Av. Malecón de la Reserva 1035, Miraflores, Lima 15074, Peru' }
            ]
        },
        {
            id: 'act-ceviche',
            type: 'activity',
            title: 'Ceviche Cooking Class',
            startDateOffset: 1,
            duration: 0.5,
            color: 'bg-amber-100 border-amber-300 text-amber-900',
            location: 'Miraflores, Lima',
            activityType: ['food', 'culture'],
            description: "Learn to prepare authentic Peruvian ceviche, causa, and pisco sour with a local chef in a hands-on market-to-table experience.",
            aiInsights: {
                cost: "~150 PEN per person",
                bestTime: "10:00 - 14:00",
                tips: "Includes a visit to Surquillo Market to pick fresh ingredients. Vegetarian options available on request."
            }
        },
        {
            id: 'travel-lima-cusco',
            type: 'travel',
            title: 'Flight to Cusco',
            transportMode: 'plane',
            startDateOffset: 3,
            duration: 0.2,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "1h 20m flight — take altitude sickness medication before landing (3,400 m)"
        },
        {
            id: 'city-cusco',
            type: 'city',
            title: 'Cusco',
            startDateOffset: 3,
            duration: 4,
            color: 'bg-amber-200 border-amber-300 text-amber-900',
            location: 'Cusco, Peru',
            coordinates: { lat: -13.5320, lng: -71.9675 },
            description: "### Must See\n- [ ] Plaza de Armas\n- [ ] Sacsayhuaman fortress\n- [ ] Qorikancha (Temple of the Sun)\n### Must Try\n- [ ] Coca tea for altitude\n- [ ] Alpaca steak\n- [ ] Chicha Morada\n### Must Do\n- [ ] San Pedro Market\n- [ ] Walk San Blas neighborhood\n- [ ] Acclimatize on day 1 — take it slow",
            hotels: [
                { id: 'h-cusco', name: 'Belmond Hotel Monasterio', address: 'Calle Palacio 136, Plazoleta Nazarenas, Cusco 08000, Peru' }
            ]
        },
        {
            id: 'act-rainbow',
            type: 'activity',
            title: 'Rainbow Mountain Trek',
            startDateOffset: 4.5,
            duration: 1,
            color: 'bg-yellow-100 border-yellow-300 text-yellow-900',
            location: 'Vinicunca, Cusipata',
            activityType: ['hiking', 'nature'],
            description: "Full-day guided trek to Vinicunca (Rainbow Mountain) at 5,200 m elevation. Stunning striped mineral formations.",
            aiInsights: {
                cost: "~250 PEN with transport & guide",
                bestTime: "04:00 departure, best light 09:00 - 11:00",
                tips: "Only attempt after 2+ days acclimatizing in Cusco. Bring warm layers, sunscreen, and snacks. Horseback assistance available for tired hikers."
            }
        },
        {
            id: 'travel-cusco-sv',
            type: 'travel',
            title: 'Drive to Sacred Valley',
            transportMode: 'car',
            startDateOffset: 7,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "1.5h drive through the Urubamba Valley with stops at viewpoints"
        },
        {
            id: 'city-sv',
            type: 'city',
            title: 'Sacred Valley',
            startDateOffset: 7,
            duration: 2,
            color: 'bg-yellow-200 border-yellow-300 text-yellow-900',
            location: 'Ollantaytambo, Sacred Valley',
            coordinates: { lat: -13.2588, lng: -72.2635 },
            description: "### Must See\n- [ ] Ollantaytambo ruins\n- [ ] Moray circular terraces\n- [ ] Maras salt mines\n### Must Do\n- [ ] Explore Pisac ruins & market\n- [ ] Walk through Ollantaytambo village streets"
        },
        {
            id: 'travel-sv-mp',
            type: 'travel',
            title: 'PeruRail to Machu Picchu',
            transportMode: 'train',
            startDateOffset: 9,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "1h 45m scenic train from Ollantaytambo to Aguas Calientes — book Vistadome for panoramic windows"
        },
        {
            id: 'city-mp',
            type: 'city',
            title: 'Machu Picchu',
            startDateOffset: 9,
            duration: 2,
            color: 'bg-lime-200 border-lime-300 text-lime-900',
            location: 'Machu Picchu, Aguas Calientes',
            coordinates: { lat: -13.1631, lng: -72.5450 },
            description: "### Must See\n- [ ] Intihuatana stone\n- [ ] Temple of the Sun\n- [ ] Room of the Three Windows\n### Must Do\n- [ ] Enter at sunrise (first slot 06:00)\n- [ ] Hike Huayna Picchu (book months ahead)\n- [ ] Walk the Sun Gate (Inti Punku)"
        },
        {
            id: 'act-incatrail',
            type: 'activity',
            title: 'Inca Trail Day Hike',
            startDateOffset: 9.5,
            duration: 0.8,
            color: 'bg-lime-100 border-lime-300 text-lime-900',
            location: 'Machu Picchu',
            activityType: ['hiking', 'culture'],
            description: "Guided short Inca Trail hike from km 104 to the Sun Gate, arriving at Machu Picchu from above — the classic approach.",
            aiInsights: {
                cost: "~600 PEN (permit + guide)",
                bestTime: "Start 06:00, arrive Sun Gate ~14:00",
                tips: "Permits sell out months in advance. Bring rain gear, sturdy boots, and at least 2L of water. Moderate-to-hard difficulty."
            }
        },
        {
            id: 'travel-mp-cusco',
            type: 'travel',
            title: 'Train & Drive to Cusco',
            transportMode: 'train',
            startDateOffset: 11,
            duration: 0.3,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "PeruRail back to Ollantaytambo, then transfer to Cusco airport"
        },
        {
            id: 'travel-cusco-pm',
            type: 'travel',
            title: 'Flight to Puerto Maldonado',
            transportMode: 'plane',
            startDateOffset: 11,
            duration: 0.15,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "45m flight from Cusco to the Amazon lowlands"
        },
        {
            id: 'city-pm',
            type: 'city',
            title: 'Puerto Maldonado',
            startDateOffset: 11,
            duration: 3,
            color: 'bg-stone-200 border-stone-300 text-stone-900',
            location: 'Puerto Maldonado, Madre de Dios',
            coordinates: { lat: -12.5933, lng: -69.1891 },
            description: "### Must See\n- [ ] Tambopata National Reserve\n- [ ] Sandoval Lake (giant otters)\n- [ ] Canopy walkway\n### Must Try\n- [ ] Fresh jungle fruit juices\n- [ ] Juane (rice wrapped in bijao leaves)\n### Must Do\n- [ ] Night jungle walk\n- [ ] Macaw clay lick at dawn\n- [ ] Piranha fishing"
        },
        {
            id: 'act-amazon',
            type: 'activity',
            title: 'Amazon Jungle Tour',
            startDateOffset: 12,
            duration: 1,
            color: 'bg-green-100 border-green-300 text-green-900',
            location: 'Tambopata National Reserve',
            activityType: ['wildlife', 'nature', 'adventure'],
            description: "Full-day guided expedition deep into Tambopata Reserve — spot monkeys, macaws, caimans, and giant river otters at Sandoval Lake.",
            aiInsights: {
                cost: "~350 PEN (included in most lodge packages)",
                bestTime: "05:30 departure for best wildlife sightings",
                tips: "Wear long sleeves and DEET repellent. Bring binoculars and a waterproof camera. Dry season (May-Oct) has easier trails; wet season has more wildlife."
            }
        },
        {
            id: 'travel-pm-lima',
            type: 'travel',
            title: 'Flight to Lima',
            transportMode: 'plane',
            startDateOffset: 14,
            duration: 0.25,
            color: 'bg-stone-800 border-stone-600 text-stone-100',
            description: "2h flight via Cusco or direct to Lima"
        },
        {
            id: 'city-lima-end',
            type: 'city',
            title: 'Lima',
            startDateOffset: 14,
            duration: 2,
            color: 'bg-orange-200 border-orange-300 text-orange-900',
            location: 'Lima, Peru',
            coordinates: { lat: -12.0464, lng: -77.0428 },
            description: "### Last Days\n- [ ] Fine dining at Central or Maido\n- [ ] Pick up souvenirs at Inka Market\n- [ ] Sunset at Parque del Amor\n- [ ] Last pisco sour at Ayahuasca Bar"
        }
    ]
};

export const createPeruTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();

    const validation = validateTripSchema(PERU_TEMPLATE);
    if (!validation.isValid) {
        console.error("Test Data Validation Failed:", validation.error);
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = PERU_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];

    return {
        id: `trip-peru-${uniqueSuffix}`,
        title: PERU_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: PERU_TEMPLATE.countryInfo,
        items: items
    };
};
