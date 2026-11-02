import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../app/navigation';
import { useSafeRouteLocation } from './useSafeRouteLocation';
import { buildLocalizedLocation } from '../services/localeRoutingService';
import { getNamespacesForToolPath } from '../config/routes';
import { preloadLocaleNamespaces } from '../i18n';
import type { AppLanguage } from '../types';

/** URL-owned locales are loaded by the router; unprefixed workspaces use a browser preference. */
export function useLocaleNavigation() {
    const location = useSafeRouteLocation();
    const navigate = useNavigate();
    const { i18n } = useTranslation('common');
    const requestSequence = useRef(0);
    return useCallback(async (targetLocale: AppLanguage) => {
        const sequence = ++requestSequence.current;
        const target = buildLocalizedLocation({ ...location, targetLocale });
        if (target !== `${location.pathname}${location.search}${location.hash}`) {
            navigate(target);
            return;
        }
        await preloadLocaleNamespaces(targetLocale, getNamespacesForToolPath(location.pathname), i18n);
        if (sequence !== requestSequence.current) return;
        if (i18n.resolvedLanguage !== targetLocale) await i18n.changeLanguage(targetLocale);
    }, [location.pathname, location.search, location.hash, navigate, i18n]);
}
