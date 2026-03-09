import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
    buildBlogImagePrompt,
    buildBlogImageSeed,
    getBlogImageMedia,
    type BlogImageVariant,
} from '../data/blogImageMedia';

interface ImageBatchJob {
    prompt: string;
    out: string;
    size: '1536x1024' | '1024x1536';
    quality: 'medium';
    output_format: 'webp' | 'jpeg';
}

interface BlogFrontmatter {
    slug: string;
    title: string;
    summary: string;
    tags: string[];
    status: 'published' | 'draft';
    sourcePath: string;
}

const BLOG_DIR = 'content/blog';
const OUTPUT_PREFIX = '/images/blog/';
const DEFAULT_OUTPUT = 'tmp/imagegen/blog-images.jsonl';
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const args = process.argv.slice(2);
const force = args.includes('--force');
const includeDrafts = args.includes('--include-drafts');

const parseOutputPath = (): string => {
    const arg = args.find((v) => v.startsWith('--out='));
    if (!arg) return DEFAULT_OUTPUT;
    const value = arg.split('=')[1]?.trim();
    return value || DEFAULT_OUTPUT;
};

const stripQuotes = (value: string): string => {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
};

const parseTags = (raw: string | undefined): string[] => {
    if (!raw) return [];
    const cleaned = raw.replace(/^\[/, '').replace(/\]$/, '');
    return cleaned
        .split(',')
        .map((tag) => stripQuotes(tag.trim()))
        .filter(Boolean);
};

const parseFrontmatter = (raw: string): Record<string, string> => {
    const normalized = raw.replace(/\r\n/g, '\n');
    const match = normalized.match(FRONTMATTER_REGEX);
    if (!match) return {};

    const meta: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separator = trimmed.indexOf(':');
        if (separator === -1) continue;

        const key = trimmed.slice(0, separator).trim().toLowerCase();
        const value = stripQuotes(trimmed.slice(separator + 1));
        meta[key] = value;
    }

    return meta;
};

const getPublishedBlogPosts = (): BlogFrontmatter[] => {
    const files = readdirSync(BLOG_DIR)
        .filter((file) => file.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b));

    const posts: BlogFrontmatter[] = [];

    for (const file of files) {
        const sourcePath = join(BLOG_DIR, file);
        const raw = readFileSync(sourcePath, 'utf8');
        const meta = parseFrontmatter(raw);

        const slug = (meta.slug || '').trim();
        const title = (meta.title || '').trim();
        const summary = (meta.summary || '').trim();
        const statusRaw = (meta.status || 'draft').trim().toLowerCase();
        const status: 'published' | 'draft' = statusRaw === 'published' ? 'published' : 'draft';

        if (!slug || !title) {
            process.stderr.write(`[blog-images] Skipping ${sourcePath}: missing slug or title\n`);
            continue;
        }

        if (!includeDrafts && status !== 'published') {
            continue;
        }

        posts.push({
            slug,
            title,
            summary,
            tags: parseTags(meta.tags),
            status,
            sourcePath,
        });
    }

    return posts;
};

const webPathToPublicPath = (webPath: string): string => join('public', webPath.replace(/^\//, ''));

const toBatchOutPath = (webPath: string): string => {
    if (!webPath.startsWith(OUTPUT_PREFIX)) {
        throw new Error(`Expected blog image path to start with ${OUTPUT_PREFIX}, got: ${webPath}`);
    }
    return webPath.slice(OUTPUT_PREFIX.length);
};

const variantSize = (variant: BlogImageVariant): '1536x1024' | '1024x1536' => {
    if (variant === 'ogVertical') return '1024x1536';
    return '1536x1024';
};

const variantOutputFormat = (variant: BlogImageVariant): 'webp' | 'jpeg' => {
    if (variant === 'ogVertical') return 'jpeg';
    return 'webp';
};

const main = () => {
    const outputPath = parseOutputPath();
    const posts = getPublishedBlogPosts();

    const jobs: ImageBatchJob[] = [];
    const downscaleRepairs: string[] = [];

    for (const post of posts) {
        const seed = buildBlogImageSeed({
            slug: post.slug,
            title: post.title,
            summary: post.summary,
            tags: post.tags,
        });
        const media = getBlogImageMedia(post.slug, post.title, seed.accentTint);

        const variants: Array<{
            variant: BlogImageVariant;
            large: string;
            responsive?: string[];
        }> = [
            {
                variant: 'card',
                large: media.card.sources.large,
                responsive: [
                    media.card.sources.xsmall,
                    media.card.sources.small,
                    media.card.sources.medium,
                ],
            },
            {
                variant: 'ogVertical',
                large: media.ogVertical.source,
            },
        ];

        for (const entry of variants) {
            const largePublicPath = webPathToPublicPath(entry.large);
            const largeExists = existsSync(largePublicPath);

            if (entry.responsive && largeExists) {
                for (const responsivePath of entry.responsive) {
                    if (!existsSync(webPathToPublicPath(responsivePath))) {
                        downscaleRepairs.push(responsivePath);
                    }
                }
            }

            if (!force && largeExists) {
                continue;
            }

            jobs.push({
                prompt: buildBlogImagePrompt(seed, entry.variant),
                out: toBatchOutPath(entry.large),
                size: variantSize(entry.variant),
                quality: 'medium',
                output_format: variantOutputFormat(entry.variant),
            });
        }
    }

    mkdirSync(dirname(outputPath), { recursive: true });

    const payload = jobs.length > 0
        ? `${jobs.map((job) => JSON.stringify(job)).join('\n')}\n`
        : '';

    writeFileSync(outputPath, payload, 'utf8');

    process.stdout.write(
        `[blog-images] Wrote ${jobs.length} generation job(s) to ${outputPath} from ${posts.length} post(s)` +
        `${force ? ' (force mode)' : ''}` +
        `${downscaleRepairs.length > 0 ? `; ${downscaleRepairs.length} responsive variant(s) need downscale repair` : ''}\n`,
    );
};

main();
