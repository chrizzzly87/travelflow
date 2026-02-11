export interface InspirationImageGenerationProfile {
    useCase: 'photorealistic-natural';
    style: string;
    composition: string;
    lighting: string;
    constraints: string;
    avoid: string;
}

export interface InspirationImagePromptSeed {
    title: string;
    description: string;
    countries: string[];
    keyLocation: string;
    scene: string;
    subject: string;
}

export interface InspirationCardMedia {
    alt: string;
    sources: {
        small: string;
        large: string;
    };
    promptSeed: InspirationImagePromptSeed;
}

const createSources = (slug: string) => ({
    small: `/images/inspirations/${slug}-768.webp`,
    large: `/images/inspirations/${slug}.webp`,
});

const createDestinationMedia = (
    slug: string,
    alt: string,
    promptSeed: InspirationImagePromptSeed,
): InspirationCardMedia => ({
    alt,
    sources: createSources(slug),
    promptSeed,
});

const createFestivalMedia = (
    slug: string,
    alt: string,
    promptSeed: InspirationImagePromptSeed,
): InspirationCardMedia => ({
    alt,
    sources: createSources(slug),
    promptSeed,
});

export const inspirationImageGenerationProfile: InspirationImageGenerationProfile = {
    useCase: 'photorealistic-natural',
    style: 'realistic travel documentary photography with subtle film-like color grading and natural textures',
    composition: 'human-scale perspective, no map-like aerial framing, no impossible landmark combinations',
    lighting: 'natural ambient light with soft contrast and believable weather conditions',
    constraints: 'real locations, no text overlays, no logos, no watermark, no app UI, no fantasy architecture',
    avoid: 'maps, illustrations, CGI look, oversaturated colors, extreme HDR, heavy lens flare',
};

