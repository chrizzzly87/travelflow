import i18n, { preloadLocaleNamespaces } from '../../i18n';

/**
 * `i18n.ts` starts `init()` without awaiting it, and `useTranslation` suspends
 * until the instance reports itself initialized. On a slow CI runner a render
 * could land first and leave an empty container, so wait for it explicitly.
 */
const waitForI18nInit = (): Promise<void> => new Promise((resolve) => {
  if (i18n.isInitialized) {
    resolve();
    return;
  }
  const onInitialized = () => {
    i18n.off('initialized', onInitialized);
    resolve();
  };
  i18n.on('initialized', onInitialized);
});

/**
 * Registers the app's real i18next instance and loads a locale's `common`
 * bundle, so components render the labels users see. Without it,
 * `useTranslation` has no instance and hands back raw keys.
 */
export const loadCommonTranslations = async (language: string): Promise<void> => {
  await waitForI18nInit();
  await preloadLocaleNamespaces(language, ['common']);
  await i18n.changeLanguage(language);
  if (!i18n.hasLoadedNamespace('common')) {
    throw new Error(`i18n common bundle for "${language}" did not load`);
  }
};

export const loadEnglishCommonTranslations = (): Promise<void> => loadCommonTranslations('en');
