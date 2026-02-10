import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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

const main = () => {
    const outputPath = parseOutputPath();

    const jobs = [
        ...collectMedia(destinationCardMedia).map(toBatchEntry),
        ...collectMedia(festivalCardMedia).map(toBatchEntry),
    ];

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${jobs.map((job) => JSON.stringify(job)).join('\n')}\n`, 'utf8');

    process.stdout.write(`Wrote ${jobs.length} jobs to ${outputPath}\n`);
};

main();
