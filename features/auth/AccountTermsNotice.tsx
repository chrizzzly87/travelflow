import React, { useState } from 'react';
import { Scales } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from '../../app/navigation';
import { useAuth } from '../../hooks/useAuth';
import { buildLocalizedMarketingPath, extractLocaleFromPath, isToolRoute, stripLocalePrefix } from '../../config/routes';
import { DEFAULT_LOCALE, normalizeLocale } from '../../config/locales';
import { isSafeAuthReturnPath } from '../../services/authNavigationService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { resolveTermsNoticeState } from './termsPolicy';

/** Loaded only for accounts with a notice; marketing visitors do not load legal copy or icons. */
export default function AccountTermsNotice() {
    const auth = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('legal');
    // Dismissal is scoped to an account and a version, without extra browser storage.
    const [dismissed, setDismissed] = useState<string | null>(null);
    const mode = resolveTermsNoticeState({
        isAuthenticated: auth.isAuthenticated, isAuthLoading: auth.isLoading, hasAccess: Boolean(auth.access),
        isAnonymous: Boolean(auth.access?.isAnonymous), termsAcceptanceRequired: Boolean(auth.access?.termsAcceptanceRequired),
        termsNoticeRequired: Boolean(auth.access?.termsNoticeRequired),
    });
    const version = auth.access?.termsCurrentVersion;
    const dismissalKey = `${auth.access?.userId}:${version}`;
    if (mode === 'none' || stripLocalePrefix(location.pathname) === '/terms') return null;
    if (mode === 'inform' && (!version || dismissed === dismissalKey)) return null;
    const force = mode === 'force';
    const review = () => {
        const locale = extractLocaleFromPath(location.pathname) ?? (isToolRoute(location.pathname)
            ? normalizeLocale(i18n.resolvedLanguage ?? i18n.language) : DEFAULT_LOCALE);
        const query = new URLSearchParams();
        if (force) {
            const currentPath = `${location.pathname}${location.search}${location.hash}`;
            query.set('accept', 'required');
            query.set('next', isSafeAuthReturnPath(currentPath) ? currentPath : '/create-trip');
        } else query.set('notice', 'updated');
        trackEvent('app__terms_notice--review', { mode });
        navigate(`${buildLocalizedMarketingPath('terms', locale)}?${query.toString()}`);
    };
    return <section className={`mx-auto w-full max-w-[1600px] px-4 pt-3 sm:px-6 lg:px-8 ${force ? 'text-rose-950 dark:text-rose-200' : 'text-accent-950 dark:text-accent-200'}`} aria-live={force ? 'assertive' : 'polite'}>
        <div className={`rounded-2xl border px-4 py-3 shadow-sm sm:flex sm:items-start sm:justify-between sm:gap-4 ${force ? 'border-rose-200 bg-rose-50 dark:bg-rose-400/12 dark:border-rose-400/30' : 'border-accent-200 bg-accent-50 dark:bg-accent-400/12 dark:border-accent-400/30'}`}>
            <div className="flex min-w-0 items-start gap-3">
                <span className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border ${force ? 'border-rose-200 bg-rose-100 text-rose-700 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30' : 'border-accent-200 bg-accent-100 text-accent-700 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30'}`} aria-hidden="true"><Scales size={18} weight="duotone" /></span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold">{t(force ? 'termsPage.globalForceTitle' : 'termsPage.globalInformTitle')}</p>
                    <p className="mt-1 text-xs leading-5">{t(force ? 'termsPage.globalForceDescription' : 'termsPage.globalInformDescription')}</p>
                    {version && <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">{t('termsPage.versionLabel')}: {version}</p>}
                </div>
            </div>
            <div className="mt-3 flex items-center gap-2 sm:mt-0">
                <button type="button" onClick={review} {...getAnalyticsDebugAttributes('app__terms_notice--review', { mode })} className="inline-flex h-9 items-center rounded-lg bg-accent-700 px-3 text-xs font-semibold text-white hover:bg-accent-800">{t('termsPage.globalReviewAction')}</button>
                {!force && version && <button type="button" onClick={() => { trackEvent('app__terms_notice--dismiss'); setDismissed(dismissalKey); }} {...getAnalyticsDebugAttributes('app__terms_notice--dismiss')} className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary">{t('termsPage.globalDismissAction')}</button>}
            </div>
        </div>
    </section>;
}
