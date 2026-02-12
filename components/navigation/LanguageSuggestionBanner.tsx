import React, { useMemo, useState } from 'react';
import { X, Translate } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { extractLocaleFromPath, isToolRoute } from '../../config/routes';
import { AppLanguage } from '../../types';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../config/locales';
import { APP_NAME } from '../../config/appGlobals';
import { buildLocalizedLocation } from '../../services/localeRoutingService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const MESSAGE_BY_LOCALE: Record<AppLanguage, { message: string; action: string; dismiss: string }> = {
    en: {
        message: 'This page is also available in English.',
        action: `Try ${APP_NAME} in English`,
        dismiss: 'Dismiss language suggestion',
    },
    es: {
        message: 'Esta página también está disponible en español.',
        action: `Probar ${APP_NAME} en español`,
        dismiss: 'Cerrar sugerencia de idioma',
    },
    de: {
        message: 'Diese Seite ist auch auf Deutsch verfügbar.',
        action: `${APP_NAME} auf Deutsch testen`,
        dismiss: 'Sprachhinweis schließen',
    },
    fr: {
        message: 'Cette page est également disponible en français.',
        action: `Essayer ${APP_NAME} en français`,
        dismiss: 'Fermer la suggestion de langue',
    },
    ru: {
        message: 'Эта страница также доступна на русском языке.',
        action: `Попробовать ${APP_NAME} на русском`,
        dismiss: 'Закрыть подсказку языка',
    },
    pt: {
        message: 'Esta página também está disponível em português.',
        action: `Experimentar ${APP_NAME} em português`,
        dismiss: 'Fechar sugestão de idioma',
    },
    it: {
        message: 'Questa pagina è disponibile anche in italiano.',
        action: `Prova ${APP_NAME} in italiano`,
        dismiss: 'Chiudi suggerimento lingua',
    },
};

const appendLanguageBannerTrackingParams = (target: string, from: AppLanguage, to: AppLanguage): string => {
    if (typeof window === 'undefined') return target;
    try {
        const url = new URL(target, window.location.origin);
        url.searchParams.set('utm_source', 'language_banner');
        url.searchParams.set('utm_medium', 'locale_switch');
        url.searchParams.set('utm_campaign', 'language_suggestion');
        url.searchParams.set('utm_content', `${from}_to_${to}`);
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return target;
    }
};

const getBrowserPreferredLocale = (currentLocale: AppLanguage): AppLanguage | null => {
    if (typeof navigator === 'undefined') return null;

    const normalizeCandidate = (value?: string | null): AppLanguage | null => {
        if (!value) return null;
        const normalized = value.toLowerCase().split('-')[0] as AppLanguage;
        return SUPPORTED_LOCALES.includes(normalized) ? normalized : null;
    };

    const preferredLocales = Array.from(new Set([
        ...navigator.languages.map((value) => normalizeCandidate(value)),
        normalizeCandidate(navigator.language),
    ].filter(Boolean) as AppLanguage[]));

    if (preferredLocales.length === 0) return null;
    if (preferredLocales.includes(currentLocale)) return null;

    return preferredLocales[0] ?? null;
};

export const LanguageSuggestionBanner: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const activeLocale = useMemo<AppLanguage>(() => {
        return extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    }, [location.pathname]);

    const suggestedLocale = useMemo(() => {
        if (isToolRoute(location.pathname)) return null;
        return getBrowserPreferredLocale(activeLocale);
    }, [activeLocale, location.pathname]);

    const storageKey = suggestedLocale
        ? `tf_locale_suggestion_dismissed:${activeLocale}->${suggestedLocale}`
        : null;

    const [dismissed, setDismissed] = useState<boolean>(false);

    React.useEffect(() => {
        if (!storageKey || typeof window === 'undefined') {
            setDismissed(false);
            return;
        }
        try {
            setDismissed(window.localStorage.getItem(storageKey) === '1');
        } catch {
            setDismissed(false);
        }
    }, [storageKey]);

    if (!suggestedLocale || dismissed) return null;

    const copy = MESSAGE_BY_LOCALE[suggestedLocale];

    const handleDismiss = () => {
        setDismissed(true);
        trackEvent('navigation__language_suggestion--dismiss', {
            from: activeLocale,
            to: suggestedLocale,
        });
        if (!storageKey || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(storageKey, '1');
        } catch {
            // ignore
        }
    };

    const handleSwitch = () => {
        const baseTarget = buildLocalizedLocation({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            targetLocale: suggestedLocale,
        });
        const target = appendLanguageBannerTrackingParams(baseTarget, activeLocale, suggestedLocale);
        trackEvent('navigation__language_suggestion--switch', {
            from: activeLocale,
            to: suggestedLocale,
            target,
        });
        navigate(target);
    };

    return (
        <div className="border-b border-cyan-200/60 bg-cyan-50/90">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-2.5 md:px-8">
                <Translate size={16} weight="duotone" className="shrink-0 text-cyan-700" />
                <p className="flex-1 text-xs leading-relaxed text-cyan-900 sm:text-sm">
                    {copy.message}
                </p>
                <button
                    type="button"
                    onClick={handleSwitch}
                    className="rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-800 transition-colors hover:bg-cyan-100"
                    {...getAnalyticsDebugAttributes('navigation__language_suggestion--switch', {
                        to: suggestedLocale,
                        utm_source: 'language_banner',
                    })}
                >
                    {copy.action}
                </button>
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label={copy.dismiss}
                    className="shrink-0 rounded-lg p-1.5 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-800"
                    {...getAnalyticsDebugAttributes('navigation__language_suggestion--dismiss', { to: suggestedLocale })}
                >
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    );
};
