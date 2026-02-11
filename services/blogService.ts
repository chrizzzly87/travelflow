import { buildBlogImageSeed, getBlogImageMedia } from '../data/blogImageMedia';

export type BlogStatus = 'published' | 'draft';

export interface BlogImageSources {
    xsmall: string;
    small: string;
    medium: string;
    large: string;
}

export interface BlogPostImages {
    card: {
        alt: string;
        sources: BlogImageSources;
    };
    header: {
        alt: string;
        sources: BlogImageSources;
    };
    ogVertical: {
        alt: string;
        source: string;
        accentTint: string;
    };
}

export interface BlogPost {
    slug: string;
    title: string;
    date: string;
    publishedAt: string;
    author: string;
    tags: string[];
    summary: string;
    coverColor: string;
    readingTimeMin: number;
    status: BlogStatus;
    images: BlogPostImages;
    content: string;
    sourcePath: string;
}

const BLOG_FILES = import.meta.glob('../content/blog/*.md', {
    eager: true,
    import: 'default',
    query: '?raw',
}) as Record<string, string>;

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const stripQuotes = (value: string) => {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

const parseFrontmatter = (raw: string) => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const match = normalized.match(FRONTMATTER_REGEX);

    if (!match) {
        return { meta: {} as Record<string, string>, body: normalized };
    }

    const metaLines = match[1].split('\n');
    const meta: Record<string, string> = {};

    for (const line of metaLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf(':');
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim().toLowerCase();
        const value = stripQuotes(trimmed.slice(separator + 1));
        meta[key] = value;
    }

    return { meta, body: match[2] };
};

const parseTags = (raw: string | undefined): string[] => {
    if (!raw) return [];
    const cleaned = raw.replace(/^\[/, '').replace(/\]$/, '');
    return cleaned
        .split(',')
        .map((t) => stripQuotes(t.trim()))
        .filter(Boolean);
};

const parseBlogFile = (sourcePath: string, raw: string): BlogPost | null => {
    const { meta, body } = parseFrontmatter(raw);
    const slug = meta.slug || '';
    const title = meta.title || 'Untitled';
    const date = meta.date || new Date(0).toISOString().slice(0, 10);
    const publishedAt = meta.published_at || `${date}T00:00:00Z`;
    const author = meta.author || 'TravelFlow Team';
    const tags = parseTags(meta.tags);
    const summary = meta.summary || '';
    const coverColor = meta.cover_color || 'bg-slate-100';
    const readingTimeMin = Number(meta.reading_time_min) || 5;

    const statusValue = (meta.status || 'draft').trim().toLowerCase();
    const status: BlogStatus = statusValue === 'published' ? 'published' : 'draft';

    const parsedPublishedAt = Date.parse(publishedAt);
    if (!Number.isFinite(parsedPublishedAt)) {
        console.warn(`[blog] Invalid published_at in ${sourcePath}: ${publishedAt}`);
        return null;
    }

    if (!slug) {
        console.warn(`[blog] Missing slug in ${sourcePath}`);
        return null;
    }

    const imageSeed = buildBlogImageSeed({
        slug,
        title,
        summary,
        tags,
    });
    const media = getBlogImageMedia(slug, title, imageSeed.accentTint);

    return {
        slug,
        title,
        date,
        publishedAt,
        author,
        tags,
        summary,
        coverColor,
        readingTimeMin,
        status,
        images: {
            card: media.card,
            header: media.header,
            ogVertical: {
                alt: media.ogVertical.alt,
                source: media.ogVertical.source,
                accentTint: media.accentTint,
            },
        },
        content: body.trim(),
        sourcePath,
    };
};

const allBlogPosts: BlogPost[] = Object.entries(BLOG_FILES)
    .map(([sourcePath, raw]) => parseBlogFile(sourcePath, raw))
    .filter((entry): entry is BlogPost => !!entry)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

export const getAllBlogPosts = (): BlogPost[] => allBlogPosts;

export const getPublishedBlogPosts = (): BlogPost[] => {
    return allBlogPosts.filter((post) => post.status === 'published');
};

export const getBlogPostBySlug = (slug: string): BlogPost | undefined => {
    return allBlogPosts.find((post) => post.slug === slug);
};

export const getBlogPostsBySlugs = (slugs: string[]): BlogPost[] => {
    if (!slugs || slugs.length === 0) return [];
    const slugSet = new Set(slugs);
    return allBlogPosts.filter((post) => slugSet.has(post.slug) && post.status === 'published');
};
