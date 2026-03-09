import {
    purgeOptionalBrowserStorage,
    readLocalStorageItem,
    writeLocalStorageItem,
} from './browserStorageService';
import {
    CONSENT_STORAGE_KEY,
    type ConsentChoice,
    isConsentChoice,
    readConsentChoiceFromStorage,
} from './consentState';

export { CONSENT_STORAGE_KEY } from './consentState';
export type { ConsentChoice } from './consentState';

const CONSENT_CHANGE_EVENT = 'tf:cookie-consent-change';

export const readStoredConsent = (): ConsentChoice | null => {
    if (typeof window === 'undefined') return null;
    const directRead = readConsentChoiceFromStorage();
    if (isConsentChoice(directRead)) return directRead;
    const storageRead = readLocalStorageItem(CONSENT_STORAGE_KEY);
    return isConsentChoice(storageRead) ? storageRead : null;
};

export const saveConsent = (choice: ConsentChoice): void => {
    if (typeof window === 'undefined') return;

    writeLocalStorageItem(CONSENT_STORAGE_KEY, choice);

    if (choice === 'essential') {
        purgeOptionalBrowserStorage();
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
