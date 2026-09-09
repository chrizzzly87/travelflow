import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '../../config/locales';

import deCommon from '../../locales/de/common.json';
import enCommon from '../../locales/en/common.json';
import plCommon from '../../locales/pl/common.json';

/**
 * Regression coverage for the trips-pruned toast copy.
 *
 * The string previously used ICU plural syntax (`{count, plural, one {...} other {...}}`),
 * but `i18n.ts` registers no ICU plugin — it only overrides the interpolation
 * prefix/suffix to single braces. ICU blocks therefore rendered literally to the
 * user. These keys now use i18next native plural suffixes instead.
 */

const createI18n = async (language: string, resources: Record<string, unknown>) => {
  const instance = createInstance();
  await instance.init({
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common'],
    resources: { [language]: { common: resources } },
    // Mirrors the runtime interpolation config in i18n.ts.
    interpolation: {
      prefix: '{',
      suffix: '}',
      escapeValue: false,
    },
  });
  return instance;
};

describe('storageNotice trips-pruned copy', () => {
  it('renders English singular and plural without leaking ICU syntax', async () => {
    const t = (await createI18n('en', enCommon)).getFixedT('en', 'common');

    expect(t('storageNotice.tripsPrunedDescription', { count: 1 })).toBe(
      'Your oldest saved trip was removed from this device to free up space.',
    );
    expect(t('storageNotice.tripsPrunedDescription', { count: 3 })).toBe(
      'Your 3 oldest saved trips were removed from this device to free up space.',
    );
  });

  it('renders German plural forms', async () => {
    const t = (await createI18n('de', deCommon)).getFixedT('de', 'common');

    expect(t('storageNotice.tripsPrunedDescription', { count: 1 })).toContain('älteste gespeicherte Reise');
    expect(t('storageNotice.tripsPrunedDescription', { count: 5 })).toContain('5 ältesten gespeicherten Reisen');
  });

  it('selects the Polish few/many categories', async () => {
    const t = (await createI18n('pl', plCommon)).getFixedT('pl', 'common');

    expect(t('storageNotice.tripsPrunedDescription', { count: 1 })).toContain('najstarsza zapisana podróż');
    expect(t('storageNotice.tripsPrunedDescription', { count: 2 })).toContain('2 najstarsze zapisane podróże');
    expect(t('storageNotice.tripsPrunedDescription', { count: 7 })).toContain('7 najstarszych zapisanych podróży');
  });

  it('never emits raw ICU output for any locale or count', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const resources = (await import(`../../locales/${locale}/common.json`)).default as Record<string, unknown>;
      const t = (await createI18n(locale, resources)).getFixedT(locale, 'common');

      for (const count of [0, 1, 2, 5, 11, 21, 100]) {
        const rendered = t('storageNotice.tripsPrunedDescription', { count });

        expect(rendered, `${locale} @ ${count}`).not.toContain('plural,');
        expect(rendered, `${locale} @ ${count}`).not.toContain('{');
        expect(rendered, `${locale} @ ${count}`).not.toContain('#');
        expect(rendered, `${locale} @ ${count}`).not.toBe('storageNotice.tripsPrunedDescription');
      }
    }
  });

  it('covers every CLDR plural category each locale can resolve', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const resources = (await import(`../../locales/${locale}/common.json`)).default as {
        storageNotice: Record<string, string>;
      };
      const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

      for (const category of categories) {
        expect(
          resources.storageNotice[`tripsPrunedDescription_${category}`],
          `locales/${locale}/common.json is missing tripsPrunedDescription_${category}`,
        ).toBeTruthy();
      }
    }
  });
});
