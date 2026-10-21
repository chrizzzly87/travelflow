import fs from 'node:fs/promises';
import path from 'node:path';

const LOCALES_DIR = path.resolve(process.cwd(), 'locales');
const ALLOWLIST_PATH = path.resolve(process.cwd(), 'scripts/i18n-identical-allowlist.json');
const DEFAULT_LOCALE = 'en';
const LEGACY_INTERPOLATION_PATTERN = /\{\{[^{}]+\}\}/;
// i18next-icu ships but is never registered in i18n.ts, so ICU plural/select
// blocks reach the user as raw source text. Explicit One/Many keys instead.
const ICU_CATEGORY_PATTERN = /\{\s*[a-zA-Z0-9_]+\s*,\s*(plural|select|selectordinal)\s*,/;
// Escalates the advisory checks (key parity, values identical to English)
// into build failures. Off by default while fa/ur still carry key gaps.
const STRICT = process.argv.includes('--strict');

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

/** Flattens a namespace object into dot-notation leaf paths. */
const flattenLeaves = (value, currentPath = '', out = {}) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      flattenLeaves(entry, currentPath ? `${currentPath}.${key}` : key, out);
    });
    return out;
  }
  out[currentPath] = value;
  return out;
};

// i18next native plurals: a locale carries exactly the CLDR categories
// Intl.PluralRules resolves for it, so `key_few` existing in pl but not in en
// is correct, not a parity gap. Compare the base key instead.
const PLURAL_SUFFIX_PATTERN = /_(zero|one|two|few|many|other)$/;
const basePluralKey = (key) => key.replace(PLURAL_SUFFIX_PATTERN, '');

const readAllowlist = async () => {
  try {
    return JSON.parse(await fs.readFile(ALLOWLIST_PATH, 'utf8'));
  } catch {
    return { sharedKeys: [], perLocale: {} };
  }
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

        Object.entries(flattenLeaves(json)).forEach(([leafPath, leafValue]) => {
          if (typeof leafValue === 'string' && ICU_CATEGORY_PATTERN.test(leafValue)) {
            failures.push(
              `locales/${locale}/${file}: ICU plural/select block at ${leafPath}; i18next-icu is not registered, so this renders as raw text. Use explicit One/Many keys.`,
            );
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
        failures.push(`locales/${locale}/${file}: invalid JSON (${message})`);
      }
    }
  }

  // --- Advisory pass -------------------------------------------------------
  // Key parity and "value is still the English string" are reported as
  // warnings so a partially translated locale never blocks a build. Pass
  // --strict (CI, or once the backlog is clear) to turn them into failures.
  const allowlist = await readAllowlist();
  const sharedAllowed = new Set(allowlist.sharedKeys ?? []);
  const warnings = [];

  for (const file of defaultFiles) {
    const defaultLeaves = flattenLeaves(await readJson(path.join(LOCALES_DIR, DEFAULT_LOCALE, file)));

    for (const locale of locales) {
      if (locale === DEFAULT_LOCALE) continue;
      const localeAllowed = new Set(allowlist.perLocale?.[locale] ?? []);
      let localeLeaves;
      try {
        localeLeaves = flattenLeaves(await readJson(path.join(LOCALES_DIR, locale, file)));
      } catch {
        continue; // unreadable/invalid JSON is already a hard failure above
      }

      const defaultBases = new Set(Object.keys(defaultLeaves).map(basePluralKey));
      const localeBases = new Set(Object.keys(localeLeaves).map(basePluralKey));
      const missing = [...defaultBases].filter((key) => !localeBases.has(key));
      const extra = [...localeBases].filter((key) => !defaultBases.has(key));
      if (missing.length > 0) {
        warnings.push(`locales/${locale}/${file}: ${missing.length} key(s) missing vs ${DEFAULT_LOCALE} (e.g. ${missing.slice(0, 3).join(', ')})`);
      }
      if (extra.length > 0) {
        warnings.push(`locales/${locale}/${file}: ${extra.length} key(s) not present in ${DEFAULT_LOCALE} (e.g. ${extra.slice(0, 3).join(', ')})`);
      }

      const untranslated = Object.keys(defaultLeaves).filter((key) => {
        if (!(key in localeLeaves)) return false;
        if (typeof defaultLeaves[key] !== 'string') return false;
        if (localeLeaves[key] !== defaultLeaves[key]) return false;
        const qualified = `${file}:${key}`;
        return !sharedAllowed.has(qualified) && !localeAllowed.has(qualified);
      });
      if (untranslated.length > 0) {
        warnings.push(
          `locales/${locale}/${file}: ${untranslated.length} value(s) identical to ${DEFAULT_LOCALE} (${untranslated.slice(0, 5).join(', ')}${untranslated.length > 5 ? ', …' : ''})`,
        );
      }
    }
  }

  if (STRICT) {
    failures.push(...warnings);
  }

  if (failures.length > 0) {
    console.error('[i18n:validate] failed');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn(`[i18n:validate] ${warnings.length} warning(s) — run with --strict to fail on these:`);
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  console.log(`[i18n:validate] validated ${locales.length} locale(s), ${defaultFiles.length} namespace file(s) each`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
