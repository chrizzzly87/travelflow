import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE } from '../../config/locales';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

export const TranslationNoticeBanner: React.FC = () => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const activeLocale = useMemo(() => extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE, [location.pathname]);

    if (activeLocale === DEFAULT_LOCALE) return null;

    return (
        <div className="border-b border-amber-200/70 bg-amber-50/90">
            <div className="mx-auto flex w-full max-w-7xl items-start gap-2 px-5 py-2.5 sm:items-center sm:gap-3 md:px-8">
                <WarningCircle size={16} weight="duotone" className="shrink-0 text-amber-700" />
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-900 sm:text-sm">
                    {t('translationNotice.message')}
                </p>
                <Link
                    to={buildLocalizedMarketingPath('contact', activeLocale)}
                    onClick={() => trackEvent('i18n_notice__contact')}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 sm:px-2.5"
                    {...getAnalyticsDebugAttributes('i18n_notice__contact')}
                >
                    <span className="sm:hidden">{t('translationNotice.ctaShort')}</span>
                    <span className="hidden sm:inline">{t('translationNotice.cta')}</span>
                </Link>
            </div>
        </div>
    );
};