export const destinationCardMedia: Partial<Record<string, InspirationCardMedia>> = {
    'South Island Wilderness': createDestinationMedia(
        'south-island-wilderness',
        'Morning light over Milford Sound with steep green cliffs and still water in New Zealand',
        {
            title: 'South Island Wilderness',
            description: 'Milford Sound fjords, Fox Glacier hikes, and lakeside Queenstown scenery.',
            countries: ['New Zealand'],
            keyLocation: 'Milford Sound, South Island',
            scene: 'wide fjord valley with reflective water and low cloud hugging alpine peaks',
            subject: 'untouched wilderness landscape with no crowds',
        },
    ),
    'Andes & Amazon Explorer': createDestinationMedia(
        'andes-amazon-explorer',
        'Sunrise view over Machu Picchu terraces with mist rolling through the Andes',
        {
            title: 'Andes & Amazon Explorer',
            description: 'From Lima to Machu Picchu, then into the Amazon basin.',
            countries: ['Peru'],
            keyLocation: 'Machu Picchu, Cusco Region',
            scene: 'golden sunrise over stone terraces with mountain ridges in the background',
            subject: 'historic Inca ruins and dramatic mountain terrain',
        },
    ),
    'Patagonia Circuit': createDestinationMedia(
        'patagonia-circuit',
        'Jagged peaks in Torres del Paine above a turquoise glacial lake in Patagonia',
        {
            title: 'Patagonia Circuit',
            description: 'Torres del Paine, Perito Moreno glacier, and El Chalten hikes.',
            countries: ['Chile', 'Argentina'],
            keyLocation: 'Torres del Paine National Park',
            scene: 'windswept trail near glacial lake with granite towers and dramatic skies',
            subject: 'Patagonian mountain wilderness in clear detail',
        },
    ),
    'Italian Grand Tour': createDestinationMedia(
        'italian-grand-tour',
        'Canal-side street in Venice at golden hour with classic architecture and warm light',
        {
            title: 'Italian Grand Tour',
            description: 'Rome, Florence, Bologna, Venice, Naples, and Amalfi highlights.',
            countries: ['Italy'],
            keyLocation: 'Venice canal district',
            scene: 'historic canal with small boats, stone bridges, and evening sunlight',
            subject: 'classic Italian architecture and authentic street atmosphere',
        },
    ),
    'Cherry Blossom Trail': createDestinationMedia(
        'cherry-blossom-trail',
        'Cherry blossoms framing Chureito Pagoda with Mount Fuji in the distance in Japan',
        {
            title: 'Cherry Blossom Trail',
            description: 'Tokyo to Kyoto and Hiroshima with spring blossoms and temple gardens.',
            countries: ['Japan'],
            keyLocation: 'Arakurayama Sengen Park, Fujiyoshida',
            scene: 'spring sakura in full bloom, Chureito Pagoda in foreground, Mount Fuji clearly visible behind',
            subject: 'iconic Japan spring landscape that is geographically plausible',
        },
    ),
    'Medinas & Sahara Nights': createDestinationMedia(
        'medinas-and-sahara-nights',
        'Blue-painted alley in Chefchaouen with morning light and textured walls',
        {
            title: 'Medinas & Sahara Nights',
            description: 'Marrakech, Fez, Chefchaouen, and Sahara desert nights.',
            countries: ['Morocco'],
            keyLocation: 'Chefchaouen old medina',
            scene: 'narrow blue alleyway with handcrafted doors and soft daylight',
            subject: 'authentic Moroccan medina architecture',
        },
    ),
    'Temples & Beaches': createDestinationMedia(
        'temples-and-beaches',
        'Long-tail boats on clear turquoise water near limestone cliffs in southern Thailand',
        {
            title: 'Temples & Beaches',
            description: 'Bangkok temples, Chiang Mai markets, Koh Samui, and Krabi.',
            countries: ['Thailand'],
            keyLocation: 'Railay Beach, Krabi',
            scene: 'calm sea, long-tail boats, limestone karsts, and tropical shoreline',
            subject: 'classic Thailand beach atmosphere with natural colors',
        },
    ),
    'Greek Island Hop': createDestinationMedia(
        'greek-island-hop',
        'Whitewashed cliffside homes in Santorini above the Aegean Sea at sunset',
        {
            title: 'Greek Island Hop',
            description: 'Athens, Santorini, Naxos, and Crete island route.',
            countries: ['Greece'],
            keyLocation: 'Oia, Santorini',
            scene: 'cycladic architecture on a caldera edge with expansive sea horizon',
            subject: 'Mediterranean island village in warm evening light',
        },
    ),
    'Bali & Lombok': createDestinationMedia(
        'bali-and-lombok',
        'Early morning view of Bali rice terraces with palm trees and soft fog',
        {
            title: 'Bali & Lombok',
            description: 'Rice terraces, surf breaks, volcano sunrises, and quieter beaches.',
            countries: ['Indonesia'],
            keyLocation: 'Tegalalang Rice Terrace, Bali',
            scene: 'layered green terraces with morning mist and tropical vegetation',
            subject: 'authentic Indonesian landscape with no resort staging',
        },
    ),
    'Atlantic Coast Road Trip': createDestinationMedia(
        'atlantic-coast-road-trip',
        'Colorful tiled street and historic tram climbing a Lisbon hill in Portugal',
        {
            title: 'Atlantic Coast Road Trip',
            description: 'Lisbon, Porto, Sintra, and Algarve surf beaches.',
            countries: ['Portugal'],
            keyLocation: 'Alfama district, Lisbon',
            scene: 'steep cobblestone street with yellow tram and tiled facades',
            subject: 'iconic Portuguese urban coastal-road-trip mood',
        },
    ),
    'Nordic Design Circuit': createDestinationMedia(
        'nordic-design-circuit',
        'Scandinavian waterfront in Copenhagen with clean architecture and bicycles',
        {
            title: 'Nordic Design Circuit',
            description: 'Copenhagen, Malmo, and Stockholm city design highlights.',
            countries: ['Denmark', 'Sweden'],
            keyLocation: 'Nyhavn area, Copenhagen',
            scene: 'harbor promenade with modern and historic Nordic facades',
            subject: 'minimal Scandinavian city aesthetic in natural daylight',
        },
    ),
    'Ring Road Circuit': createDestinationMedia(
        'ring-road-circuit',
        'Icelandic black sand beach with sea stacks under moody sky near Vik',
        {
            title: 'Ring Road Circuit',
            description: 'Waterfalls, geysers, and black-sand beaches around Iceland.',
            countries: ['Iceland'],
            keyLocation: 'Reynisfjara Beach near Vik',
            scene: 'dramatic shoreline with basalt formations and waves',
            subject: 'raw Icelandic coastal landscape',
        },
    ),
    'Tuscan Countryside': createDestinationMedia(
        'tuscan-countryside',
        'Rolling Tuscan hills with cypress-lined road and warm late-afternoon light',
        {
            title: 'Tuscan Countryside',
            description: 'Farmhouse base near Siena with village and vineyard day trips.',
            countries: ['Italy'],
            keyLocation: 'Val d Orcia, Tuscany',
            scene: 'undulating farmland with cypress trees and stone farmhouses',
            subject: 'slow-travel countryside setting with natural textures',
        },
    ),
    'Sri Lanka Coast to Hills': createDestinationMedia(
        'sri-lanka-coast-to-hills',
        'Blue train crossing tea-covered hills in central Sri Lanka',
        {
            title: 'Sri Lanka Coast to Hills',
            description: 'Galle fort, Mirissa beaches, Ella tea country, and scenic trains.',
            countries: ['Sri Lanka'],
            keyLocation: 'Nine Arch Bridge region, Ella',
            scene: 'lush highland tea estates with a classic blue train route',
            subject: 'coast-to-hills journey feel in a single realistic frame',
        },
    ),
    'Oaxaca & Pacific Coast': createDestinationMedia(
        'oaxaca-and-pacific-coast',
        'Colorful street scene in Oaxaca with market stalls and warm evening light',
        {
            title: 'Oaxaca & Pacific Coast',
            description: 'Oaxaca food culture and Pacific coast surf towns.',
            countries: ['Mexico'],
            keyLocation: 'Historic center of Oaxaca City',
            scene: 'colonial facades, local market atmosphere, and authentic street life',
            subject: 'vibrant but realistic Mexican cultural setting',
        },
    ),
    'Northern Lights Chase': createDestinationMedia(
        'northern-lights-chase',
        'Aurora borealis over snowy Lofoten coastline with a small fishing village',
        {
            title: 'Northern Lights Chase',
            description: 'Tromso fjords, Lofoten villages, and Arctic winter skies.',
            countries: ['Norway'],
            keyLocation: 'Lofoten Islands, Norway',
            scene: 'night sky with green aurora arcs over snowy coastal village',
            subject: 'authentic Arctic winter photography mood',
        },
    ),
    'Cappadocia & Istanbul': createDestinationMedia(
        'cappadocia-and-istanbul',
        'Hot-air balloons rising above Cappadocia rock formations at sunrise',
        {
            title: 'Cappadocia & Istanbul',
            description: 'Balloons over Goreme and Bosphorus golden-hour skyline.',
            countries: ['Turkey'],
            keyLocation: 'Goreme, Cappadocia',
            scene: 'sunrise sky with multiple balloons and fairy-chimney valleys',
            subject: 'classic Cappadocia vista with realistic atmosphere',
        },
    ),
    'Rajasthan Heritage Trail': createDestinationMedia(
        'rajasthan-heritage-trail',
        'Amber Fort architecture in Jaipur with warm sandstone tones and clear sky',
        {
            title: 'Rajasthan Heritage Trail',
            description: 'Jaipur, Jodhpur, Udaipur, and Jaisalmer heritage route.',
            countries: ['India'],
            keyLocation: 'Amber Fort, Jaipur',
            scene: 'ornate palace courtyards and sandstone arches in afternoon light',
            subject: 'rich but realistic heritage architecture',
        },
    ),
};

