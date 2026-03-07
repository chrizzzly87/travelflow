import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, ANONYMOUS_TRIP_LIMIT } from '../config/productLimits';
import { buildPath } from '../config/routes';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { useAuth } from '../hooks/useAuth';
import { startPaddleCheckoutSession, type BillingCheckoutTierKey } from '../services/billingService';
import {
    appendPaddleCheckoutContext,
    extractPaddleCheckoutItemName,
    fetchPaddlePublicConfig,
    initializePaddleJs,
    isPaddleClientConfigured,
    isPaddleTierCheckoutConfigured,
    navigateToPaddleCheckout,
    PADDLE_INLINE_FRAME_TARGET_CLASS,
    readPaddleCheckoutLocationContext,
    type PaddleCheckoutEvent,
    type PaddlePublicConfig,
} from '../services/paddleClient';

interface TierStyle {
    badgeClass: string;
    accentClass: string;
    ringClass: string;
    highlighted?: boolean;
}

const TIER_STYLE: Record<'backpacker' | 'explorer' | 'globetrotter', TierStyle> = {
    backpacker: {
        badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
        accentClass: 'from-slate-600 to-slate-800',
        ringClass: 'ring-slate-900/5',
    },
    explorer: {
        badgeClass: 'border-accent-300 bg-accent-100 text-accent-700',
        accentClass: 'from-accent-500 to-accent-700',
        ringClass: 'ring-accent-500/10',
        highlighted: true,
    },
    globetrotter: {
        badgeClass: 'border-amber-300 bg-amber-100 text-amber-700',
        accentClass: 'from-amber-500 to-amber-700',
        ringClass: 'ring-amber-500/10',
    },
};

const asDisplayCount = (value: number | null, unlimitedLabel: string): string =>
    value === null ? unlimitedLabel : String(value);

