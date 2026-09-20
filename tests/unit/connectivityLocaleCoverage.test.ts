import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../../config/locales';

/**
 * The `connectivity` and `tripView` blocks once shipped as verbatim English in
 * every non-English locale: `pnpm i18n:validate` only compared key shape, so a
 * German planner showed "Cloud sync is temporarily unavailable." These
 * assertions pin the two blocks that render the outage banners and the trip
 * header.
 *
 * `i18next-icu` ships but is never registered in `i18n.ts`, so plural handling
 * here is explicit `*One` / `*Many` keys, never an ICU plural block.
 */
const TRANSLATED_BLOCKS = ['connectivity', 'tripView'] as const;
const ICU_COMPLEX_SYNTAX = /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/;

/**
 * Names of things, not words. These keys are *allowed* to read the same as
 * English -- "Mapbox" is Mapbox in Warsaw and in Seoul, and a Polish planner
 * offering "Mapapudełko" would name a product that does not exist.
 *
 * Allowed, not required. Google and Apple publish real localized names for
 * Maps, and the locales here use them: "Google Карты" in Russian, "Google 지도"
 * in Korean, "نقشه گوگل" in Persian. So this list only exempts these keys from
 * the sentence check below; it never asserts that they stayed English.
 *
 * It is locale-independent, which is what keeps it stable: adding a language
 * does not touch it, and a brand only ever appears here once.
 */
const BRAND_NAMES = new Set([
  'tripView.mapLinks.google',
  'tripView.mapLinks.apple',
  'tripView.mapCustomize.handoff.google',
  'tripView.mapCustomize.handoff.apple',
  'tripView.mapCustomize.renderer.google',
  'tripView.mapCustomize.renderer.mapbox',
]);

/**
 * Why short labels are reported instead of failed
 * ----------------------------------------------
 * The regression worth a red build is an untranslated *sentence* -- a whole
 * English string shipped verbatim, like "Cloud sync is temporarily
 * unavailable." in the German planner. Nobody chooses that; it is always an
 * oversight, and a reader hits it mid-task.
 *
 * A one-word UI label is a different thing. Auditing every identical value in
 * these blocks turned up "Standard", "Normal", "Minimal", "Base", "Satellite",
 * "Export", "Debug", "General", "Direct", "Destination", "Visa", "Model",
 * "Offline", "Online" and "Mono" -- and each one is the correct word in the
 * language that flagged it. The heuristic found zero real misses and a dozen
 * false alarms, which it then paid for with a hand-maintained per-locale
 * allowlist that every new label had to be added to. Branches that predated the
 * last allowlist edit failed on keys they never touched.
 *
 * So single-word values are surfaced as a note and never fail the run. A human
 * reading "es: tripView.mapCustomize.base.label" can tell in a second whether
 * "Base" is Spanish; a build that blocks on it cannot, and blocks either way.
 */
const isSentence = (value: string): boolean => value.trim().split(/\s+/).length > 1;

const readCommon = (locale: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'locales', locale, 'common.json'), 'utf8'));

const collectStrings = (value: unknown, keyPath = ''): Array<[string, string]> => {
  if (typeof value === 'string') return [[keyPath, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, entry]) => collectStrings(entry, keyPath ? `${keyPath}.${key}` : key));
};

const scopedStrings = (locale: string): Map<string, string> => {
  const doc = readCommon(locale);
  const entries = TRANSLATED_BLOCKS.flatMap((block) => collectStrings(doc[block], block));
  return new Map(entries);
};

const englishStrings = scopedStrings('en');
const otherLocales = SUPPORTED_LOCALES.filter((locale) => locale !== 'en');

describe('connectivity and tripView locale coverage', () => {
  it.each(otherLocales)('%s covers every connectivity and tripView key', (locale) => {
    const localeStrings = scopedStrings(locale);
    const missing = [...englishStrings.keys()].filter((key) => !localeStrings.has(key));
    expect(missing, `${locale} is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it.each(otherLocales)('%s translates the connectivity and tripView sentences', (locale) => {
    const localeStrings = scopedStrings(locale);

    const untranslated = [...englishStrings.entries()]
      .filter(([key, englishValue]) => localeStrings.get(key) === englishValue)
      .filter(([key, englishValue]) => isSentence(englishValue) && !BRAND_NAMES.has(key))
      .map(([key]) => key);

    expect(untranslated, `${locale} still shows English for: ${untranslated.join(', ')}`).toEqual([]);
  });

  it.each(SUPPORTED_LOCALES)('%s keeps the same placeholders as English', (locale) => {
    const localeStrings = scopedStrings(locale);
    const placeholdersOf = (value: string): string[] =>
      (value.match(/\{(\w+)\}/g) ?? []).map((token) => token.slice(1, -1)).sort();

    englishStrings.forEach((englishValue, key) => {
      const localeValue = localeStrings.get(key);
      if (localeValue === undefined) return;
      expect(placeholdersOf(localeValue), `${locale}.${key}`).toEqual(placeholdersOf(englishValue));
    });
  });

  it.each(SUPPORTED_LOCALES)('%s uses explicit One/Many keys instead of ICU plurals', (locale) => {
    scopedStrings(locale).forEach((value, key) => {
      expect(ICU_COMPLEX_SYNTAX.test(value), `${locale}.${key}: ${value}`).toBe(false);
    });
  });

  /**
   * Not an assertion. Prints the short identical labels so a reviewer can scan
   * them, without any of them being able to stop a build.
   */
  it('reports short labels that read the same as English', () => {
    const notes = otherLocales.flatMap((locale) => {
      const localeStrings = scopedStrings(locale);
      return [...englishStrings.entries()]
        .filter(([key, englishValue]) => localeStrings.get(key) === englishValue)
        .filter(([key, englishValue]) => !isSentence(englishValue) && !BRAND_NAMES.has(key))
        .map(([key, englishValue]) => `  ${locale}: ${key} = ${JSON.stringify(englishValue)}`);
    });

    if (notes.length > 0) {
      console.info(
        `[i18n] ${notes.length} short label(s) read the same as English. Expected for cognates `
          + `("Standard", "Normal", "Base"); worth a look if one is a real word in English only:\n`
          + notes.join('\n'),
      );
    }

    expect(true).toBe(true);
  });
});
