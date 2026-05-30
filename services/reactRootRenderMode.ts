export const PRERENDERED_ROOT_ATTRIBUTE = 'data-tf-prerendered-root';

const PERSONALIZED_STORAGE_KEY_EXACT_MATCHES = new Set([
  'tf_early_access_dismissed',
  'tf_locale_suggestion_dismissed_session',
  'tf_locale_suggestion_switched',
  'tf_translation_notice_dismissed_session',
]);

const isPersonalizedStorageKey = (keyName: string): boolean => {
  if (PERSONALIZED_STORAGE_KEY_EXACT_MATCHES.has(keyName)) return true;
  if (keyName.startsWith('tf_auth_')) return true;
  if (keyName.startsWith('tf_e2e_auth_')) return true;
  if (keyName.startsWith('sb-') && keyName.includes('auth-token')) return true;
  return false;
};

const storageContainsPersonalizedState = (storage: Storage): boolean => {
  for (let index = 0; index < storage.length; index += 1) {
    const keyName = storage.key(index);
    if (keyName && isPersonalizedStorageKey(keyName)) return true;
  }
  return false;
};

const hasPersonalizedBrowserState = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    if (storageContainsPersonalizedState(window.localStorage)) return true;
  } catch {
    return false;
  }

  try {
    return storageContainsPersonalizedState(window.sessionStorage);
  } catch {
    return false;
  }
};

export const shouldHydrateReactRoot = (rootElement: HTMLElement): boolean => {
  if (!rootElement.hasChildNodes()) return false;
  if (!rootElement.hasAttribute(PRERENDERED_ROOT_ATTRIBUTE)) return true;
  return !hasPersonalizedBrowserState();
};
