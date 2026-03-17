import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';

import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, ANONYMOUS_TRIP_LIMIT } from '../config/productLimits';
import { buildPath } from '../config/routes';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import {
    resolveBillingAccessUntil,
    resolveBillingLifecycleState,
    resolveBillingTierDecision,
    resolveEffectiveBillingTierKey,
} from '../lib/billing/subscriptionState';
import {
    buildBillingCheckoutPath,
    getCurrentSubscriptionSummary,
    readBillingDiscountCodeFromSearch,
    refreshCurrentPaddleSubscription,
    type BillingCheckoutTierKey,
    type BillingSubscriptionSummary,
} from '../services/billingService';
import {
    fetchPaddlePublicConfig,
    isPaddleTierCheckoutConfigured,
    type PaddlePublicConfig,
} from '../services/paddleClient';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

interface TierStyle {
    badgeClass: string;
    surfaceClass: string;
    headerClass: string;
    featureIconClass: string;
    highlighted?: boolean;
}

const TIER_STYLE: Record<'backpacker' | 'explorer' | 'globetrotter', TierStyle> = {
    backpacker: {
        badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
        surfaceClass: 'border-slate-200',
        headerClass: 'bg-slate-50',
        featureIconClass: 'text-slate-500',
    },
    explorer: {
        badgeClass: 'border-accent-300 bg-accent-100 text-accent-700',
        surfaceClass: 'border-accent-200 shadow-md ring-1 ring-accent-100',
        headerClass: 'bg-accent-50/70',
        featureIconClass: 'text-accent-600',
        highlighted: true,
    },
    globetrotter: {
        badgeClass: 'border-amber-300 bg-amber-100 text-amber-700',
        surfaceClass: 'border-amber-200',
        headerClass: 'bg-amber-50/70',
        featureIconClass: 'text-amber-600',
    },
};

const asDisplayCount = (value: number | null, unlimitedLabel: string): string =>
    value === null ? unlimitedLabel : String(value);

