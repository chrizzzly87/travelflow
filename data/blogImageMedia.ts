export type BlogImageVariant = 'card' | 'header' | 'ogVertical';

export interface BlogImageGenerationProfile {
    useCase: 'photorealistic-natural';
    style: string;
    compositionBase: string;
    lighting: string;
    palette: string;
    constraints: string;
    avoid: string;
}

export interface BlogImagePromptSeed {
    slug: string;
    title: string;
    summary: string;
    tags: string[];
    countries: string[];
    keyLocation: string;
    scene: string;
    subject: string;
    accentTint: string;
}

export interface BlogImageSeedContext {
    slug: string;
    title: string;
    summary: string;
    tags: string[];
}

interface BlogImageSeedOverride {
    countries?: string[];
    keyLocation?: string;
    scene?: string;
    subject?: string;
    accentTint?: string;
}

export interface BlogResponsiveImageSourceSet {
    small: string;
    large: string;
}

export interface BlogImageMedia {
    card: {
        alt: string;
        sources: BlogResponsiveImageSourceSet;
    };
    header: {
        alt: string;
        sources: BlogResponsiveImageSourceSet;
    };
    ogVertical: {
        alt: string;
        source: string;
    };
    accentTint: string;
}

const BLOG_IMAGE_PREFIX = '/images/blog/';
const DEFAULT_ACCENT_TINT = '#6366f1';
// Increment when blog OG source images are regenerated and should invalidate cached /api/og/site renders.
export const BLOG_OG_IMAGE_REVISION = '2026-02-10-01';

const createResponsiveSources = (slug: string, variant: 'card' | 'header'): BlogResponsiveImageSourceSet => ({
    small: `${BLOG_IMAGE_PREFIX}${slug}-${variant}-768.webp`,
    large: `${BLOG_IMAGE_PREFIX}${slug}-${variant}.webp`,
});

const createOgSource = (slug: string): string => `${BLOG_IMAGE_PREFIX}${slug}-og-vertical.jpg`;

const toTitleCase = (value: string): string =>
    value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

const inferCountriesFromTags = (tags: string[]): string[] => {
    const COUNTRY_BY_TAG: Record<string, string> = {
        japan: 'Japan',
        europe: 'Europe',
        asia: 'Asia',
        multi: 'Multiple Countries',
        'multi-city': 'Multiple Countries',
        festival: 'Festival Destinations',
        festivals: 'Festival Destinations',
        weekend: 'Short-Haul Destinations',
    };

    const countries = tags
        .map((tag) => COUNTRY_BY_TAG[tag.trim().toLowerCase()])
        .filter((value): value is string => Boolean(value));

    return countries.length > 0 ? Array.from(new Set(countries)) : ['Global'];
};

const BLOG_IMAGE_SEED_OVERRIDES: Record<string, BlogImageSeedOverride> = {
    'best-time-visit-japan': {
        countries: ['Japan'],
        keyLocation: 'Arakurayama Sengen Park overlook, Fujiyoshida',
        scene: 'Cherry blossoms framing Chureito Pagoda with Mount Fuji clearly visible in spring haze',
        subject: 'Authentic spring travel scene in Japan with visitors enjoying sakura season',
        accentTint: '#ec4899',
    },
    'budget-travel-europe': {
        countries: ['Portugal', 'Czech Republic', 'Italy'],
        keyLocation: 'Historic tram corridor in Lisbon old town',
        scene: 'Travelers with light carry-on bags exploring a lively but affordable European neighborhood',
        subject: 'Realistic budget-friendly Europe city-break atmosphere with local cafes and transit',
        accentTint: '#0ea5e9',
    },
    'festival-travel-guide': {
        countries: ['Japan', 'Mexico', 'Thailand'],
        keyLocation: 'Lantern-lit cultural festival street in Chiang Mai',
        scene: 'Evening festival crowd with warm lantern light, local food stalls, and celebratory ambience',
        subject: 'Authentic festival travel moment with culturally plausible details and natural crowd behavior',
        accentTint: '#a855f7',
    },
    'how-to-plan-multi-city-trip': {
        countries: ['Italy', 'Austria', 'Germany'],
        keyLocation: 'Classic European train concourse connecting major cities',
        scene: 'Travelers moving between platforms with luggage in a bright station before boarding a long-distance train',
        subject: 'Multi-city travel planning in action with real transport context and human-scale detail',
        accentTint: '#6366f1',
    },
    'weekend-getaway-tips': {
        countries: ['Spain', 'Portugal', 'France'],
        keyLocation: 'Coastal old-town viewpoint reached by short train ride',
        scene: 'Two travelers on a weekend escape overlooking a seaside town with a compact day bag',
        subject: 'Short-trip mood with relaxed pacing, golden-hour light, and realistic urban-coastal setting',
        accentTint: '#f59e0b',
    },
};

