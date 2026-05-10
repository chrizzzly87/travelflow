import React from 'react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE, normalizeLocale } from '../../config/locales';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';

interface SiteFooterProps {
    className?: string;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ className }) => {
    const year = new Date().getFullYear();
    const { t, i18n } = useTranslation('common');
    const location = useSafeRouteLocation();
    const activeLocale = extractLocaleFromPath(location.pathname)
        ?? normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE);

    const handleFooterClick = (target: string) => {
        trackEvent(`footer__${target}`);
    };

    const footerDebugAttributes = (target: string) =>
        getAnalyticsDebugAttributes(`footer__${target}`);

    return (
        <footer className={`border-t border-slate-200 bg-white/90 ${className || ''}`.trim()}>
            <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-slate-600">{t('footer.rightsReserved', { year })}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <a href={buildLocalizedMarketingPath('contact', activeLocale)} onClick={() => handleFooterClick('contact')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('contact')}>{t('footer.contact')}</a>
                        <a href={buildLocalizedMarketingPath('imprint', activeLocale)} onClick={() => handleFooterClick('imprint')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('imprint')}>{t('footer.imprint')}</a>
                        <a href={buildLocalizedMarketingPath('privacy', activeLocale)} onClick={() => handleFooterClick('privacy')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('privacy')}>{t('footer.privacy')}</a>
                        <a href={buildLocalizedMarketingPath('terms', activeLocale)} onClick={() => handleFooterClick('terms')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('terms')}>{t('footer.terms')}</a>
                        <a href={buildLocalizedMarketingPath('cookies', activeLocale)} onClick={() => handleFooterClick('cookies')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('cookies')}>{t('footer.cookies')}</a>
                    </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                    {t('footer.legalNotice')}
                </p>
            </div>
        </footer>
    );
};
