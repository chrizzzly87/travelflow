import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const HUSUM_KROKUS_WEEKEND_TEMPLATE: Partial<ITrip> = {
    title: 'Husum Krokusblütenfest Wochenende',
    countryInfo: {
        currencyCode: 'EUR',
        currencyName: 'Euro',
        exchangeRate: 1,
        languages: ['Deutsch'],
        electricSockets: 'Typ C und F (230V)',
        visaInfoUrl: 'https://www.bmi.bund.de/EN/topics/migration/entry-residence/entry-residence-node.html',
        auswaertigesAmtUrl: 'https://www.auswaertiges-amt.de/',
    },
    items: [
        {
            id: 'hus-city-center',
            type: 'city',
            title: 'Husum',
            startDateOffset: 0,
            duration: 3,
            color: 'bg-violet-200 border-violet-300 text-violet-900',
            location: 'Husum, Schleswig-Holstein, Deutschland',
            coordinates: { lat: 54.4765, lng: 9.0513 },
            description:
                '### Wochenende im Überblick\n- [ ] Freitag: Hafenrunde, Tine und Krabbenbrötchen\n- [ ] Samstag: Krokusblütenfest im Schloßpark und Altstadtbummel\n- [ ] Sonntag: Dockkoog, Wattenmeer und entspannter Abschluss\n\n### Gute Basis\n- [ ] Unterkunft in Laufweite zum Marktplatz\n- [ ] Früh starten für den Schloßpark (bestes Licht und weniger Andrang)\n- [ ] Für das Wattenmeer windfeste Kleidung einpacken',
        },
        {
            id: 'hus-act-friday-harbor',
            type: 'activity',
            title: 'Husumer Hafen & Tine-Rundgang',
            startDateOffset: 0.25,
            duration: 0.3,
            color: 'bg-sky-100 border-sky-300 text-sky-900',
            location: 'Binnenhafen und Marktplatz Husum',
            coordinates: { lat: 54.4768, lng: 9.0508 },
            activityType: ['sightseeing', 'culture'],
            description:
                'Starte am Binnenhafen, laufe durch die Gassen der Altstadt und schau am Tine-Brunnen vorbei. Besonders am späten Nachmittag wirkt die Hafenfront mit den Giebeln am schönsten.',
            aiInsights: {
                cost: 'Kostenfrei',
                bestTime: '16:00 - 18:30',
                tips: 'Ein kleiner Abstecher zum Theodor-Storm-Haus passt perfekt auf dem Weg.',
            },
        },
        {
            id: 'hus-act-krabbenbroetchen',
            type: 'activity',
            title: 'Krabbenbrötchen am Hafen',
            startDateOffset: 0.6,
            duration: 0.2,
            color: 'bg-cyan-100 border-cyan-300 text-cyan-900',
            location: 'Husumer Hafen',
            coordinates: { lat: 54.4767, lng: 9.0511 },
            activityType: ['food'],
            description:
                'Wenn du nur eine Snack-Pause einplanst, dann diese: frisches Krabbenbrötchen direkt am Wasser. Alternativ gibt es auch klassische Fischbrötchen.',
            aiInsights: {
                cost: 'ca. 6-11 EUR pro Brötchen',
                bestTime: '12:00 - 14:00 oder 17:00 - 18:00',
                tips: 'Direkt am Kai essen lohnt sich, wenn der Hafenbetrieb in vollem Gang ist.',
            },
        },
        {
            id: 'hus-act-krokusfest',
            type: 'activity',
            title: 'Krokusblütenfest im Schloßpark',
            startDateOffset: 1.15,
            duration: 0.45,
            color: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900',
            location: 'Schloßpark Husum',
            coordinates: { lat: 54.4761, lng: 9.0456 },
            activityType: ['culture', 'sightseeing'],
            description:
                'Das Herzstück des Wochenendes: der Schloßpark in Lila. Rund um das Krokusblütenfest gibt es Bühnenprogramm, Marktstände und viele Fotomotive.\n\n### Festival-Zeiten 2026 (Stand 26. Februar 2026, geprüft am 2. März 2026)\n- **Sa, 14.03.2026:** Kunsthandwerkermarkt + kulinarische Meile, **10:00-18:00 Uhr**\n- **Sa, 14.03.2026:** Spielmannszug Rödemis durch die Innenstadt, **10:30 Uhr**\n- **Sa, 14.03.2026:** Eröffnung & Krönung der Krokusblütenmajestät, **11:00 Uhr**\n- **So, 15.03.2026:** Kunsthandwerkermarkt + kulinarische Meile, **10:00-18:00 Uhr**\n- **So, 15.03.2026:** Ausstellungseröffnung „Ulrich Grimm - Geschichten eines Druckers“, **11:00 Uhr**\n- **So, 15.03.2026:** Gewandführung Schloss vor Husum, **11:00 / 13:00 / 15:00 Uhr**\n- **So, 15.03.2026:** Verkaufsoffener Sonntag, **12:00-17:00 Uhr** (Läden meist **13:00-18:00 Uhr**)\n- **So, 15.03.2026:** Autogrammstunde der Krokusblütenmajestät, **14:00 Uhr**\n- **So, 15.03.2026:** Stadtführung Innenstadt, **14:30 Uhr**\n- **So, 15.03.2026:** Themenführungen „Storm“ + „Frauen-Wege“, **15:30 Uhr**\n\nZeiten können sich kurzfristig ändern, daher kurz vor dem Wochenende noch einmal prüfen.',
            aiInsights: {
                cost: 'Park kostenfrei, Event-Angebote je nach Programm',
                bestTime: 'Sa/So 10:00 - 18:00 (Markt), So zusätzlich Innenstadt 12:00 - 17:00',
                tips: 'Früh kommen. Für Fotos eignen sich die Bereiche entlang der Wege nahe Schloss vor Husum.',
            },
        },
        {
            id: 'hus-act-altstadt-shopping',
            type: 'activity',
            title: 'Altstadt, Shopping & Cafés',
            startDateOffset: 1.75,
            duration: 0.35,
            color: 'bg-amber-100 border-amber-300 text-amber-900',
            location: 'Krämerstraße, Großstraße und Norderstraße, Husum',
            coordinates: { lat: 54.476, lng: 9.0498 },
            activityType: ['shopping', 'food'],
            description:
                'Nach dem Park geht es in die Innenstadt: kleine Läden, norddeutsche Mitbringsel und gemütliche Cafés für eine längere Pause.',
            aiInsights: {
                cost: 'Variabel',
                bestTime: '13:00 - 17:00',
                tips: 'Viele inhabergeführte Läden sind in den Nebenstraßen rund um den Marktplatz.',
            },
        },
        {
            id: 'hus-act-dockkoog-wadden',
            type: 'activity',
            title: 'Dockkoog & Wattenmeer bei Sonnenuntergang',
            startDateOffset: 2.15,
            duration: 0.35,
            color: 'bg-emerald-100 border-emerald-300 text-emerald-900',
            location: 'Dockkoogspitze und Nationalpark Wattenmeer, Husum',
            coordinates: { lat: 54.4871, lng: 9.0034 },
            activityType: ['nature', 'sightseeing'],
            description:
                'Zum Abschluss an die Nordsee: Deichweg am Dockkoog, weiter Richtung Wattenmeer und den Blick in die Weite genießen.',
            aiInsights: {
                cost: 'Kostenfrei',
                bestTime: '1 Stunde vor Sonnenuntergang',
                tips: 'Windjacke einpacken. Bei klarem Wetter ist das Licht am Deich besonders stimmungsvoll.',
            },
        },
    ],
};

const HUSUM_KROKUS_WEEKEND_START_DATE = '2026-03-13';

export const createHusumKrokusWeekendTrip = (_startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();
    const validation = validateTripSchema(HUSUM_KROKUS_WEEKEND_TEMPLATE);
    if (!validation.isValid) {
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }

    const items = HUSUM_KROKUS_WEEKEND_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map((hotel) => ({ ...hotel, id: `${hotel.id}-${uniqueSuffix}` })),
    })) as ITimelineItem[];

    return {
        id: `trip-husum-krokus-${uniqueSuffix}`,
        title: HUSUM_KROKUS_WEEKEND_TEMPLATE.title!,
        startDate: HUSUM_KROKUS_WEEKEND_START_DATE,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: HUSUM_KROKUS_WEEKEND_TEMPLATE.countryInfo,
        items,
    };
};