export const blogImageGenerationProfile: BlogImageGenerationProfile = {
    useCase: 'photorealistic-natural',
    style: 'realistic travel editorial photography with authentic people scale, subtle filmic color, and natural texture detail',
    compositionBase: 'candid documentary framing, geographically plausible landmarks only, no staged stock-photo look',
    lighting: 'natural ambient light with believable weather, soft contrast, and no artificial glow effects',
    palette: 'balanced real-world travel colors with restrained saturation and clean skin/sky tones',
    constraints: 'real locations, no text overlays, no logos, no watermark, no app UI, no fantasy architecture',
    avoid: 'maps, app interfaces, diagrams, CGI render look, surreal landmark mashups, oversharpening, extreme HDR',
};

const VARIANT_ASSET_TYPE: Record<BlogImageVariant, string> = {
    card: 'blog overview card cover image',
    header: 'blog detail page header image (wide landscape crop-safe)',
    ogVertical: 'blog Open Graph side-panel image (vertical composition)',
};

const VARIANT_COMPOSITION: Record<BlogImageVariant, string> = {
    card: 'landscape 3:2 framing, strong focal subject in upper-middle, readable when cropped on card edges',
    header: 'landscape 3:2 framing with broad environmental context; key subject centered to survive very wide header crops',
    ogVertical: 'vertical 2:3 framing with a clear single focal area, strong depth, and clean edges for social sharing',
};

export const getBlogImageAccentTint = (slug: string): string => {
    return BLOG_IMAGE_SEED_OVERRIDES[slug]?.accentTint || DEFAULT_ACCENT_TINT;
};

export const getBlogImageMedia = (slug: string, title: string, accentTint = getBlogImageAccentTint(slug)): BlogImageMedia => ({
    card: {
        alt: `Travel photo for blog card: ${title}`,
        sources: createResponsiveSources(slug, 'card'),
    },
    header: {
        alt: `Header travel photo: ${title}`,
        sources: createResponsiveSources(slug, 'header'),
    },
    ogVertical: {
        alt: `Social preview image for article: ${title}`,
        source: createOgSource(slug),
    },
    accentTint,
});

export const buildBlogImageSeed = (context: BlogImageSeedContext): BlogImagePromptSeed => {
    const override = BLOG_IMAGE_SEED_OVERRIDES[context.slug] || {};
    const fallbackCountries = inferCountriesFromTags(context.tags);
    const cleanSummary = context.summary.trim() || `Travel article about ${context.title}.`;

    return {
        slug: context.slug,
        title: context.title,
        summary: cleanSummary,
        tags: context.tags,
        countries: override.countries || fallbackCountries,
        keyLocation: override.keyLocation || `${toTitleCase(context.slug.replace(/-/g, ' '))} relevant real-world location`,
        scene: override.scene || `Authentic travel scene representing: ${cleanSummary}`,
        subject: override.subject || `Travelers experiencing ${context.title} in a realistic setting`,
        accentTint: override.accentTint || DEFAULT_ACCENT_TINT,
    };
};

export const buildBlogImagePrompt = (seed: BlogImagePromptSeed, variant: BlogImageVariant): string => {
    const countryLabel = seed.countries.length > 0 ? seed.countries.join(', ') : 'Global';

    return [
        `Use case: ${blogImageGenerationProfile.useCase}`,
        `Asset type: ${VARIANT_ASSET_TYPE[variant]}`,
        `Primary request: realistic travel editorial image for the blog article \"${seed.title}\"`,
        `Scene/background: ${seed.scene}`,
        `Subject: ${seed.subject}`,
        `Style/medium: ${blogImageGenerationProfile.style}`,
        `Composition/framing: ${blogImageGenerationProfile.compositionBase}; ${VARIANT_COMPOSITION[variant]}`,
        `Lighting/mood: ${blogImageGenerationProfile.lighting}`,
        `Color palette: ${blogImageGenerationProfile.palette}`,
        `Constraints: ${blogImageGenerationProfile.constraints}; key location: ${seed.keyLocation}; country context: ${countryLabel}; article summary: ${seed.summary}`,
        `Avoid: ${blogImageGenerationProfile.avoid}`,
    ].join('\n');
};
