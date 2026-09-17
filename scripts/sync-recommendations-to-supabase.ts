/**
 * Seeds the `recommendations` table from a repo dataset.
 *
 * Run this once per country after the migration is applied. Afterwards the
 * table is the source of truth and the admin is where edits happen — running
 * this again would overwrite editorial changes with the file, which is why it
 * refuses unless `--apply` is passed and reports exactly what it would touch.
 *
 *   pnpm tsx scripts/sync-recommendations-to-supabase.ts --country TW
 *   pnpm tsx scripts/sync-recommendations-to-supabase.ts --country TW --apply
 *   pnpm tsx scripts/sync-recommendations-to-supabase.ts --country TW --apply --publish
 *
 * Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in `.env.local`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { recommendationToRow } from '../shared/recommendationRows';
import type { RecommendationDataset } from '../shared/recommendations';

const readArg = (name: string): string | null => {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return null;
    return process.argv[index + 1] ?? null;
};

const readEnvFile = (name: string): string => {
    for (const filename of ['.env.local', '.env']) {
        try {
            const content = fs.readFileSync(path.resolve(process.cwd(), filename), 'utf-8');
            const match = content.match(new RegExp(`^${name}=(.+)$`, 'm'));
            if (match) return match[1].trim().replace(/^"|"$/g, '');
        } catch { /* not present */ }
    }
    return process.env[name] || '';
};

const CHUNK = 100;

const main = async (): Promise<void> => {
    const countryCode = (readArg('country') || '').toUpperCase();
    const apply = process.argv.includes('--apply');
    const publish = process.argv.includes('--publish');
    if (!/^[A-Z]{2}$/.test(countryCode)) {
        console.error('Usage: --country <ISO2> [--apply] [--publish]');
        process.exit(1);
    }

    const supabaseUrl = readEnvFile('VITE_SUPABASE_URL').replace(/\/+$/, '');
    const serviceRoleKey = readEnvFile('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
        console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
        process.exit(1);
    }

    const datasetPath = path.resolve(process.cwd(), 'data/recommendations', `${countryCode.toLowerCase()}.json`);
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8')) as RecommendationDataset;
    const rows = dataset.recommendations.map((recommendation) => {
        const row = recommendationToRow(recommendation);
        // The repo copy is imported content; publishing it is an explicit act.
        return publish ? { ...row, status: 'published' } : row;
    });

    const headers = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
    };

    const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/recommendations?select=id,status&country_code=eq.${countryCode}&limit=5000`,
        { headers },
    );
    if (!existingResponse.ok) {
        console.error(`Could not read the table: ${existingResponse.status} ${await existingResponse.text()}`);
        process.exit(1);
    }
    const existing = await existingResponse.json() as Array<{ id: string; status: string }>;
    const existingIds = new Set(existing.map((entry) => entry.id));
    const newIds = rows.filter((row) => !existingIds.has(row.id));
    const overwritten = rows.filter((row) => existingIds.has(row.id));

    console.log(`Dataset:      ${dataset.recommendations.length} recommendations for ${countryCode}`);
    console.log(`Already there: ${existing.length}`);
    console.log(`Would insert:  ${newIds.length}`);
    console.log(`Would OVERWRITE editorial changes on: ${overwritten.length}`);
    console.log(`Status on write: ${publish ? 'published' : 'from the dataset (in_review for imported rows)'}`);

    if (!apply) {
        console.log('');
        console.log('Preview only. Re-run with --apply to write.');
        process.exit(2);
    }

    let written = 0;
    for (let index = 0; index < rows.length; index += CHUNK) {
        const chunk = rows.slice(index, index + CHUNK);
        const response = await fetch(`${supabaseUrl}/rest/v1/recommendations?on_conflict=id`, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal,resolution=merge-duplicates' },
            body: JSON.stringify(chunk),
        });
        if (!response.ok) {
            console.error(`Write failed at row ${index}: ${response.status} ${await response.text()}`);
            process.exit(1);
        }
        written += chunk.length;
        console.log(`  wrote ${written}/${rows.length}`);
    }

    console.log('');
    console.log(`Synced ${written} recommendations for ${countryCode}.`);
    if (!publish) {
        console.log('Nothing is visible to travellers until the rows are published in the admin.');
    }
};

main().catch((error) => {
    console.error('Sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});
