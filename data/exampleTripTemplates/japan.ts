import { ITrip, ITimelineItem } from '../../types';
import { validateTripSchema } from './_validation';

export const JAPAN_TEMPLATE: Partial<ITrip> = {
    title: "Cherry Blossom Trail",
    countryInfo: {
        currencyCode: "JPY",
        currencyName: "Japanese Yen",
        exchangeRate: 163.5,
        languages: ["Japanese"],
        electricSockets: "Type A, Type B (100V, 50/60Hz)",
        visaInfoUrl: "https://www.mofa.go.jp/j_info/visit/visa/index.html",
        auswaertigesAmtUrl: "https://www.auswaertiges-amt.de/de/aussenpolitik/laender/japan-node/japansicherheit/213032"
    },
    items: [
        // ── Tokyo (Days 0–3) ──────────────────────────────────────
        {
            id: "jp-city-tokyo",
            type: "city",
            title: "Tokyo",
            startDateOffset: 0,
            duration: 3,
            color: "bg-rose-200 border-rose-400 text-rose-900",
            location: "Tokyo, Japan",
            coordinates: { lat: 35.6762, lng: 139.6503 },
            description: `The electrifying capital where ancient temples stand beside neon-lit skyscrapers. Tokyo is a sensory overload of culture, cuisine, and creativity.\n\n### Must See\n- [ ] Senso-ji Temple in Asakusa\n- [ ] Meiji Shrine & Harajuku\n- [ ] Shibuya Crossing\n- [ ] Tokyo Skytree or Tokyo Tower\n- [ ] Imperial Palace East Gardens\n\n### Must Try\n- [ ] Fresh sushi at Tsukiji Outer Market\n- [ ] Ramen in a local yokocho alley\n- [ ] Matcha desserts in Uji-inspired cafes\n- [ ] Yakitori under the train tracks at Yurakucho\n\n### Must Do\n- [ ] Stroll through Shinjuku Gyoen during cherry blossom season\n- [ ] Experience a traditional onsen (public bath)\n- [ ] Explore Akihabara's electric town\n- [ ] Visit teamLab Borderless digital art museum`,
            hotels: [
                {
                    id: "jp-hotel-tokyo-1",
                    name: "Hotel Gracery Shinjuku",
                    address: "8-1-1 Kabukicho, Shinjuku, Tokyo 160-8466",
                    coordinates: { lat: 35.6938, lng: 139.7013 },
                    notes: "Iconic Godzilla head on the terrace; great Shinjuku location"
                }
            ]
        },

        // Activity: Tsukiji Fish Market
        {
            id: "jp-act-tsukiji",
            type: "activity",
            title: "Tsukiji Outer Market Tour",
            startDateOffset: 0.3,
            duration: 0.25,
            color: "bg-orange-100 border-orange-300 text-orange-900",
            location: "Tsukiji Outer Market, Tokyo",
            coordinates: { lat: 35.6654, lng: 139.7707 },
            activityType: ["food", "culture"],
            aiInsights: {
                cost: "~2,000–5,000 JPY for street food tasting",
                bestTime: "Early morning (6–10 AM) for freshest picks",
                tips: "The inner wholesale market moved to Toyosu, but the outer market remains a foodie paradise. Try tamagoyaki (egg omelet) and fresh uni (sea urchin)."
            }
        },

        // ── Travel: Tokyo → Hakone ───────────────────────────────
        {
            id: "jp-travel-tokyo-hakone",
            type: "travel",
            title: "Tokyo → Hakone",
            startDateOffset: 3,
            duration: 0.15,
            color: "bg-stone-800 border-stone-600 text-stone-100",
            transportMode: "train",
            description: "Romancecar express from Shinjuku Station (~85 min). Consider the Hakone Free Pass for unlimited transport within the Hakone area.",
            routeDistanceKm: 90,
            routeDurationHours: 1.4
        },

        // ── Hakone (Days 3–5) ─────────────────────────────────────
        {
            id: "jp-city-hakone",
            type: "city",
            title: "Hakone",
            startDateOffset: 3,
            duration: 2,
            color: "bg-pink-200 border-pink-400 text-pink-900",
            location: "Hakone, Kanagawa, Japan",
            coordinates: { lat: 35.2326, lng: 139.1070 },
            description: `A hot spring resort town nestled in the mountains with stunning views of Mount Fuji. Hakone is the perfect escape from Tokyo's urban intensity.\n\n### Must See\n- [ ] Mount Fuji views from Lake Ashi\n- [ ] Hakone Shrine (lakeside torii gate)\n- [ ] Owakudani volcanic valley\n- [ ] Hakone Open-Air Museum\n\n### Must Try\n- [ ] Black eggs (kuro-tamago) boiled in volcanic springs\n- [ ] Traditional kaiseki dinner at a ryokan\n- [ ] Local craft beer at Hakone Beer\n\n### Must Do\n- [ ] Soak in an outdoor onsen with mountain views\n- [ ] Take the Hakone Ropeway over Owakudani\n- [ ] Cruise across Lake Ashi on a pirate ship`
        },

        // ── Travel: Hakone → Kyoto ───────────────────────────────
        {
            id: "jp-travel-hakone-kyoto",
            type: "travel",
            title: "Hakone → Kyoto",
            startDateOffset: 5,
            duration: 0.15,
            color: "bg-stone-800 border-stone-600 text-stone-100",
            transportMode: "train",
            description: "Romancecar back to Odawara, then Shinkansen (bullet train) to Kyoto (~2.5 hours total). Book reserved seats on the Hikari or Nozomi.",
            routeDistanceKm: 400,
            routeDurationHours: 2.5
        },

        // ── Kyoto (Days 5–9) ──────────────────────────────────────
        {
            id: "jp-city-kyoto",
            type: "city",
            title: "Kyoto",
            startDateOffset: 5,
            duration: 4,
            color: "bg-rose-300 border-rose-500 text-rose-950",
            location: "Kyoto, Japan",
            coordinates: { lat: 35.0116, lng: 135.7681 },
            description: `The cultural heart of Japan with over 2,000 temples, stunning bamboo groves, and geisha districts. Kyoto during cherry blossom season is unforgettable.\n\n### Must See\n- [ ] Fushimi Inari Shrine (10,000 torii gates)\n- [ ] Kinkaku-ji (Golden Pavilion)\n- [ ] Arashiyama Bamboo Grove\n- [ ] Kiyomizu-dera Temple\n- [ ] Philosopher's Path (sakura lined)\n\n### Must Try\n- [ ] Traditional matcha tea ceremony\n- [ ] Yudofu (tofu hot pot) in Nanzen-ji area\n- [ ] Kyoto-style kaiseki multi-course dinner\n- [ ] Wagashi (traditional sweets) with tea\n\n### Must Do\n- [ ] Rent a kimono and stroll through Higashiyama\n- [ ] Visit Nishiki Market ("Kyoto's Kitchen")\n- [ ] Watch a geisha performance in Gion\n- [ ] Early morning visit to Fushimi Inari (avoid crowds)`,
            hotels: [
                {
                    id: "jp-hotel-kyoto-1",
                    name: "Hotel Kanra Kyoto",
                    address: "190 Kitamachi, Shimogyo-ku, Kyoto 600-8176",
                    coordinates: { lat: 34.9937, lng: 135.7596 },
                    notes: "Modern machiya-inspired design; close to Kyoto Station"
                }
            ]
        },

        // Activity: Tea Ceremony
        {
            id: "jp-act-tea-ceremony",
            type: "activity",
            title: "Traditional Tea Ceremony",
            startDateOffset: 6,
            duration: 0.15,
            color: "bg-emerald-100 border-emerald-300 text-emerald-900",
            location: "Camellia Garden, Kyoto",
            coordinates: { lat: 35.0036, lng: 135.7785 },
            activityType: ["culture"],
            aiInsights: {
                cost: "~3,000–5,000 JPY per person",
                bestTime: "Morning or early afternoon for a calm experience",
                tips: "Wear socks (no bare feet). The host will guide you through the ritual — enjoy the silence and mindfulness. Some venues offer English-language ceremonies."
            }
        },

        // Activity: Fushimi Inari
        {
            id: "jp-act-fushimi-inari",
            type: "activity",
            title: "Fushimi Inari Shrine Hike",
            startDateOffset: 7,
            duration: 0.25,
            color: "bg-red-100 border-red-300 text-red-900",
            location: "Fushimi Inari-taisha, Kyoto",
            coordinates: { lat: 34.9671, lng: 135.7727 },
            activityType: ["sightseeing", "hiking"],
            aiInsights: {
                cost: "Free (open 24 hours)",
                bestTime: "Early morning (before 7 AM) or late evening to avoid crowds",
                tips: "The full hike to the summit takes ~2 hours round trip. The first section with thousands of vermilion torii gates is the most iconic. Bring water and wear comfortable shoes."
            }
        },

        // ── Travel: Kyoto → Osaka ────────────────────────────────
        {
            id: "jp-travel-kyoto-osaka",
            type: "travel",
            title: "Kyoto → Osaka",
            startDateOffset: 9,
            duration: 0.1,
            color: "bg-stone-800 border-stone-600 text-stone-100",
            transportMode: "train",
            description: "JR Special Rapid train from Kyoto Station to Osaka Station (~30 min). Frequent departures, no reservation needed.",
            routeDistanceKm: 50,
            routeDurationHours: 0.5
        },

        // ── Osaka (Days 9–12) ─────────────────────────────────────
        {
            id: "jp-city-osaka",
            type: "city",
            title: "Osaka",
            startDateOffset: 9,
            duration: 3,
            color: "bg-pink-100 border-pink-300 text-pink-900",
            location: "Osaka, Japan",
            coordinates: { lat: 34.6937, lng: 135.5023 },
            description: `Japan's kitchen and comedy capital. Osaka is all about street food, vibrant nightlife, and a laid-back attitude that contrasts with Tokyo's formality.\n\n### Must See\n- [ ] Osaka Castle and its park\n- [ ] Dotonbori neon-lit canal district\n- [ ] Shinsekai retro neighborhood\n- [ ] Sumiyoshi Taisha shrine\n\n### Must Try\n- [ ] Takoyaki (octopus balls) from a street stall\n- [ ] Okonomiyaki (savory pancake) at a local joint\n- [ ] Kushikatsu (deep-fried skewers) in Shinsekai\n- [ ] Cheesecake from Rikuro Ojisan\n\n### Must Do\n- [ ] Evening walk along Dotonbori canal\n- [ ] Explore Kuromon Ichiba Market\n- [ ] Visit Umeda Sky Building for sunset views\n- [ ] Bar-hop through Ura-Namba's hidden alleys`
        },

        // ── Travel: Osaka → Hiroshima ────────────────────────────
        {
            id: "jp-travel-osaka-hiroshima",
            type: "travel",
            title: "Osaka → Hiroshima",
            startDateOffset: 12,
            duration: 0.15,
            color: "bg-stone-800 border-stone-600 text-stone-100",
            transportMode: "train",
            description: "Shinkansen (Nozomi or Sakura) from Shin-Osaka to Hiroshima (~1.5 hours). The Japan Rail Pass covers Hikari and Sakura trains.",
            routeDistanceKm: 340,
            routeDurationHours: 1.5
        },

        // ── Hiroshima (Days 12–14) ────────────────────────────────
        {
            id: "jp-city-hiroshima",
            type: "city",
            title: "Hiroshima",
            startDateOffset: 12,
            duration: 2,
            color: "bg-rose-100 border-rose-300 text-rose-900",
            location: "Hiroshima, Japan",
            coordinates: { lat: 34.3853, lng: 132.4553 },
            description: `A city of resilience and peace. Hiroshima's moving memorial sites and nearby Miyajima Island make it an essential stop on any Japan itinerary.\n\n### Must See\n- [ ] Hiroshima Peace Memorial (A-Bomb Dome)\n- [ ] Peace Memorial Museum\n- [ ] Miyajima Island & floating torii gate\n- [ ] Shukkeien Garden\n\n### Must Try\n- [ ] Hiroshima-style okonomiyaki (layered, with noodles)\n- [ ] Fresh oysters from Miyajima\n- [ ] Momiji manju (maple leaf cakes)\n\n### Must Do\n- [ ] Walk through Peace Memorial Park at sunset\n- [ ] Take the ferry to Miyajima Island\n- [ ] Hike Mount Misen for panoramic views\n- [ ] Ring the Peace Bell at the memorial`
        },

        // Activity: Miyajima Island
        {
            id: "jp-act-miyajima",
            type: "activity",
            title: "Miyajima Island Day Trip",
            startDateOffset: 13,
            duration: 0.4,
            color: "bg-sky-100 border-sky-300 text-sky-900",
            location: "Miyajima Island, Hiroshima",
            coordinates: { lat: 34.2960, lng: 132.3198 },
            activityType: ["sightseeing", "nature", "culture"],
            aiInsights: {
                cost: "~400 JPY round-trip ferry; Mt. Misen ropeway ~1,840 JPY",
                bestTime: "Arrive early morning; the floating torii is best at high tide (check tide tables). Sunset views are spectacular.",
                tips: "The island has friendly wild deer — don't feed them. Take the ropeway up Mount Misen for incredible Seto Inland Sea views. Allow 4–5 hours for a full visit."
            }
        }
    ]
};

export const createJapanTrip = (startDateStr: string): ITrip => {
    const uniqueSuffix = Date.now();
    const validation = validateTripSchema(JAPAN_TEMPLATE);
    if (!validation.isValid) {
        throw new Error(`Test Data Schema Error: ${validation.error}`);
    }
    const items = JAPAN_TEMPLATE.items!.map((item) => ({
        ...item,
        id: `${item.id}-${uniqueSuffix}`,
        hotels: item.hotels?.map(h => ({ ...h, id: `${h.id}-${uniqueSuffix}` }))
    })) as ITimelineItem[];
    return {
        id: `trip-japan-${uniqueSuffix}`,
        title: JAPAN_TEMPLATE.title!,
        startDate: startDateStr,
        createdAt: uniqueSuffix,
        updatedAt: uniqueSuffix,
        isFavorite: false,
        countryInfo: JAPAN_TEMPLATE.countryInfo,
        items: items
    };
};