export const PricingPage: React.FC = () => {
    const { t, i18n } = useTranslation('pricing');
    const location = useLocation();
    const { access, isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const [checkoutTierInFlight, setCheckoutTierInFlight] = useState<BillingCheckoutTierKey | null>(null);
    const [paddlePublicConfig, setPaddlePublicConfig] = useState<PaddlePublicConfig | null>(null);
    const [inlineCheckoutItemName, setInlineCheckoutItemName] = useState<string | null>(null);
    const [isInlineCheckoutLoading, setIsInlineCheckoutLoading] = useState(false);
    const inlineCheckoutSectionRef = useRef<HTMLDivElement | null>(null);
    const isPaddleCheckoutEnabled = String(import.meta.env.VITE_PADDLE_CHECKOUT_ENABLED || '').toLowerCase() === 'true';
    const isPaddleClientTokenConfigured = isPaddleClientConfigured();
    const unlimitedLabel = t('shared.unlimited');
    const noExpiryLabel = t('shared.noExpiry');
    const enabledLabel = t('shared.enabled');
    const disabledLabel = t('shared.disabled');
    const isCheckoutEligibleUser = isAuthenticated && access?.isAnonymous !== true;
    const activeLocale = useMemo(
        () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE),
        [i18n.language, i18n.resolvedLanguage]
    );
    const checkoutLocationContext = useMemo(
        () => readPaddleCheckoutLocationContext(location.search),
        [location.search]
    );
    const activeCheckoutTier = checkoutLocationContext.tierKey
        ? PLAN_CATALOG[checkoutLocationContext.tierKey]
        : null;
    const activeCheckoutTierStyle = activeCheckoutTier
        ? TIER_STYLE[activeCheckoutTier.publicSlug]
        : null;
    const hasInlineCheckout = Boolean(checkoutLocationContext.transactionId);

    const resolveTierFeatures = useCallback((tierKey: typeof PLAN_ORDER[number]) => {
        const tier = PLAN_CATALOG[tierKey];
        const interpolationValues = {
            maxActiveTripsLabel: asDisplayCount(tier.entitlements.maxActiveTrips, unlimitedLabel),
            maxTotalTripsLabel: asDisplayCount(tier.entitlements.maxTotalTrips, unlimitedLabel),
            tripExpirationLabel: tier.entitlements.tripExpirationDays === null
                ? noExpiryLabel
                : t('shared.days', { count: tier.entitlements.tripExpirationDays }),
            sharingLabel: tier.entitlements.canShare ? enabledLabel : disabledLabel,
            editableSharesLabel: tier.entitlements.canCreateEditableShares ? enabledLabel : disabledLabel,
            proCreationLabel: tier.entitlements.canCreateProTrips ? enabledLabel : disabledLabel,
        };
        const featureTemplates = t(`tiers.${tier.publicSlug}.features`, { returnObjects: true }) as unknown;
        return Array.isArray(featureTemplates)
            ? featureTemplates.map((_, index) => (
                t(`tiers.${tier.publicSlug}.features.${index}`, interpolationValues)
            ))
            : [];
    }, [disabledLabel, enabledLabel, noExpiryLabel, t, unlimitedLabel]);

    const handlePaddleCheckoutEvent = useCallback((event: PaddleCheckoutEvent) => {
        const itemName = extractPaddleCheckoutItemName(event);
        if (itemName) {
            setInlineCheckoutItemName(itemName);
        }
        if (typeof event.name === 'string' && event.name.startsWith('checkout.')) {
            setIsInlineCheckoutLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isPaddleCheckoutEnabled || !isPaddleClientTokenConfigured) return;
        let cancelled = false;
        void fetchPaddlePublicConfig()
            .then(async (config) => {
                if (cancelled) return;
                setPaddlePublicConfig(config);
                if (config.issues.length > 0) {
                    config.issues.forEach((issue) => {
                        console.warn(`Paddle config issue: ${issue.message}`);
                    });
                    return;
                }

                const ready = await initializePaddleJs({
                    environment: config.environment,
                    eventCallback: handlePaddleCheckoutEvent,
                    locale: activeLocale,
                });
                if (!ready) {
                    if (!cancelled && hasInlineCheckout) {
                        setIsInlineCheckoutLoading(false);
                    }
                    console.error('Failed to initialize Paddle.js on pricing page.');
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    if (hasInlineCheckout) {
                        setIsInlineCheckoutLoading(false);
                    }
                    console.error('Failed to load Paddle public config.', error);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeLocale, handlePaddleCheckoutEvent, hasInlineCheckout, isPaddleCheckoutEnabled, isPaddleClientTokenConfigured]);

    useEffect(() => {
        if (!hasInlineCheckout) {
            setInlineCheckoutItemName(null);
            setIsInlineCheckoutLoading(false);
            return;
        }
        setIsInlineCheckoutLoading(true);
    }, [hasInlineCheckout]);

    useEffect(() => {
        if (!hasInlineCheckout || !inlineCheckoutSectionRef.current) return;
        if (typeof inlineCheckoutSectionRef.current.scrollIntoView !== 'function') return;
        inlineCheckoutSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [hasInlineCheckout]);

    const handlePaidTierCheckout = useCallback(async (
        tierKey: BillingCheckoutTierKey,
        tierSlug: 'explorer' | 'globetrotter'
    ) => {
        if (checkoutTierInFlight) return;
        trackEvent(`pricing__tier--${tierSlug}`);
        setCheckoutTierInFlight(tierKey);
        try {
            const session = await startPaddleCheckoutSession({
                tierKey,
                source: 'pricing_page',
            });
            navigateToPaddleCheckout(appendPaddleCheckoutContext(session.checkoutUrl, tierKey));
        } catch (error) {
            console.error('Failed to start Paddle checkout session.', error);
        } finally {
            setCheckoutTierInFlight(null);
        }
    }, [checkoutTierInFlight]);

    return (
        <MarketingLayout>
            <div className="py-8 md:py-16">
                <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
                    <h1
                        className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        {t('hero.title')}
                    </h1>
                    <p className="mt-4 text-lg text-slate-500">
                        {t('hero.description')}
                    </p>
                </div>

                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
                    {PLAN_ORDER.map((tierKey) => {
                        const tier = PLAN_CATALOG[tierKey];
                        const style = TIER_STYLE[tier.publicSlug];
                        const isPaidTier = tier.monthlyPriceUsd > 0;
                        const supportsCheckout = (tier.key === 'tier_mid' || tier.key === 'tier_premium')
                            && isPaddleCheckoutEnabled
                            && isPaddleClientTokenConfigured
                            && isPaddleTierCheckoutConfigured(paddlePublicConfig, tier.key);
                        const canStartCheckout = isPaidTier && supportsCheckout && isCheckoutEligibleUser && !isAuthLoading;
                        const isCheckoutBusy = checkoutTierInFlight === tier.key;
                        const featureList = resolveTierFeatures(tier.key);

                        return (
                            <div
                                key={tier.key}
                                className={`relative flex flex-col rounded-2xl bg-white p-8 shadow-lg ring-1 ${style.ringClass} ${
                                    style.highlighted ? 'z-10 scale-[1.02] pb-12 pt-10 md:-mt-4 md:mb-0 md:scale-105' : ''
                                }`}
                            >
                                <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${style.accentClass}`} />

                                <span className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-semibold ${style.badgeClass}`}>
                                    {t(`tiers.${tier.publicSlug}.badge`)}
                                </span>

                                <div className="mt-5 flex items-baseline gap-1">
                                    <span
                                        className="text-4xl font-extrabold tracking-tight text-slate-900"
                                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                                    >
                                        {`$${tier.monthlyPriceUsd}`}
                                    </span>
                                    <span className="text-sm font-medium text-slate-500">{t('shared.perMonth')}</span>
                                </div>

                                <h2 className="mt-3 text-lg font-bold text-slate-900">{t(`tiers.${tier.publicSlug}.name`)}</h2>
                                <p className="mt-2 text-sm text-slate-500">{t(`tiers.${tier.publicSlug}.description`)}</p>

                                <ul className="mt-6 flex-1 space-y-3">
                                    {featureList.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                                            <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-accent-600" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-8">
                                    {isPaidTier ? (
                                        canStartCheckout ? (
                                            <button
                                                type="button"
                                                disabled={isCheckoutBusy}
                                                onClick={() => void handlePaidTierCheckout(
                                                    tier.key as BillingCheckoutTierKey,
                                                    tier.publicSlug as 'explorer' | 'globetrotter'
                                                )}
                                                className="w-full rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700 disabled:cursor-wait disabled:opacity-70"
                                                {...getAnalyticsDebugAttributes(`pricing__tier--${tier.publicSlug}`)}
                                            >
                                                {t(`tiers.${tier.publicSlug}.cta`)}
                                            </button>
                                        ) : supportsCheckout ? (
                                            <Link
                                                to={buildPath('login')}
                                                onClick={() => trackEvent(`pricing__tier--${tier.publicSlug}`)}
                                                className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                                {...getAnalyticsDebugAttributes(`pricing__tier--${tier.publicSlug}`)}
                                            >
                                                {t(`tiers.${tier.publicSlug}.cta`)}
                                            </Link>
                                        ) : (
                                            <button
                                                disabled
                                                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
                                            >
                                                {t(`tiers.${tier.publicSlug}.cta`)}
                                            </button>
                                        )
                                    ) : (
                                        <Link
                                            to={buildPath('login')}
                                            onClick={() => trackEvent(`pricing__tier--${tier.publicSlug}`)}
                                            className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                            {...getAnalyticsDebugAttributes(`pricing__tier--${tier.publicSlug}`)}
                                        >
                                            {t(`tiers.${tier.publicSlug}.cta`)}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {hasInlineCheckout ? (
                    <div
                        ref={inlineCheckoutSectionRef}
                        className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_80px_-40px_rgba(15,23,42,0.55)]"
                    >
                        <div className="grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                            <div
                                className={`relative overflow-hidden p-8 text-white ${
                                    activeCheckoutTierStyle
                                        ? `bg-gradient-to-br ${activeCheckoutTierStyle.accentClass}`
                                        : 'bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),_transparent_40%),linear-gradient(135deg,#0f172a_0%,#1e293b_100%)]'
                                }`}
                            >
                                <div className="flex h-full flex-col">
                                    {activeCheckoutTier ? (
                                        <>
                                            <span className="inline-flex self-start rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                                                {t(`tiers.${activeCheckoutTier.publicSlug}.badge`)}
                                            </span>
                                            <div className="mt-6 flex items-baseline gap-2">
                                                <span
                                                    className="text-5xl font-extrabold tracking-tight"
                                                    style={{ fontFamily: 'var(--tf-font-heading)' }}
                                                >
                                                    {`$${activeCheckoutTier.monthlyPriceUsd}`}
                                                </span>
                                                <span className="text-sm font-medium text-white/70">{t('shared.perMonth')}</span>
                                            </div>
                                            <h2
                                                className="mt-4 text-2xl font-bold tracking-tight"
                                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                                            >
                                                {t(`tiers.${activeCheckoutTier.publicSlug}.name`)}
                                            </h2>
                                            <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">
                                                {t(`tiers.${activeCheckoutTier.publicSlug}.description`)}
                                            </p>
                                            <ul className="mt-8 space-y-3">
                                                {resolveTierFeatures(activeCheckoutTier.key).map((feature) => (
                                                    <li key={feature} className="flex items-start gap-3 text-sm text-white/80">
                                                        <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-white" />
                                                        {feature}
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    ) : (
                                        <>
                                            <span className="inline-flex self-start rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                                                TravelFlow
                                            </span>
                                            <h2
                                                className="mt-6 text-3xl font-bold tracking-tight"
                                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                                            >
                                                {inlineCheckoutItemName || t('hero.title')}
                                            </h2>
                                            <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">
                                                {t('hero.description')}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50/70 p-4 sm:p-6 lg:p-8">
                                <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
                                    {isInlineCheckoutLoading ? (
                                        <div className="pointer-events-none absolute inset-0 z-10 bg-white/88 backdrop-blur-sm">
                                            <div className="flex h-full flex-col gap-4 p-6">
                                                <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200" />
                                                <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
                                                <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-100" />
                                                <div className="h-40 w-full animate-pulse rounded-3xl bg-slate-100" />
                                                <div className="mt-auto h-12 w-full animate-pulse rounded-2xl bg-slate-200" />
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className={`${PADDLE_INLINE_FRAME_TARGET_CLASS} min-h-[640px] w-full`} />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="mx-auto mt-16 max-w-2xl text-center">
                    <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-600">
                        <p className="font-semibold text-slate-800">{t('anonymousLimits.title')}</p>
                        <p className="mt-1">
                            <Trans
                                i18nKey="anonymousLimits.description"
                                ns="pricing"
                                values={{ limit: ANONYMOUS_TRIP_LIMIT, days: ANONYMOUS_TRIP_EXPIRATION_DAYS }}
                                components={{ strong: <strong /> }}
                            />
                        </p>
                    </div>
                    <p className="text-sm text-slate-400">
                        {t('anonymousLimits.footer')}
                    </p>
                </div>
            </div>
        </MarketingLayout>
    );
};
