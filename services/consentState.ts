export const CONSENT_STORAGE_KEY = 'tf_cookie_consent_choice_v1';

export type ConsentChoice = 'all' | 'essential';

export const isConsentChoice = (value: unknown): value is ConsentChoice =>
  value === 'all' || value === 'essential';

export const readConsentChoiceFromStorage = (): ConsentChoice | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return isConsentChoice(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const isOptionalConsentGranted = (choice: ConsentChoice | null): boolean =>
  choice === 'all';
