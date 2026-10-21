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

// Named palette tokens rather than hue/step utilities, so the colours live in
// one place (index.css :root + .dark + @theme) and both themes are defined
// together. Solid colours in both: these badges overlap on a timeline entry and
// any transparency darkens where they stack.
export const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
    general: 'bg-activity-general-bg border-activity-general-border text-activity-general-text',
    sightseeing: 'bg-activity-sightseeing-bg border-activity-sightseeing-border text-activity-sightseeing-text',
    food: 'bg-activity-food-bg border-activity-food-border text-activity-food-text',
    culture: 'bg-activity-culture-bg border-activity-culture-border text-activity-culture-text',
    relaxation: 'bg-activity-relaxation-bg border-activity-relaxation-border text-activity-relaxation-text',
    nightlife: 'bg-activity-nightlife-bg border-activity-nightlife-border text-activity-nightlife-text',
    sports: 'bg-activity-sports-bg border-activity-sports-border text-activity-sports-text',
    hiking: 'bg-activity-hiking-bg border-activity-hiking-border text-activity-hiking-text',
    wildlife: 'bg-activity-wildlife-bg border-activity-wildlife-border text-activity-wildlife-text',
    nature: 'bg-activity-nature-bg border-activity-nature-border text-activity-nature-text',
    shopping: 'bg-activity-shopping-bg border-activity-shopping-border text-activity-shopping-text',
    adventure: 'bg-activity-adventure-bg border-activity-adventure-border text-activity-adventure-text',
    beach: 'bg-activity-beach-bg border-activity-beach-border text-activity-beach-text',
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
