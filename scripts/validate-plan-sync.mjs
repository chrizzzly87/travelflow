import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const { PLAN_CATALOG, PLAN_ORDER } = await import('../config/planCatalog.ts');

const requiredTierKeys = PLAN_ORDER.map((key) => PLAN_CATALOG[key].publicSlug);
const requiredAnonymousTokens = ['{limit}', '{days}'];

const readJson = async (relativePath) => {
    const content = await fs.readFile(path.resolve(repoRoot, relativePath), 'utf8');
    return JSON.parse(content);
};

const findLocalePricingFiles = async () => {
    const localesDir = path.resolve(repoRoot, 'locales');
    const localeDirs = await fs.readdir(localesDir, { withFileTypes: true });
    const files = [];
    for (const dirent of localeDirs) {
        if (!dirent.isDirectory()) continue;
        const file = path.join('locales', dirent.name, 'pricing.json');
        files.push(file);
    }
    return files;
};

const failures = [];

const findLegacyInterpolationTokens = (value, currentPath = '') => {
    const found = [];
    if (typeof value === 'string') {
        if (value.includes('{{')) {
            found.push(currentPath || '<root>');
        }
        return found;
    }

    if (Array.isArray(value)) {
        value.forEach((entry, index) => {
            found.push(...findLegacyInterpolationTokens(entry, `${currentPath}[${index}]`));
        });
        return found;
    }

    if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, entry]) => {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            found.push(...findLegacyInterpolationTokens(entry, nextPath));
        });
    }

    return found;
};

const localePricingFiles = await findLocalePricingFiles();
for (const relativeFile of localePricingFiles) {
    const json = await readJson(relativeFile);
    const tiers = json?.tiers || {};

    const legacyInterpolationPaths = findLegacyInterpolationTokens(json);
    if (legacyInterpolationPaths.length > 0) {
        legacyInterpolationPaths.forEach((tokenPath) => {
            failures.push(`${relativeFile}: contains legacy interpolation token "{{...}}" at ${tokenPath}; use ICU "{...}" syntax`);
        });
    }

    for (const key of requiredTierKeys) {
        if (!tiers[key]) {
            failures.push(`${relativeFile}: missing tiers.${key}`);
        }
    }

    for (const staleKey of ['free', 'casual']) {
        if (tiers[staleKey]) {
            failures.push(`${relativeFile}: stale tier key "${staleKey}" should be removed`);
        }
    }

    const anonymousDescription = json?.anonymousLimits?.description || '';
    for (const token of requiredAnonymousTokens) {
        if (!anonymousDescription.includes(token)) {
            failures.push(`${relativeFile}: anonymousLimits.description must contain token ${token}`);
        }
    }
}

const pricingPagePath = path.resolve(repoRoot, 'pages/PricingPage.tsx');
const pricingPage = await fs.readFile(pricingPagePath, 'utf8');
for (const slug of requiredTierKeys) {
    if (!pricingPage.includes(`'${slug}'`)) {
        failures.push(`pages/PricingPage.tsx: missing tier id '${slug}'`);
    }
}

if (failures.length > 0) {
    console.error('Plan catalog sync validation failed:\n');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(`Plan sync validation passed for ${localePricingFiles.length} locale files.`);
