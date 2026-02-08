export const CONSENT_STORAGE_KEY = 'tf_cookie_consent_choice_v1';
const CONSENT_CHANGE_EVENT = 'tf:cookie-consent-change';

export type ConsentChoice = 'all' | 'essential';

const isConsentChoice = (value: unknown): value is ConsentChoice => value === 'all' || value === 'essential';

export const readStoredConsent = (): ConsentChoice | null => {
    if (typeof window === 'undefined') return null;
    try {
        const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        return isConsentChoice(stored) ? stored : null;
    } catch (e) {
        return null;
    }
};

export const saveConsent = (choice: ConsentChoice): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch (e) {
        // ignore storage issues
    }

    window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGE_EVENT, { detail: choice }));
};

export const subscribeToConsentChanges = (listener: (choice: ConsentChoice) => void): (() => void) => {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<ConsentChoice>;
        if (isConsentChoice(customEvent.detail)) {
            listener(customEvent.detail);
        }
    };

    window.addEventListener(CONSENT_CHANGE_EVENT, handler as EventListener);
    return () => {
        window.removeEventListener(CONSENT_CHANGE_EVENT, handler as EventListener);
    };
};
