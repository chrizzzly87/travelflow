import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../../config/locales';

/**
 * `i18next-icu` ships in package.json but is never registered in `i18n.ts`, so ICU
 * plural/select syntax renders as raw pattern text in the browser instead of being
 * evaluated. These assertions keep the festivals copy inside what the runtime can
 * actually format: plain `{name}` placeholders only.
 */
const ICU_COMPLEX_SYNTAX = /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/;
const LEGACY_MOUSTACHE = /\{\{[^{}]+\}\}/;

const readFestivals = (locale: string): Record<string, unknown> => {
  const file = path.resolve(process.cwd(), 'locales', locale, 'pages.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  return doc.inspirations.subpages.festivals;
};

const collectStrings = (value: unknown, keyPath = ''): Array<[string, string]> => {
  if (typeof value === 'string') return [[keyPath, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, entry]) => collectStrings(entry, keyPath ? `${keyPath}.${key}` : key));
};

describe('festivals locale copy', () => {
  it.each(SUPPORTED_LOCALES)('%s has no unsupported ICU plural or select syntax', (locale) => {
    collectStrings(readFestivals(locale)).forEach(([keyPath, value]) => {
      expect(ICU_COMPLEX_SYNTAX.test(value), `${locale}.${keyPath}: ${value}`).toBe(false);
    });
  });

  it.each(SUPPORTED_LOCALES)('%s uses ICU-style single-brace placeholders', (locale) => {
    collectStrings(readFestivals(locale)).forEach(([keyPath, value]) => {
      expect(LEGACY_MOUSTACHE.test(value), `${locale}.${keyPath}: ${value}`).toBe(false);
    });
  });

  it('keeps the same placeholders in every locale as in English', () => {
    const placeholdersOf = (value: string): string[] => (
      (value.match(/\{(\w+)\}/g) || []).map((token) => token.slice(1, -1)).sort()
    );

    const english = new Map(collectStrings(readFestivals('en')));

    SUPPORTED_LOCALES.filter((locale) => locale !== 'en').forEach((locale) => {
      collectStrings(readFestivals(locale)).forEach(([keyPath, value]) => {
        const source = english.get(keyPath);
        if (source === undefined) return;
        expect(placeholdersOf(value), `${locale}.${keyPath}`).toEqual(placeholdersOf(source));
      });
    });
  });
});
