import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SpinnerGap as Loader2 } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { APP_NAME } from '../config/appGlobals';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import {
    LEGAL_TERMS_BINDING_LOCALE,
    LEGAL_TERMS_FALLBACK_CONTENT_DE,
    LEGAL_TERMS_FALLBACK_CONTENT_EN,
    LEGAL_TERMS_FALLBACK_LAST_UPDATED,
    LEGAL_TERMS_FALLBACK_SUMMARY,
    LEGAL_TERMS_FALLBACK_TITLE,
    LEGAL_TERMS_FALLBACK_VERSION,
    injectAppNameIntoTermsContent,
} from '../config/legalTermsDefaults';
import { useAuth } from '../hooks/useAuth';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { resolvePreferredNextPath } from '../services/authNavigationService';
import { acceptCurrentTerms } from '../services/authService';
import { getCurrentLegalTermsVersion, type LegalTermsVersionRecord } from '../services/legalTermsService';

const buildFallbackTermsVersion = (): LegalTermsVersionRecord => {
    const now = new Date().toISOString();
    return {
        version: LEGAL_TERMS_FALLBACK_VERSION,
        title: LEGAL_TERMS_FALLBACK_TITLE,
        summary: LEGAL_TERMS_FALLBACK_SUMMARY,
        bindingLocale: LEGAL_TERMS_BINDING_LOCALE,
        lastUpdated: LEGAL_TERMS_FALLBACK_LAST_UPDATED,
        effectiveAt: now,
        requiresReaccept: true,
        isCurrent: true,
        contentDe: LEGAL_TERMS_FALLBACK_CONTENT_DE,
        contentEn: LEGAL_TERMS_FALLBACK_CONTENT_EN,
        createdAt: now,
        createdBy: null,
    };
};

