import i18n, { preloadLocaleNamespaces } from '../../i18n';

/**
 * Registers the app's real i18next instance and loads the English `common`
 * bundle, so components render the same labels users see. Without it,
 * `useTranslation` has no instance and hands back raw keys.
 */
export const loadEnglishCommonTranslations = async (): Promise<void> => {
  await preloadLocaleNamespaces('en', ['common']);
  await i18n.changeLanguage('en');
};
