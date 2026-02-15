import fs from 'node:fs/promises';
import path from 'node:path';

const LOCALES_DIR = path.resolve(process.cwd(), 'locales');
const DEFAULT_LOCALE = 'en';
const LEGACY_INTERPOLATION_PATTERN = /\{\{[^{}]+\}\}/;

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const getLocaleDirs = async () => {
  const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

const getLocaleJsonFiles = async (locale) => {
  const localeDir = path.join(LOCALES_DIR, locale);
  const entries = await fs.readdir(localeDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
};

const findLegacyInterpolationTokens = (value, currentPath = '<root>') => {
  const failures = [];

  if (typeof value === 'string') {
    if (LEGACY_INTERPOLATION_PATTERN.test(value)) {
      failures.push(currentPath);
    }
    return failures;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      failures.push(...findLegacyInterpolationTokens(entry, `${currentPath}[${index}]`));
    });
    return failures;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      const nextPath = currentPath === '<root>' ? key : `${currentPath}.${key}`;
      failures.push(...findLegacyInterpolationTokens(entry, nextPath));
    });
  }

  return failures;
};

const main = async () => {
  const failures = [];
  const locales = await getLocaleDirs();

  if (locales.length === 0) {
    failures.push('No locale directories found in locales/.');
  }

  if (!locales.includes(DEFAULT_LOCALE)) {
    failures.push(`Default locale "${DEFAULT_LOCALE}" is missing from locales/.`);
  }

  if (failures.length > 0) {
    console.error('[i18n:validate] failed');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  const defaultFiles = await getLocaleJsonFiles(DEFAULT_LOCALE);

  for (const locale of locales) {
    const files = await getLocaleJsonFiles(locale);
    const missingFiles = defaultFiles.filter((file) => !files.includes(file));
    const extraFiles = files.filter((file) => !defaultFiles.includes(file));

    missingFiles.forEach((file) => {
      failures.push(`locales/${locale}: missing namespace file ${file}`);
    });

    extraFiles.forEach((file) => {
      failures.push(`locales/${locale}: extra namespace file ${file} (not present in locales/${DEFAULT_LOCALE})`);
    });

    for (const file of files) {
      const fullPath = path.join(LOCALES_DIR, locale, file);
      try {
        const json = await readJson(fullPath);
        const tokenPaths = findLegacyInterpolationTokens(json);
        tokenPaths.forEach((tokenPath) => {
          failures.push(`locales/${locale}/${file}: legacy interpolation token "{{...}}" at ${tokenPath}; use ICU "{...}" syntax`);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
        failures.push(`locales/${locale}/${file}: invalid JSON (${message})`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('[i18n:validate] failed');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`[i18n:validate] validated ${locales.length} locale(s), ${defaultFiles.length} namespace file(s) each`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
