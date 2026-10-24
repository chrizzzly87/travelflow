import React, { useEffect, useState } from 'react';
import { Link } from '@/app/navigation';
import { WarningCircle, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE } from '../../config/locales';
import { buildLocalizedMarketingPath } from '../../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    readSessionStorageItem,
    writeSessionStorageItem,
} from '../../services/browserStorageService';
import { MarketingNotice } from './MarketingNotice';
import { usePresentationLocale } from '../../hooks/usePresentationLocale';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';

const SESSION_DISMISS_KEY = 'tf_translation_notice_dismissed_session';
const CONTACT_PREFILL_REASON = 'bug_report';
const CONTACT_PREFILL_SUB_REASON = 'translation_wrong_misleading';
const CONTACT_PREFILL_SOURCE = 'translation_notice_banner';

const buildContactSearch = (): string => {
    const params = new URLSearchParams({
        reason: CONTACT_PREFILL_REASON,
        subReason: CONTACT_PREFILL_SUB_REASON,
        source: CONTACT_PREFILL_SOURCE,
    });
    return `?${params.toString()}`;
};

const buildContactTo = (activeLocale: string) => ({
    pathname: buildLocalizedMarketingPath('contact', activeLocale),
    search: buildContactSearch(),
});

const buildContactState = () => ({
    reason: CONTACT_PREFILL_REASON,
    subReason: CONTACT_PREFILL_SUB_REASON,
    source: CONTACT_PREFILL_SOURCE,
});

const isDismissedForSession = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        return readSessionStorageItem(SESSION_DISMISS_KEY) === '1';
    } catch {
        return false;
    }
};

export const TranslationNoticeBanner: React.FC = () => {
    const { t } = useTranslation('common');
    const routeLocation = useSafeRouteLocation();
    const activeLocale = usePresentationLocale(routeLocation.pathname, DEFAULT_LOCALE);
    const [dismissed, setDismissed] = useState<boolean>(false);

    useEffect(() => {
        if (activeLocale === DEFAULT_LOCALE) return;
        if (isDismissedForSession()) setDismissed(true);
    }, [activeLocale]);

    if (activeLocale === DEFAULT_LOCALE || dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        trackEvent('i18n_notice__dismiss', { locale: activeLocale });
        if (typeof window === 'undefined') return;
        try {
            writeSessionStorageItem(SESSION_DISMISS_KEY, '1');
        } catch {
            // ignore
        }
    };

    return (
        <MarketingNotice tone="amber"
            icon={<WarningCircle size={16} weight="duotone" className="text-amber-700 dark:text-amber-200" />}
            message={t('translationNotice.message')}
            action={
                <Link
                    to={buildContactTo(activeLocale)}
                    state={buildContactState()}
                    onClick={() => trackEvent('i18n_notice__contact', {
                        locale: activeLocale,
                        reason: CONTACT_PREFILL_REASON,
                        sub_reason: CONTACT_PREFILL_SUB_REASON,
                        source: CONTACT_PREFILL_SOURCE,
                    })}
                    className="inline-flex min-h-10 min-w-0 max-w-full items-center whitespace-normal break-words text-start rounded-lg border border-amber-300 bg-card px-2 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 sm:px-2.5 dark:bg-card dark:hover:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30"
                    {...getAnalyticsDebugAttributes('i18n_notice__contact', {
                        locale: activeLocale,
                        reason: CONTACT_PREFILL_REASON,
                        sub_reason: CONTACT_PREFILL_SUB_REASON,
                        source: CONTACT_PREFILL_SOURCE,
                    })}
                >
                    <span className="sm:hidden">{t('translationNotice.ctaShort')}</span>
                    <span className="hidden sm:inline">{t('translationNotice.cta')}</span>
                </Link>}
            dismiss={<button
                    type="button"
                    onClick={handleDismiss}
                    aria-label={t('translationNotice.dismiss')}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-400/12 dark:hover:text-amber-200"
                    {...getAnalyticsDebugAttributes('i18n_notice__dismiss', { locale: activeLocale })}
                >
                    <X size={14} weight="bold" />
                </button>}
        />
    );
};
