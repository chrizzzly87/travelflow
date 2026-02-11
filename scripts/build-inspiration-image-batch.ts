import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
    buildInspirationImagePrompt,
    destinationCardMedia,
    festivalCardMedia,
    type InspirationCardMedia,
} from '../data/inspirationCardMedia';

interface ImageBatchJob {
    prompt: string;
    out: string;
    size: '1536x1024';
    quality: 'medium';
    output_format: 'webp';
}

const OUTPUT_PREFIX = '/images/inspirations/';
const DEFAULT_OUTPUT = 'tmp/imagegen/inspiration-cards.jsonl';
const force = process.argv.slice(2).includes('--force');

const parseOutputPath = (): string => {
    const arg = process.argv.slice(2).find((v) => v.startsWith('--out='));
    if (!arg) return DEFAULT_OUTPUT;
    const value = arg.split('=')[1]?.trim();
    return value || DEFAULT_OUTPUT;
};

const toBatchEntry = (media: InspirationCardMedia): ImageBatchJob => ({
    prompt: buildInspirationImagePrompt(media.promptSeed),
    out: media.sources.large.replace(OUTPUT_PREFIX, ''),
    size: '1536x1024',
    quality: 'medium',
    output_format: 'webp',
});

const collectMedia = (collection: Partial<Record<string, InspirationCardMedia>>): InspirationCardMedia[] =>
    Object.values(collection).filter((media): media is InspirationCardMedia => Boolean(media));

const webPathToPublicPath = (webPath: string): string => join('public', webPath.replace(/^\//, ''));

const main = () => {
    const outputPath = parseOutputPath();

    const allMedia = [
        ...collectMedia(destinationCardMedia),
        ...collectMedia(festivalCardMedia),
    ];

    const jobs: ImageBatchJob[] = [];
    const derivativeRepairs: string[] = [];

    for (const media of allMedia) {
        const largeExists = existsSync(webPathToPublicPath(media.sources.large));

        if (largeExists) {
            const derivatives = [media.sources.xsmall, media.sources.small, media.sources.medium];
            for (const derivative of derivatives) {
                if (!existsSync(webPathToPublicPath(derivative))) {
                    derivativeRepairs.push(derivative);
                }
            }
        }

        if (!force && largeExists) {
            continue;
        }

        jobs.push(toBatchEntry(media));
    }

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${jobs.map((job) => JSON.stringify(job)).join('\n')}\n`, 'utf8');

    process.stdout.write(
        `Wrote ${jobs.length} jobs to ${outputPath}` +
        `${force ? ' (force mode)' : ''}` +
        `${derivativeRepairs.length > 0 ? `; ${derivativeRepairs.length} responsive variant(s) need downscale repair` : ''}` +
        '\n',
    );
};

main();
