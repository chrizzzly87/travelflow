import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../../config/locales';

/**
 * `i18next-icu` is in package.json but is never registered in `i18n.ts`, so an
 * ICU plural/select block is handed to the user as raw pattern source rather
 * than being formatted. `storageNotice.tripsPrunedDescription` shipped that way
 * in all eleven locales; this sweeps every namespace so it cannot come back.
 *
 * Plural copy belongs in explicit `*One` / `*Many` keys, with the caller
 * choosing the variant. See tests/unit/tripsPrunedNotice.test.ts.
 */
const ICU_COMPLEX_SYNTAX = /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/;
const LOCALES_DIR = path.resolve(process.cwd(), 'locales');
const NAMESPACES = fs.readdirSync(path.join(LOCALES_DIR, 'en')).filter((file) => file.endsWith('.json'));

const collectStrings = (value: unknown, keyPath = ''): Array<[string, string]> => {
  if (typeof value === 'string') return [[keyPath, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, entry]) => collectStrings(entry, keyPath ? `${keyPath}.${key}` : key));
};

describe('locale files avoid unsupported ICU syntax', () => {
  it.each(SUPPORTED_LOCALES)('%s has no ICU plural or select block in any namespace', (locale) => {
    const offenders = NAMESPACES.flatMap((namespace) => {
      const doc = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale, namespace), 'utf8'));
      return collectStrings(doc)
        .filter(([, value]) => ICU_COMPLEX_SYNTAX.test(value))
        .map(([keyPath]) => `${namespace}:${keyPath}`);
    });

    expect(offenders, `${locale} renders raw ICU source at: ${offenders.join(', ')}`).toEqual([]);
  });
});
