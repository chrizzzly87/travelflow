import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DB_ENABLED } from '../../config/db';
import { normalizeLocale } from '../../config/locales';
import { useAuth } from '../../hooks/useAuth';

/** Persist explicit language changes; an arriving session must not overwrite saved preferences. */
export function useAccountLanguageSync() {
    const { i18n } = useTranslation('common');
    const { access, isAuthenticated } = useAuth();
    const userId = isAuthenticated && !access?.isAnonymous && access?.accountStatus === 'active' ? access?.userId : null;
    useEffect(() => {
        if (!DB_ENABLED || !userId) return;
        let active = true;
        const saveLanguage = (language: string) => {
            void import('../../services/dbApi').then(({ dbUpsertUserSettings }) => {
                if (active) return dbUpsertUserSettings({ language: normalizeLocale(language) });
            }).catch(() => { /* A preference write must not interrupt route navigation. */ });
        };
        i18n.on('languageChanged', saveLanguage);
        return () => { active = false; i18n.off('languageChanged', saveLanguage); };
    }, [i18n, userId]);
}
