/**
 * Canonical activity taxonomy.
 *
 * The values, aliases and colors live here rather than in `utils.ts` because
 * the edge runtime cannot import that module (it reads `import.meta.env`), and
 * the trip agent has to normalize the types a model proposes before they reach
 * the timeline.
 */

export const ACTIVITY_TYPE_VALUES = [
    'general',
    'sightseeing',
    'food',
    'culture',
    'relaxation',
    'nightlife',
    'sports',
    'hiking',
    'wildlife',
    'nature',
    'shopping',
    'adventure',
    'beach',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPE_VALUES)[number];

export const ALL_ACTIVITY_TYPES: ActivityType[] = [...ACTIVITY_TYPE_VALUES];

const ACTIVITY_TYPE_SET = new Set<string>(ACTIVITY_TYPE_VALUES);

const ACTIVITY_TYPE_ALIASES: Record<string, ActivityType[]> = {
    activity: ['general'],
    landmark: ['sightseeing'],
    sightseeing: ['sightseeing'],
    food: ['food'],
    dining: ['food'],
    restaurant: ['food'],
    cuisine: ['food'],
    culture: ['culture'],
    historical: ['culture'],
    history: ['culture'],
    museum: ['culture'],
    relaxation: ['relaxation'],
    relax: ['relaxation'],
    spa: ['relaxation'],
    nightlife: ['nightlife'],
    party: ['nightlife'],
    bar: ['nightlife'],
    sports: ['sports'],
    sport: ['sports'],
    hiking: ['hiking'],
    trek: ['hiking'],
    trekking: ['hiking'],
    wildlife: ['wildlife'],
    safari: ['wildlife'],
    nature: ['nature'],
    outdoors: ['nature'],
    shopping: ['shopping'],
    adventure: ['adventure'],
    beach: ['beach'],
};

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
    general: 'bg-slate-100 border-slate-300 text-slate-800',
    sightseeing: 'bg-sky-100 border-sky-300 text-sky-800',
    food: 'bg-amber-100 border-amber-300 text-amber-800',
    culture: 'bg-violet-100 border-violet-300 text-violet-800',
    relaxation: 'bg-teal-100 border-teal-300 text-teal-800',
    nightlife: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800',
    sports: 'bg-red-100 border-red-300 text-red-800',
    hiking: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    wildlife: 'bg-lime-100 border-lime-300 text-lime-800',
    nature: 'bg-green-100 border-green-300 text-green-800',
    shopping: 'bg-pink-100 border-pink-300 text-pink-800',
    adventure: 'bg-orange-100 border-orange-300 text-orange-800',
    beach: 'bg-cyan-100 border-cyan-300 text-cyan-800',
};

// Multi-type activities use a deterministic priority, so timeline color remains stable.
const ACTIVITY_TYPE_PRIORITY: ActivityType[] = [
    'nature',
    'hiking',
    'wildlife',
    'beach',
    'food',
    'culture',
    'sightseeing',
    'nightlife',
    'adventure',
    'sports',
    'shopping',
    'relaxation',
    'general',
];

const tokenizeActivityValue = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap(tokenizeActivityValue);
    }
    if (typeof value !== 'string') return [];
    return value
        .split(/[,\|/;]+/)
        .map(v => v.trim().toLowerCase())
        .filter(Boolean);
};

const resolveActivityToken = (token: string): ActivityType[] => {
    if (ACTIVITY_TYPE_SET.has(token)) return [token as ActivityType];
    if (ACTIVITY_TYPE_ALIASES[token]) return ACTIVITY_TYPE_ALIASES[token];

    if (token.includes('food') || token.includes('dining') || token.includes('restaurant')) return ['food'];
    if (token.includes('museum') || token.includes('history') || token.includes('culture')) return ['culture'];
    if (token.includes('sight') || token.includes('view') || token.includes('landmark')) return ['sightseeing'];
    if (token.includes('hike') || token.includes('trek')) return ['hiking'];
    if (token.includes('wildlife') || token.includes('safari') || token.includes('animal')) return ['wildlife'];
    if (token.includes('nature') || token.includes('park') || token.includes('outdoor')) return ['nature'];
    if (token.includes('beach') || token.includes('sea') || token.includes('coast')) return ['beach'];
    if (token.includes('night') || token.includes('party') || token.includes('club') || token.includes('bar')) return ['nightlife'];
    if (token.includes('shop') || token.includes('market')) return ['shopping'];
    if (token.includes('adventure') || token.includes('adrenaline')) return ['adventure'];
    if (token.includes('sport')) return ['sports'];
    if (token.includes('relax') || token.includes('spa') || token.includes('wellness')) return ['relaxation'];
    if (token.includes('general') || token.includes('activity')) return ['general'];

    return [];
};

export const normalizeActivityTypes = (value: unknown, fallback: ActivityType[] = ['general']): ActivityType[] => {
    const tokens = tokenizeActivityValue(value);
    const resolved = new Set<ActivityType>();

    tokens.forEach(token => {
        resolveActivityToken(token).forEach(type => resolved.add(type));
    });

    const normalized = ALL_ACTIVITY_TYPES.filter(type => resolved.has(type));
    return normalized.length > 0 ? normalized : fallback;
};

export const pickPrimaryActivityType = (value: unknown): ActivityType => {
    const normalized = normalizeActivityTypes(value);
    return ACTIVITY_TYPE_PRIORITY.find(type => normalized.includes(type)) || normalized[0] || 'general';
};

export const getActivityColorByTypes = (value: unknown): string => {
    const primaryType = pickPrimaryActivityType(value);
    return ACTIVITY_TYPE_COLORS[primaryType];
};
