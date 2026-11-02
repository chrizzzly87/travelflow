import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTripManager } from '../../contexts/TripManagerContext';
import { useDbSync } from '../../hooks/useDbSync';
import { useTripCreation } from './useTripCreation';
import { preloadLocaleNamespaces, APP_SHELL_NAMESPACES } from '../../i18n';
import { normalizeLocale } from '../../config/locales';
import type { AppLanguage, ITrip } from '../../types';

/** Composition only; the page, persistence and account sync have separate ownership. */
export function CreateTripRoute({ Page }: { Page: React.ComponentType<{ onTripGenerated: (trip: ITrip) => void; onOpenManager: () => void; onLanguageLoaded?: (language: AppLanguage) => void }> }) {
    const { i18n } = useTranslation('common');
    const { openTripManager } = useTripManager();
    const create = useTripCreation();
    const onLanguageLoaded = useCallback((language: AppLanguage) => {
        const normalized = normalizeLocale(language);
        void preloadLocaleNamespaces(normalized, APP_SHELL_NAMESPACES).then(() => i18n.changeLanguage(normalized));
    }, [i18n]);
    useDbSync(onLanguageLoaded);
    return <Page onTripGenerated={create} onOpenManager={openTripManager} onLanguageLoaded={onLanguageLoaded} />;
}