export const festivalCardMedia: Partial<Record<string, InspirationCardMedia>> = {
    'Cherry Blossom Festival': createFestivalMedia(
        'cherry-blossom-festival',
        'People enjoying hanami under cherry trees in Kyoto during peak sakura season',
        {
            title: 'Cherry Blossom Festival',
            description: 'Sakura season picnics and temple gardens in Kyoto and Tokyo.',
            countries: ['Japan'],
            keyLocation: 'Philosophers Path, Kyoto',
            scene: 'tree-lined canal path with cherry blossoms and spring visitors',
            subject: 'authentic hanami atmosphere in Japan',
        },
    ),
    Carnival: createFestivalMedia(
        'carnival-brazil',
        'Samba dancers and parade floats in Rio de Janeiro during Carnival night',
        {
            title: 'Carnival',
            description: 'Samba parades and street celebrations in Rio and Salvador.',
            countries: ['Brazil'],
            keyLocation: 'Sambadrome, Rio de Janeiro',
            scene: 'colorful parade moment with costumes and crowd energy',
            subject: 'festival performance captured as realistic event photography',
        },
    ),
    Holi: createFestivalMedia(
        'holi-india',
        'Crowd celebrating Holi with colored powder in Jaipur in bright daylight',
        {
            title: 'Holi',
            description: 'Festival of colors in Jaipur, Varanasi, and Mathura.',
            countries: ['India'],
            keyLocation: 'Jaipur old city',
            scene: 'joyful street gathering with natural motion blur and color powder clouds',
            subject: 'candid Holi celebration scene',
        },
    ),
    'Día de los Muertos': createFestivalMedia(
        'dia-de-los-muertos',
        'Marigold-covered altar with candles in Oaxaca during Dia de los Muertos',
        {
            title: 'Día de los Muertos',
            description: 'Altars, candles, and remembrance celebrations in Oaxaca.',
            countries: ['Mexico'],
            keyLocation: 'Oaxaca City',
            scene: 'nighttime ofrenda setup with marigolds, candles, and traditional decor',
            subject: 'respectful and realistic cultural celebration',
        },
    ),
    Oktoberfest: createFestivalMedia(
        'oktoberfest-munich',
        'Crowded beer tent scene at Munich Oktoberfest with traditional attire',
        {
            title: 'Oktoberfest',
            description: 'Munich beer festival with tents, brass bands, and visitors.',
            countries: ['Germany'],
            keyLocation: 'Theresienwiese, Munich',
            scene: 'inside a festive beer tent with wooden tables and warm lighting',
            subject: 'classic Oktoberfest social atmosphere',
        },
    ),
    'Loy Krathong': createFestivalMedia(
        'loy-krathong-thailand',
        'Floating candle lanterns on a calm river during Loy Krathong in Thailand',
        {
            title: 'Loy Krathong',
            description: 'Lanterns and lotus floats released on rivers in Thailand.',
            countries: ['Thailand'],
            keyLocation: 'Chiang Mai riverside',
            scene: 'evening river reflections with many illuminated krathong floats',
            subject: 'serene Thai festival night scene',
        },
    ),
    'Northern Lights Season': createFestivalMedia(
        'northern-lights-season',
        'Aurora over Icelandic lava field under clear winter night sky',
        {
            title: 'Northern Lights Season',
            description: 'Aurora chasing in Tromso fjords and Icelandic landscapes.',
            countries: ['Norway', 'Iceland'],
            keyLocation: 'Thingvellir region, Iceland',
            scene: 'green aurora bands over dark volcanic terrain and snow patches',
            subject: 'realistic aurora viewing conditions',
        },
    ),
    'La Tomatina': createFestivalMedia(
        'la-tomatina-spain',
        'Street crowd covered in tomato pulp during La Tomatina in Bunol',
        {
            title: 'La Tomatina',
            description: 'Large-scale tomato fight festival in Bunol.',
            countries: ['Spain'],
            keyLocation: 'Bunol town center',
            scene: 'narrow street filled with participants and tomato splash action',
            subject: 'dynamic but realistic festival chaos',
        },
    ),
    'Songkran Water Festival': createFestivalMedia(
        'songkran-water-festival',
        'People celebrating Songkran with water splashes in Bangkok street',
        {
            title: 'Songkran Water Festival',
            description: 'Thai New Year with water fights and temple traditions.',
            countries: ['Thailand'],
            keyLocation: 'Silom Road, Bangkok',
            scene: 'urban street celebration with water splashes and smiling crowds',
            subject: 'authentic Songkran street energy',
        },
    ),
    'Venice Carnival': createFestivalMedia(
        'venice-carnival',
        'Masked participants in ornate costumes near a Venice canal at dusk',
        {
            title: 'Venice Carnival',
            description: 'Historic masks, gondolas, and masquerade atmosphere in Venice.',
            countries: ['Italy'],
            keyLocation: 'St Mark area, Venice',
            scene: 'costumed carnival attendees with canalside architecture backdrop',
            subject: 'elegant Venetian carnival portrait-style street scene',
        },
    ),
    'Running of the Bulls': createFestivalMedia(
        'running-of-the-bulls',
        'Festival crowd in white and red during San Fermin in Pamplona',
        {
            title: 'Running of the Bulls',
            description: 'San Fermin celebrations with parades and traditional outfits.',
            countries: ['Spain'],
            keyLocation: 'Pamplona old town',
            scene: 'packed street celebration with white clothing and red scarves',
            subject: 'festival atmosphere without unsafe close-up bull chase imagery',
        },
    ),
    'Chinese New Year': createFestivalMedia(
        'chinese-new-year',
        'Night lantern display and dragon dance performance in a Chinese city',
        {
            title: 'Chinese New Year',
            description: 'Lantern displays and dragon dances for Lunar New Year.',
            countries: ['China'],
            keyLocation: 'Yu Garden district, Shanghai',
            scene: 'red lantern-lit street with festive evening crowd',
            subject: 'traditional new year celebration in realistic city setting',
        },
    ),
    'Glastonbury Festival': createFestivalMedia(
        'glastonbury-festival',
        'Large outdoor concert crowd facing festival stage at sunset in Somerset',
        {
            title: 'Glastonbury Festival',
            description: 'Major music festival performances on a Somerset farm.',
            countries: ['United Kingdom'],
            keyLocation: 'Worthy Farm, Somerset',
            scene: 'wide field crowd and lit stage in late-evening light',
            subject: 'authentic large-scale music festival atmosphere',
        },
    ),
    'Burning Man': createFestivalMedia(
        'burning-man',
        'Art installation and cyclists at sunset on the Black Rock Desert playa',
        {
            title: 'Burning Man',
            description: 'Temporary city with large art pieces in Nevada desert.',
            countries: ['USA'],
            keyLocation: 'Black Rock Desert, Nevada',
            scene: 'dusty desert plain with temporary art and people at golden hour',
            subject: 'realistic desert festival environment',
        },
    ),
    Diwali: createFestivalMedia(
        'diwali-india',
        'Rows of oil lamps and festive lights in Jaipur during Diwali evening',
        {
            title: 'Diwali',
            description: 'Festival of lights with lamps, rangoli, and fireworks in India.',
            countries: ['India'],
            keyLocation: 'Jaipur old city',
            scene: 'warm glowing street decor with diyas and evening ambience',
            subject: 'authentic Diwali celebration atmosphere',
        },
    ),
    "St. Patrick's Day": createFestivalMedia(
        'st-patricks-day',
        'Dublin parade crowd in green during St Patricks Day celebration',
        {
            title: "St. Patrick's Day",
            description: 'Parades, music, and celebrations across Dublin.',
            countries: ['Ireland'],
            keyLocation: 'Dublin city center',
            scene: 'daytime parade route with celebratory crowd and Irish city backdrop',
            subject: 'realistic city festival atmosphere',
        },
    ),
    'Mardi Gras': createFestivalMedia(
        'mardi-gras',
        'Colorful Mardi Gras parade float moving through New Orleans street',
        {
            title: 'Mardi Gras',
            description: 'New Orleans parades with jazz, floats, and street festivities.',
            countries: ['USA'],
            keyLocation: 'French Quarter, New Orleans',
            scene: 'vibrant parade moment with decorated float and cheering crowd',
            subject: 'authentic New Orleans festival scene',
        },
    ),
    'Lantern Festival': createFestivalMedia(
        'lantern-festival-taiwan',
        'Sky lanterns rising at night in Pingxi, Taiwan, above gathered visitors',
        {
            title: 'Lantern Festival',
            description: 'Sky lantern release celebrations in Taiwan.',
            countries: ['Taiwan'],
            keyLocation: 'Pingxi District',
            scene: 'night release of paper lanterns with mountain town backdrop',
            subject: 'calm, realistic lantern festival moment',
        },
    ),
    'Inti Raymi': createFestivalMedia(
        'inti-raymi-peru',
        'Traditional dancers at Sacsayhuaman fortress during Inti Raymi ceremony',
        {
            title: 'Inti Raymi',
            description: 'Inca festival of the sun ceremony above Cusco.',
            countries: ['Peru'],
            keyLocation: 'Sacsayhuaman, Cusco',
            scene: 'historic stone fortress setting with ceremonial costumes and crowd',
            subject: 'cultural reenactment scene with natural daylight',
        },
    ),
    'Edinburgh Fringe': createFestivalMedia(
        'edinburgh-fringe',
        'Crowded Edinburgh street with festival posters and performers during Fringe',
        {
            title: 'Edinburgh Fringe',
            description: 'Arts festival shows across Edinburgh venues.',
            countries: ['United Kingdom'],
            keyLocation: 'Royal Mile, Edinburgh',
            scene: 'busy festival-day street with historic stone buildings',
            subject: 'lively performing arts festival atmosphere',
        },
    ),
};

export const buildInspirationImagePrompt = (seed: InspirationImagePromptSeed): string => [
    `Use case: ${inspirationImageGenerationProfile.useCase}`,
    'Asset type: travel inspiration card hero image',
    `Primary request: realistic travel photograph for "${seed.title}"`,
    `Scene/background: ${seed.scene}`,
    `Subject: ${seed.subject}`,
    `Style/medium: ${inspirationImageGenerationProfile.style}`,
    `Composition/framing: ${inspirationImageGenerationProfile.composition}`,
    `Lighting/mood: ${inspirationImageGenerationProfile.lighting}`,
    `Constraints: ${inspirationImageGenerationProfile.constraints}; destination focus: ${seed.keyLocation}; countries: ${seed.countries.join(', ')}`,
    `Avoid: ${inspirationImageGenerationProfile.avoid}`,
].join('\n');
