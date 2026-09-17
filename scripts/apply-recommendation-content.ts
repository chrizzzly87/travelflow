/**
 * Merges the hand-written copy for a country into its recommendation dataset.
 *
 * The imported dataset carries what the source map said — usually one line.
 * The editorial layer lives beside it in `<cc>.content.json`, keyed by slug,
 * and is the file a human edits. Keeping the two apart means re-running the
 * import or the photo enrichment never overwrites written copy, and a diff on
 * the content file shows only what somebody actually wrote.
 *
 *   pnpm tsx scripts/apply-recommendation-content.ts --country TW
 *   pnpm tsx scripts/apply-recommendation-content.ts --country TW --apply
 */

import fs from 'node:fs';
import path from 'node:path';

import { COST_BAND_VALUES, type RecommendationDataset } from '../shared/recommendations';

interface ContentEntry {
    description?: string;
    highlights?: string[];
    costBand?: string;
    typicalDurationMinutes?: number;
}

interface ContentFile {
    countryCode: string;
    entries: Record<string, ContentEntry>;
}

const readArg = (name: string): string | null => {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return null;
    return process.argv[index + 1] ?? null;
};

const main = (): void => {
    const countryCode = (readArg('country') || '').toUpperCase();
    const apply = process.argv.includes('--apply');
    if (!countryCode) {
        console.error('Usage: --country <ISO2> [--apply]');
        process.exit(1);
    }

    const base = path.resolve(process.cwd(), 'data/recommendations');
    const datasetPath = path.join(base, `${countryCode.toLowerCase()}.json`);
    const contentPath = path.join(base, `${countryCode.toLowerCase()}.content.json`);

    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8')) as RecommendationDataset;
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8')) as ContentFile;

    const bySlug = new Map(dataset.recommendations.map((entry) => [entry.slug, entry]));
    let applied = 0;
    const unknownSlugs: string[] = [];

    Object.entries(content.entries).forEach(([slug, entry]) => {
        const recommendation = bySlug.get(slug);
        if (!recommendation) {
            unknownSlugs.push(slug);
            return;
        }

        if (entry.description) recommendation.description = entry.description;
        if (entry.highlights?.length) recommendation.highlights = [...entry.highlights];
        if (entry.costBand && (COST_BAND_VALUES as readonly string[]).includes(entry.costBand)) {
            recommendation.costBand = entry.costBand as RecommendationDataset['recommendations'][number]['costBand'];
        }
        if (typeof entry.typicalDurationMinutes === 'number') {
            recommendation.typicalDurationMinutes = entry.typicalDurationMinutes;
        }
        applied += 1;
    });

    const missingCopy = dataset.recommendations.filter((entry) => !content.entries[entry.slug]);

    console.log(`Recommendations:   ${dataset.recommendations.length}`);
    console.log(`Copy applied:      ${applied}`);
    console.log(`Without copy:      ${missingCopy.length}`);
    if (missingCopy.length > 0) {
        missingCopy.forEach((entry) => console.log(`  - ${entry.slug}`));
    }
    if (unknownSlugs.length > 0) {
        console.log(`Unknown slugs in content file: ${unknownSlugs.join(', ')}`);
    }

    if (!apply) {
        console.log('');
        console.log('Preview only. Re-run with --apply to write the dataset.');
        process.exit(2);
    }

    dataset.generatedAt = new Date().toISOString();
    fs.writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`);
    console.log('');
    console.log(`Wrote ${path.relative(process.cwd(), datasetPath)}`);
};

main();
