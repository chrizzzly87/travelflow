import {
    purgeOptionalBrowserStorage,
    writeLocalStorageItem,
} from './browserStorageService';
import {
    CONSENT_STORAGE_KEY,
    CONSENT_DOCUMENT_ATTRIBUTE,
    type ConsentChoice,
    isConsentChoice,
    readCurrentConsentChoice,
} from './consentState';

export { CONSENT_STORAGE_KEY } from './consentState';
export type { ConsentChoice } from './consentState';

const CONSENT_CHANGE_EVENT = 'tf:cookie-consent-change';

export const readStoredConsent = (): ConsentChoice | null => {
    if (typeof window === 'undefined') return null;
    return readCurrentConsentChoice();
};

export const saveConsent = (choice: ConsentChoice): void => {
    if (typeof window === 'undefined') return;

    document.documentElement.setAttribute(CONSENT_DOCUMENT_ATTRIBUTE, choice);
    writeLocalStorageItem(CONSENT_STORAGE_KEY, choice);

    if (choice === 'essential') {
        purgeOptionalBrowserStorage();
    }

    window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGE_EVENT, { detail: choice }));
};

export const subscribeToConsentChanges = (listener: (choice: ConsentChoice | null) => void): (() => void) => {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<ConsentChoice>;
        if (isConsentChoice(customEvent.detail)) {
            document.documentElement.setAttribute(CONSENT_DOCUMENT_ATTRIBUTE, customEvent.detail);
            listener(customEvent.detail);
        }
    };

    const handleStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== CONSENT_STORAGE_KEY) return;
        if (event.newValue !== null && !isConsentChoice(event.newValue)) return;
        try { if (event.storageArea !== window.localStorage) return; } catch { return; }
        const choice = isConsentChoice(event.newValue) ? event.newValue : null;
        document.documentElement.setAttribute(CONSENT_DOCUMENT_ATTRIBUTE, choice ?? 'unknown');
        if (choice !== 'all') purgeOptionalBrowserStorage();
        listener(choice);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CONSENT_CHANGE_EVENT, handler as EventListener);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(CONSENT_CHANGE_EVENT, handler as EventListener);
    };
};