export const PricingPage: React.FC = () => {
    const { t } = useTranslation('pricing');
    const location = useLocation();
    const activeDiscountCode = readBillingDiscountCodeFromSearch(location.search);
    const { access, isAuthenticated, refreshAccess } = useAuth();
    const [paddlePublicConfig, setPaddlePublicConfig] = useState<PaddlePublicConfig | null>(null);
    const [subscriptionSummary, setSubscriptionSummary] = useState<BillingSubscriptionSummary | null>(null);
    const [isSubscriptionSummaryLoading, setIsSubscriptionSummaryLoading] = useState(false);
    const unlimitedLabel = t('shared.unlimited');
    const noExpiryLabel = t('shared.noExpiry');
    const enabledLabel = t('shared.enabled');
    const disabledLabel = t('shared.disabled');
    const activeTierKey = access?.tierKey ?? 'tier_free';
    const accessBilling = access?.billing ?? null;
    const isEligibleAccount = isAuthenticated && access?.isAnonymous !== true;
    const billingRepairAttemptedRef = useRef(false);

    const loadSubscriptionSummaryWithRetry = useCallback(async (): Promise<BillingSubscriptionSummary | null> => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const summary = await getCurrentSubscriptionSummary();
            if (summary) {
                return summary;
            }
            if (attempt < 2) {
                await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
            }
        }
        return null;
    }, []);

    useEffect(() => {
        let cancelled = false;
        void fetchPaddlePublicConfig()
            .then((config) => {
                if (cancelled) return;
                setPaddlePublicConfig(config);
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Failed to load Paddle public config on pricing.', error);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!isEligibleAccount) {
            setSubscriptionSummary(null);
            setIsSubscriptionSummaryLoading(false);
            billingRepairAttemptedRef.current = false;
            return;
        }

        let cancelled = false;
        setIsSubscriptionSummaryLoading(true);
        void (async () => {
            let summary = await loadSubscriptionSummaryWithRetry();
            const shouldAttemptRepair = !billingRepairAttemptedRef.current && (
                !summary
                || Boolean(accessBilling?.providerSubscriptionId)
                || (access?.tierKey !== 'tier_free')
            );
            if (shouldAttemptRepair) {
                billingRepairAttemptedRef.current = true;
                try {
                    const repaired = await refreshCurrentPaddleSubscription();
                    await refreshAccess();
                    summary = repaired.summary ?? await loadSubscriptionSummaryWithRetry();
                } catch (error) {
                    if (!cancelled && !(error instanceof Error && error.message.includes('No paid Paddle subscription is linked'))) {
                        console.warn('Pricing billing summary refresh failed.', error);
                    }
                }
            }
            if (cancelled) return;
            setSubscriptionSummary(summary);
        })()
            .catch((error) => {
                if (cancelled) return;
                console.warn('Failed to load current billing summary on pricing.', error);
                setSubscriptionSummary(null);
            })
            .finally(() => {
                if (!cancelled) {
                    setIsSubscriptionSummaryLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [access?.tierKey, accessBilling?.providerSubscriptionId, isEligibleAccount, loadSubscriptionSummaryWithRetry, refreshAccess]);

    const billingState = {
        providerSubscriptionId: subscriptionSummary?.providerSubscriptionId ?? accessBilling?.providerSubscriptionId ?? null,
        providerStatus: subscriptionSummary?.providerStatus ?? accessBilling?.providerStatus ?? null,
        status: subscriptionSummary?.status ?? accessBilling?.subscriptionStatus ?? null,
        currentPeriodEnd: subscriptionSummary?.currentPeriodEnd ?? accessBilling?.currentPeriodEnd ?? null,
        cancelAt: subscriptionSummary?.cancelAt ?? accessBilling?.cancelAt ?? null,
        canceledAt: subscriptionSummary?.canceledAt ?? accessBilling?.canceledAt ?? null,
        graceEndsAt: subscriptionSummary?.graceEndsAt ?? accessBilling?.graceEndsAt ?? null,
        accessUntil: subscriptionSummary
            ? resolveBillingAccessUntil({
                providerStatus: subscriptionSummary.providerStatus,
                status: subscriptionSummary.status,
                currentPeriodEnd: subscriptionSummary.currentPeriodEnd,
                cancelAt: subscriptionSummary.cancelAt,
                canceledAt: subscriptionSummary.canceledAt,
                graceEndsAt: subscriptionSummary.graceEndsAt,
            })
            : accessBilling?.accessUntil ?? null,
        providerPriceId: subscriptionSummary?.providerPriceId ?? null,
    };
    const billingLifecycleState = resolveBillingLifecycleState({
        providerStatus: billingState.providerStatus,
        status: billingState.status,
        currentPeriodEnd: billingState.currentPeriodEnd,
        cancelAt: billingState.cancelAt,
        canceledAt: billingState.canceledAt,
        graceEndsAt: billingState.graceEndsAt,
        billingAccessUntil: billingState.accessUntil,
    });

    const effectiveActiveTierKey = resolveEffectiveBillingTierKey({
        currentTierKey: activeTierKey,
        subscription: {
            providerSubscriptionId: billingState.providerSubscriptionId,
            providerPriceId: billingState.providerPriceId,
            providerStatus: billingState.providerStatus,
            status: billingState.status,
            currentPeriodEnd: billingState.currentPeriodEnd,
            cancelAt: billingState.cancelAt,
            canceledAt: billingState.canceledAt,
            graceEndsAt: billingState.graceEndsAt,
            billingAccessUntil: billingState.accessUntil,
        },
        priceIds: paddlePublicConfig?.priceIds,
    });

    const resolveTierFeatures = (tierKey: typeof PLAN_ORDER[number]) => {
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
    };

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

                {(billingLifecycleState === 'canceled_grace' || billingLifecycleState === 'inactive') && isEligibleAccount && (
                    <div className={cn(
                        'mx-auto mb-8 max-w-5xl rounded-2xl border px-6 py-5',
                        billingLifecycleState === 'canceled_grace'
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-accent-200 bg-accent-50/70',
                    )}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-900">
                                    {billingLifecycleState === 'canceled_grace'
                                        ? t('shared.canceledGraceTitle')
                                        : t('shared.inactiveTitle')}
                                </p>
                                <p className="max-w-3xl text-sm leading-6 text-slate-700">
                                    {billingLifecycleState === 'canceled_grace'
                                        ? t('shared.canceledGraceHelper', {
                                            date: billingState.accessUntil
                                                ? new Date(billingState.accessUntil).toLocaleDateString()
                                                : '—',
                                        })
                                        : t('shared.inactiveHelper')}
                                </p>
                            </div>
                            <Link
                                to={`${buildPath('profileSettings')}#billing-management`}
                                className="inline-flex h-10 items-center rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                                onClick={() => trackEvent('pricing__plan_cta--resubscribe', {
                                    tier: effectiveActiveTierKey,
                                    current_tier: effectiveActiveTierKey,
                                })}
                            >
                                {t('shared.resubscribeCta')}
                            </Link>
                        </div>
                    </div>
                )}

                <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
                    {PLAN_ORDER.map((tierKey) => {
                        const tier = PLAN_CATALOG[tierKey];
                        const style = TIER_STYLE[tier.publicSlug];
                        const isPaidTier = tier.monthlyPriceUsd > 0;
                        const supportsCheckout = (tier.key === 'tier_mid' || tier.key === 'tier_premium')
                            && isPaddleTierCheckoutConfigured(paddlePublicConfig, tier.key as BillingCheckoutTierKey);
                        const featureList = resolveTierFeatures(tier.key);
                        const isCurrentTier = isAuthenticated && effectiveActiveTierKey === tier.key;
                        const freeTierTarget = isAuthenticated ? buildPath('profile') : buildPath('login');
                        const checkoutTarget = buildBillingCheckoutPath({
                            tierKey: tier.key as BillingCheckoutTierKey,
                            source: 'pricing_page',
                            returnTo: buildPath('pricing'),
                            discountCode: activeDiscountCode,
                        });
                        const resubscribeTarget = billingState.providerSubscriptionId
                            ? `${buildPath('profileSettings')}#billing-management`
                            : checkoutTarget;
                        const billingDecision = isPaidTier && isEligibleAccount
                            ? resolveBillingTierDecision({
                                currentTierKey: effectiveActiveTierKey,
                                targetTierKey: tier.key as BillingCheckoutTierKey,
                                subscription: {
                                    providerSubscriptionId: billingState.providerSubscriptionId,
                                    providerStatus: billingState.providerStatus,
                                    status: billingState.status,
                                    currentPeriodEnd: billingState.currentPeriodEnd,
                                    cancelAt: billingState.cancelAt,
                                    canceledAt: billingState.canceledAt,
                                    graceEndsAt: billingState.graceEndsAt,
                                    billingAccessUntil: billingState.accessUntil,
                                },
                            })
                            : null;
                        const ctaState = (() => {
                            if (!isPaidTier) {
                                return {
                                    label: t(`tiers.${tier.publicSlug}.cta`),
                                    href: freeTierTarget,
                                    disabled: false,
                                    className: 'block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50',
                                    analyticsId: `pricing__tier--${tier.publicSlug}`,
                                    helperText: null as string | null,
                                };
                            }

                            if (!supportsCheckout) {
                                return {
                                    label: t(`tiers.${tier.publicSlug}.cta`),
                                    href: checkoutTarget,
                                    disabled: true,
                                    className: 'w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400',
                                    analyticsId: `pricing__tier--${tier.publicSlug}`,
                                    helperText: t('shared.checkoutUnavailable'),
                                };
                            }

                            if (!isEligibleAccount || effectiveActiveTierKey === 'tier_free') {
                                return {
                                    label: t(`tiers.${tier.publicSlug}.cta`),
                                    href: checkoutTarget,
                                    disabled: false,
                                    className: 'block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700',
                                    analyticsId: `pricing__tier--${tier.publicSlug}`,
                                    helperText: null as string | null,
                                };
                            }

                            if (isSubscriptionSummaryLoading) {
                                return {
                                    label: t('shared.loadingPlanState'),
                                    href: checkoutTarget,
                                    disabled: true,
                                    className: 'w-full cursor-wait rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500',
                                    analyticsId: 'pricing__plan_cta--loading',
                                    helperText: null as string | null,
                                };
                            }

                            if (billingDecision?.action === 'current') {
                                if (billingLifecycleState === 'canceled_grace' || billingLifecycleState === 'inactive') {
                                    return {
                                        label: t('shared.resubscribeCta'),
                                        href: resubscribeTarget,
                                        disabled: false,
                                        className: 'block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700',
                                        analyticsId: 'pricing__plan_cta--resubscribe',
                                        helperText: billingLifecycleState === 'canceled_grace'
                                            ? t('shared.canceledGraceShort')
                                            : t('shared.inactiveShort'),
                                    };
                                }
                                return {
                                    label: t('shared.currentPlanCta'),
                                    href: checkoutTarget,
                                    disabled: true,
                                    className: 'w-full cursor-not-allowed rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-700',
                                    analyticsId: 'pricing__plan_cta--current',
                                    helperText: t('shared.currentPlanHelper'),
                                };
                            }

                            if (billingDecision?.action === 'upgrade') {
                                return {
                                    label: t('shared.upgradeCta'),
                                    href: checkoutTarget,
                                    disabled: false,
                                    className: 'block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700',
                                    analyticsId: 'pricing__plan_cta--upgrade',
                                    helperText: t('shared.upgradeHelper'),
                                };
                            }

                            if (billingDecision?.action === 'manage') {
                                if (billingLifecycleState === 'canceled_grace' || billingLifecycleState === 'inactive') {
                                    return {
                                        label: t('shared.resubscribeCta'),
                                        href: resubscribeTarget,
                                        disabled: false,
                                        className: 'block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700',
                                        analyticsId: 'pricing__plan_cta--resubscribe',
                                        helperText: billingLifecycleState === 'canceled_grace'
                                            ? t('shared.canceledGraceShort')
                                            : t('shared.inactiveShort'),
                                    };
                                }
                                return {
                                    label: t('shared.manageBillingCta'),
                                    href: `${buildPath('profileSettings')}#billing-management`,
                                    disabled: false,
                                    className: 'block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50',
                                    analyticsId: billingDecision.reason === 'downgrade_requires_management'
                                        ? 'pricing__plan_cta--downgrade_manage'
                                        : 'pricing__plan_cta--manage_billing',
                                    helperText: billingDecision.reason === 'downgrade_requires_management'
                                        ? t('shared.downgradeHelper')
                                        : t('shared.manageBillingHelper'),
                                };
                            }

                            return {
                                label: t(`tiers.${tier.publicSlug}.cta`),
                                href: checkoutTarget,
                                disabled: false,
                                className: 'block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700',
                                analyticsId: `pricing__tier--${tier.publicSlug}`,
                                helperText: null as string | null,
                            };
                        })();

                        return (
                            <article
                                key={tier.key}
                                className={cn(
                                    'group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg',
                                    style.surfaceClass,
                                )}
                            >
                                <div className={cn('border-b border-slate-200 px-6 py-6', style.headerClass)}>
                                    <div className="flex items-start justify-between gap-3">
                                        {(isPaidTier || isCurrentTier) ? (
                                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${style.badgeClass}`}>
                                                {isCurrentTier ? t('tiers.backpacker.badge') : t(`tiers.${tier.publicSlug}.badge`)}
                                            </span>
                                        ) : <span />}
                                        <div className="text-right">
                                            <div
                                                className="text-4xl font-extrabold tracking-tight text-slate-900"
                                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                                            >
                                                {`$${tier.monthlyPriceUsd}`}
                                            </div>
                                            <div className="text-sm font-medium text-slate-500">{t('shared.perMonth')}</div>
                                        </div>
                                    </div>
                                    <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
                                        {t(`tiers.${tier.publicSlug}.name`)}
                                    </h2>
                                    <p className="mt-2 max-w-[24rem] text-sm leading-6 text-slate-600">
                                        {t(`tiers.${tier.publicSlug}.description`)}
                                    </p>
                                </div>

                                <div className="flex flex-1 flex-col px-6 py-6">
                                <ul className="space-y-3">
                                    {featureList.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                                            <Check size={16} weight="bold" className={cn('mt-1 shrink-0', style.featureIconClass)} />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-8 border-t border-slate-200 pt-5">
                                    {isPaidTier ? (
                                        ctaState.disabled ? (
                                            <button
                                                type="button"
                                                disabled
                                                className={ctaState.className}
                                            >
                                                {ctaState.label}
                                            </button>
                                        ) : (
                                            <Link
                                                to={ctaState.href}
                                                onClick={() => trackEvent(ctaState.analyticsId, {
                                                    tier: tier.key,
                                                    current_tier: effectiveActiveTierKey,
                                                })}
                                                className={ctaState.className}
                                                {...getAnalyticsDebugAttributes(ctaState.analyticsId)}
                                            >
                                                {ctaState.label}
                                            </Link>
                                        )
                                    ) : (
                                        <Link
                                            to={ctaState.href}
                                            onClick={() => trackEvent(ctaState.analyticsId)}
                                            className={ctaState.className}
                                            {...getAnalyticsDebugAttributes(ctaState.analyticsId)}
                                        >
                                            {ctaState.label}
                                        </Link>
                                    )}
                                    {ctaState.helperText ? (
                                        <p className="mt-3 text-xs leading-5 text-slate-500">{ctaState.helperText}</p>
                                    ) : null}
                                </div>
                                </div>
                            </article>
                        );
                    })}
                </div>

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