const MARKDOWN_COMPONENTS: Components = {
    h2: ({ children }) => (
        <h3 className="mt-6 border-t border-border pt-4 text-base font-semibold text-foreground first:mt-0 first:border-t-0 first:pt-0">{children}</h3>
    ),
    p: ({ children }) => <p className="text-sm leading-6 text-foreground">{children}</p>,
    ul: ({ children }) => <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-foreground">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-foreground">{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    a: ({ href, children }) => (
        <a className="font-semibold text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800 dark:text-accent-200 dark:hover:text-accent-200" href={href || '#'} target="_blank" rel="noreferrer">
            {children}
        </a>
    ),
};

export const TermsPage: React.FC = () => {
    const { t } = useTranslation('legal');
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { access, isAuthenticated, isAnonymous, refreshAccess } = useAuth();
    const [isAccepting, setIsAccepting] = useState(false);
    const [acceptError, setAcceptError] = useState<string | null>(null);
    const [termsDoc, setTermsDoc] = useState<LegalTermsVersionRecord>(() => buildFallbackTermsVersion());

    const locale = extractLocaleFromPath(location.pathname) ?? normalizeLocale(DEFAULT_LOCALE);
    const privacyPath = buildLocalizedMarketingPath('privacy', locale);
    const imprintPath = buildLocalizedMarketingPath('imprint', locale);

    useEffect(() => {
        let isCancelled = false;

        const loadCurrentTerms = async () => {
            const current = await getCurrentLegalTermsVersion();
            if (isCancelled) return;
            setTermsDoc(current);
        };

        void loadCurrentTerms();

        return () => {
            isCancelled = true;
        };
    }, []);

    const hasOutdatedAcceptedVersion = Boolean(
        isAuthenticated
        && !isAnonymous
        && access?.termsCurrentVersion
        && access?.termsAcceptedVersion !== access?.termsCurrentVersion
    );
    const forcedAcceptanceFlow = Boolean(
        searchParams.get('accept') === 'required'
        && isAuthenticated
        && !isAnonymous
        && access?.termsAcceptanceRequired
    );
    const acceptRequired = forcedAcceptanceFlow || (hasOutdatedAcceptedVersion && Boolean(access?.termsAcceptanceRequired));
    const canAcceptCurrentTerms = forcedAcceptanceFlow || hasOutdatedAcceptedVersion;

    const nextPath = useMemo(
        () => resolvePreferredNextPath(searchParams.get('next')),
        [searchParams]
    );

    const bindingMarkdown = useMemo(
        () => injectAppNameIntoTermsContent(termsDoc.contentDe || LEGAL_TERMS_FALLBACK_CONTENT_DE, APP_NAME),
        [termsDoc.contentDe]
    );

    const helperMarkdown = useMemo(
        () => injectAppNameIntoTermsContent(termsDoc.contentEn || LEGAL_TERMS_FALLBACK_CONTENT_EN, APP_NAME),
        [termsDoc.contentEn]
    );

    const handleAcceptCurrentTerms = async () => {
        if (!canAcceptCurrentTerms || isAccepting) return;

        setIsAccepting(true);
        setAcceptError(null);
        trackEvent('terms__accept--submit', { source: 'terms_page', version: termsDoc.version });

        const { data, error } = await acceptCurrentTerms({
            locale,
            source: 'terms_page',
        });

        if (error || !data) {
            const rawErrorMessage = typeof error?.message === 'string' ? error.message.trim() : '';
            setAcceptError(rawErrorMessage || t('termsPage.acceptError'));
            trackEvent('terms__accept--failed', {
                source: 'terms_page',
                version: termsDoc.version,
                reason: rawErrorMessage || 'unknown',
            });
            setIsAccepting(false);
            return;
        }

        trackEvent('terms__accept--success', {
            source: 'terms_page',
            version: data.termsVersion,
        });
        await refreshAccess();
        navigate(nextPath, { replace: true });
    };

    return (
        <MarketingLayout>
            <div className="space-y-6">
                <section className="rounded-3xl border border-border bg-gradient-to-br from-card to-secondary p-6 shadow-sm md:p-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent-600 dark:text-accent-300">{t('termsPage.heroEyebrow')}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{t('termsPage.heroTitle')}</h1>
                    <p className="mt-4 text-sm leading-6 text-foreground">
                        {t('termsPage.heroIntro', { appName: APP_NAME })}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{t('termsPage.heroBindingNote')}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold">{t('termsPage.versionLabel')}: {termsDoc.version}</span>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold">{t('termsPage.lastUpdatedLabel')}: {termsDoc.lastUpdated}</span>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        {t('termsPage.controllerInfoLead')}{' '}
                        <Link className="font-semibold text-accent-700 hover:underline dark:text-accent-200" to={imprintPath}>{t('termsPage.imprintLinkLabel')}</Link>.
                        {' '}
                        {t('termsPage.privacyInfoLead')}{' '}
                        <Link className="font-semibold text-accent-700 hover:underline dark:text-accent-200" to={privacyPath}>{t('termsPage.privacyLinkLabel')}</Link>.
                    </p>
                </section>

                {canAcceptCurrentTerms && (
                    <section className={`rounded-2xl p-4 text-sm ${acceptRequired ? 'border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30' : 'border border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30'}`}>
                        <p className="font-semibold">
                            {acceptRequired ? t('termsPage.acceptRequiredTitle') : t('termsPage.acceptOptionalTitle')}
                        </p>
                        <p className="mt-1">
                            {acceptRequired ? t('termsPage.acceptRequiredDescription') : t('termsPage.acceptOptionalDescription')}
                        </p>
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={() => void handleAcceptCurrentTerms()}
                                disabled={isAccepting}
                                className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                                {...getAnalyticsDebugAttributes('terms__accept--submit', { source: 'terms_page' })}
                            >
                                {isAccepting ? <Loader2 size={14} className="animate-spin" /> : null}
                                {isAccepting ? t('termsPage.acceptSubmitting') : t('termsPage.acceptSubmit')}
                            </button>
                        </div>
                        {acceptError && (
                            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">{acceptError}</p>
                        )}
                    </section>
                )}

                <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6 dark:shadow-none">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('termsPage.bindingSectionTitle')}</h2>
                    <div className="mt-4 space-y-3">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                            {bindingMarkdown}
                        </ReactMarkdown>
                    </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6 dark:shadow-none">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('termsPage.helperSectionTitle')}</h2>
                    <div className="mt-4 space-y-3">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                            {helperMarkdown}
                        </ReactMarkdown>
                    </div>
                </section>
            </div>
        </MarketingLayout>
    );
};
