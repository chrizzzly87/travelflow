import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../../config/locales';

/**
 * The `connectivity` and `tripView` blocks shipped as verbatim English in every
 * non-English locale: `pnpm i18n:validate` only compared key shape, so a German
 * planner showed "Cloud sync is temporarily unavailable." These assertions pin
 * the two blocks that render the outage banners and the trip header.
 *
 * `i18next-icu` ships but is never registered in `i18n.ts`, so plural handling
 * here is explicit `*One` / `*Many` keys, never an ICU plural block.
 */
const TRANSLATED_BLOCKS = ['connectivity', 'tripView'] as const;
const ICU_COMPLEX_SYNTAX = /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/;

/**
 * Values that legitimately read the same in every language: brand names, the
 * support address and unit formats that are only a placeholder plus a symbol.
 */
const ALLOWED_IDENTICAL = new Set([
  'tripView.mapLinks.google',
  'tripView.mapLinks.apple',
]);

/** Loanwords and cognates that are the natural word in that specific language. */
const ALLOWED_IDENTICAL_PER_LOCALE: Partial<Record<string, string[]>> = {
  de: ['connectivity.globalBadge.offline', 'connectivity.globalBadge.online', 'tripView.infoDialog.tabs.debug', 'tripView.infoDialog.tabs.export'],
  es: ['tripView.infoDialog.tabs.general'],
  fr: ['connectivity.banner.actions.contact', 'tripView.infoDialog.tabs.destination', 'tripView.infoDialog.destination.futureChecks.visa'],
  it: ['connectivity.globalBadge.offline', 'connectivity.globalBadge.online', 'tripView.infoDialog.tabs.debug', 'tripView.generation.tripInfo.provider'],
  pl: ['connectivity.globalBadge.offline', 'connectivity.globalBadge.online', 'tripView.generation.tripInfo.model'],
  pt: ['connectivity.globalBadge.offline', 'connectivity.globalBadge.online'],
};

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
  it.each(otherLocales)('%s translates the connectivity and trip view copy', (locale) => {
    const localeStrings = scopedStrings(locale);
    const allowed = new Set(ALLOWED_IDENTICAL_PER_LOCALE[locale] ?? []);

    const untranslated = [...englishStrings.entries()]
      .filter(([key, englishValue]) => localeStrings.get(key) === englishValue)
      .map(([key]) => key)
      .filter((key) => !ALLOWED_IDENTICAL.has(key) && !allowed.has(key));

    expect(untranslated, `${locale} still shows English for: ${untranslated.join(', ')}`).toEqual([]);
  });

  it.each(otherLocales)('%s covers every connectivity and tripView key', (locale) => {
    const localeStrings = scopedStrings(locale);
    const missing = [...englishStrings.keys()].filter((key) => !localeStrings.has(key));
    expect(missing, `${locale} is missing: ${missing.join(', ')}`).toEqual([]);
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
});
