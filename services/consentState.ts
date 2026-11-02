import { readLocalStorageItem } from './browserStorageService';

export const CONSENT_STORAGE_KEY = 'tf_cookie_consent_choice_v1';

export const CONSENT_DOCUMENT_ATTRIBUTE = 'data-tf-consent';

export type ConsentChoice = 'all' | 'essential';

export const isConsentChoice = (value: unknown): value is ConsentChoice =>
  value === 'all' || value === 'essential';

export const readConsentChoiceFromStorage = (): ConsentChoice | null => {
  try {
    const stored = readLocalStorageItem(CONSENT_STORAGE_KEY);
    return isConsentChoice(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const isOptionalConsentGranted = (choice: ConsentChoice | null): boolean =>
  choice === 'all';

/** A choice remains effective in this document even when persistence is blocked. */
export const readCurrentConsentChoice = (): ConsentChoice | null => {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.getAttribute(CONSENT_DOCUMENT_ATTRIBUTE);
    if (isConsentChoice(current)) return current;
  }
  return readConsentChoiceFromStorage();
};
