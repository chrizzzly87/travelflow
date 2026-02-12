import React, { useMemo, useState } from 'react';
import { X, Translate } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { extractLocaleFromPath, isToolRoute } from '../../config/routes';
import { AppLanguage } from '../../types';
import { DEFAULT_LOCALE, LOCALE_LABELS, SUPPORTED_LOCALES } from '../../config/locales';
import { buildLocalizedLocation } from '../../services/localeRoutingService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const MESSAGE_BY_LOCALE: Record<AppLanguage, { message: string; action: string; dismiss: string }> = {
    en: {
        message: 'We also support English on this page.',
        action: 'Switch to English',
        dismiss: 'Dismiss language suggestion',
    },
    de: {
        message: 'Wir unterstützen diese Seite auch auf Deutsch.',
        action: 'Auf Deutsch wechseln',
        dismiss: 'Sprachhinweis schließen',
    },
    fr: {
        message: 'Cette page est aussi disponible en français.',
        action: 'Passer en français',
        dismiss: 'Fermer la suggestion de langue',
    },
    it: {
        message: 'Questa pagina è disponibile anche in italiano.',
        action: 'Passa all\'italiano',
        dismiss: 'Chiudi suggerimento lingua',
    },
    ru: {
        message: 'Эта страница также доступна на русском языке.',
        action: 'Переключиться на русский',
        dismiss: 'Закрыть подсказку языка',
    },
};

const getBrowserPreferredLocale = (currentLocale: AppLanguage): AppLanguage | null => {
    if (typeof navigator === 'undefined') return null;

    const normalizeCandidate = (value?: string | null): AppLanguage | null => {
        if (!value) return null;
        const normalized = value.toLowerCase().split('-')[0] as AppLanguage;
        return SUPPORTED_LOCALES.includes(normalized) ? normalized : null;
    };

    const primaryLocale = normalizeCandidate(navigator.language);
    if (primaryLocale) {
        return primaryLocale === currentLocale ? null : primaryLocale;
    }

    for (const candidate of navigator.languages) {
        const normalized = normalizeCandidate(candidate);
        if (!normalized) continue;
        return normalized === currentLocale ? null : normalized;
    }

    return null;
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
        const target = buildLocalizedLocation({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            targetLocale: suggestedLocale,
        });
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
                    {copy.message} <span className="font-semibold">{LOCALE_LABELS[suggestedLocale]}</span>
                </p>
                <button
                    type="button"
                    onClick={handleSwitch}
                    className="rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-800 transition-colors hover:bg-cyan-100"
                    {...getAnalyticsDebugAttributes('navigation__language_suggestion--switch', { to: suggestedLocale })}
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
