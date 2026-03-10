import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';

import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, ANONYMOUS_TRIP_LIMIT } from '../config/productLimits';
import { buildPath } from '../config/routes';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { resolveBillingTierDecision } from '../lib/billing/subscriptionState';
import {
    buildBillingCheckoutPath,
    getCurrentSubscriptionSummary,
    getPaddleSubscriptionManagementUrls,
    lookupPaddleDiscount,
    readBillingDiscountCodeFromSearch,
    type BillingDiscountLookup,
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
    const navigate = useNavigate();
    const activeDiscountCode = readBillingDiscountCodeFromSearch(location.search);
    const { access, isAuthenticated } = useAuth();
    const [paddlePublicConfig, setPaddlePublicConfig] = useState<PaddlePublicConfig | null>(null);
    const [subscriptionSummary, setSubscriptionSummary] = useState<BillingSubscriptionSummary | null>(null);
    const [isSubscriptionSummaryLoading, setIsSubscriptionSummaryLoading] = useState(false);
    const [voucherInput, setVoucherInput] = useState(activeDiscountCode || '');
    const [voucherLookups, setVoucherLookups] = useState<Partial<Record<BillingCheckoutTierKey, BillingDiscountLookup>>>({});
    const [voucherErrorMessage, setVoucherErrorMessage] = useState<string | null>(null);
    const [isVoucherLoading, setIsVoucherLoading] = useState(false);
    const unlimitedLabel = t('shared.unlimited');
    const noExpiryLabel = t('shared.noExpiry');
    const enabledLabel = t('shared.enabled');
    const disabledLabel = t('shared.disabled');
    const voucherInvalidMessage = t('voucher.invalidMessage');
    const activeTierKey = access?.tierKey ?? 'tier_free';
    const hasPaidTier = activeTierKey === 'tier_mid' || activeTierKey === 'tier_premium';
    const isEligibleAccount = isAuthenticated && access?.isAnonymous !== true;
    const billingRepairAttemptedRef = useRef(false);
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
            let summary = await getCurrentSubscriptionSummary();
            if (!summary && hasPaidTier && !billingRepairAttemptedRef.current) {
                billingRepairAttemptedRef.current = true;
                try {
                    await getPaddleSubscriptionManagementUrls();
                    summary = await getCurrentSubscriptionSummary();
                } catch (error) {
                    if (!cancelled) {
                        console.warn('Pricing billing summary repair failed.', error);
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
    }, [hasPaidTier, isEligibleAccount]);

    useEffect(() => {
        const discountCode = activeDiscountCode;
        if (!discountCode) {
            setVoucherLookups({});
            setVoucherErrorMessage(null);
            setIsVoucherLoading(false);
            return;
        }

        let cancelled = false;
        setIsVoucherLoading(true);

        void Promise.allSettled([
            lookupPaddleDiscount(discountCode, 'tier_mid'),
            lookupPaddleDiscount(discountCode, 'tier_premium'),
        ]).then((results) => {
            if (cancelled) return;

            const nextLookups: Partial<Record<BillingCheckoutTierKey, BillingDiscountLookup>> = {};
            const resolvedErrors: string[] = [];

            if (results[0].status === 'fulfilled') {
                nextLookups.tier_mid = results[0].value;
            } else {
                resolvedErrors.push(results[0].reason instanceof Error ? results[0].reason.message : voucherInvalidMessage);
            }

            if (results[1].status === 'fulfilled') {
                nextLookups.tier_premium = results[1].value;
            } else {
                resolvedErrors.push(results[1].reason instanceof Error ? results[1].reason.message : voucherInvalidMessage);
            }

            setVoucherLookups(nextLookups);
            setVoucherErrorMessage(
                Object.keys(nextLookups).length > 0
                    ? null
                    : resolvedErrors[0] || voucherInvalidMessage
            );
        }).catch((error) => {
            if (!cancelled) {
                setVoucherLookups({});
                setVoucherErrorMessage(error instanceof Error ? error.message : voucherInvalidMessage);
            }
        }).finally(() => {
            if (!cancelled) {
                setIsVoucherLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [activeDiscountCode, voucherInvalidMessage]);

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

    const formatMoney = (amountMinor: number, currencyCode: string) => (
        new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode,
        }).format(amountMinor / 100)
    );

    const handleApplyVoucher = () => {
        const normalized = voucherInput.trim().toUpperCase();
        const params = new URLSearchParams(location.search);
        params.delete('voucher');
        if (!normalized) {
            params.delete('discount');
        } else {
            params.set('discount', normalized);
        }

        navigate({
            pathname: location.pathname,
            search: params.toString() ? `?${params.toString()}` : '',
        }, { replace: false });

        trackEvent(normalized ? 'pricing__voucher--apply' : 'pricing__voucher--clear', {
            code: normalized || null,
        });
    };

    const handleClearVoucher = () => {
        const params = new URLSearchParams(location.search);
        params.delete('discount');
        params.delete('voucher');
        setVoucherInput('');
        navigate({
            pathname: location.pathname,
            search: params.toString() ? `?${params.toString()}` : '',
        }, { replace: false });
        trackEvent('pricing__voucher--clear');
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

                <div className="mx-auto mb-8 max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('voucher.eyebrow')}</p>
                            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{t('voucher.title')}</h2>
                            <p className="mt-1 text-sm text-slate-600">{t('voucher.description')}</p>
                        </div>
                        <div className="w-full max-w-xl">
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    type="text"
                                    value={voucherInput}
                                    onChange={(event) => setVoucherInput(event.target.value.toUpperCase())}
                                    placeholder={t('voucher.placeholder')}
                                    autoCapitalize="characters"
                                    className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyVoucher}
                                    disabled={isVoucherLoading}
                                    className="inline-flex h-11 items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700 disabled:cursor-wait disabled:opacity-70"
                                    {...getAnalyticsDebugAttributes('pricing__voucher--apply')}
                                >
                                    {isVoucherLoading ? t('voucher.applying') : t('voucher.applyCta')}
                                </button>
                                {activeDiscountCode ? (
                                    <button
                                        type="button"
                                        onClick={handleClearVoucher}
                                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                        {...getAnalyticsDebugAttributes('pricing__voucher--clear')}
                                    >
                                        {t('voucher.clearCta')}
                                    </button>
                                ) : null}
                            </div>
                            {activeDiscountCode && Object.keys(voucherLookups).length > 0 ? (
                                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                    <span className="font-semibold">{t('voucher.appliedMessage', { code: activeDiscountCode })}</span>{' '}
                                    {t('voucher.appliedDescription')}
                                </div>
                            ) : null}
                            {voucherErrorMessage ? (
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    {voucherErrorMessage}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
                    {PLAN_ORDER.map((tierKey) => {
                        const tier = PLAN_CATALOG[tierKey];
                        const style = TIER_STYLE[tier.publicSlug];
                        const isPaidTier = tier.monthlyPriceUsd > 0;
                        const supportsCheckout = (tier.key === 'tier_mid' || tier.key === 'tier_premium')
                            && isPaddleTierCheckoutConfigured(paddlePublicConfig, tier.key as BillingCheckoutTierKey);
                        const discountLookup = isPaidTier && (tier.key === 'tier_mid' || tier.key === 'tier_premium')
                            ? voucherLookups[tier.key as BillingCheckoutTierKey] || null
                            : null;
                        const featureList = resolveTierFeatures(tier.key);
                        const isCurrentTier = isAuthenticated && activeTierKey === tier.key;
                        const freeTierTarget = isAuthenticated ? buildPath('profile') : buildPath('login');
                        const checkoutTarget = buildBillingCheckoutPath({
                            tierKey: tier.key as BillingCheckoutTierKey,
                            source: 'pricing_page',
                            returnTo: buildPath('pricing'),
                            discountCode: activeDiscountCode,
                        });
                        const billingDecision = isPaidTier && isEligibleAccount
                            ? resolveBillingTierDecision({
                                currentTierKey: activeTierKey,
                                targetTierKey: tier.key as BillingCheckoutTierKey,
                                subscription: subscriptionSummary,
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

                            if (!isEligibleAccount || activeTierKey === 'tier_free') {
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
                                    {discountLookup?.applicableToTier && discountLookup.estimate ? (
                                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                                {t('voucher.cardEyebrow', { code: discountLookup.code })}
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-emerald-900">
                                                {t('voucher.cardSavingsMessage', {
                                                    savings: formatMoney(discountLookup.estimate.savingsAmount || 0, discountLookup.estimate.currencyCode || 'USD'),
                                                    discounted: formatMoney(discountLookup.estimate.discountedAmount || 0, discountLookup.estimate.currencyCode || 'USD'),
                                                })}
                                            </p>
                                        </div>
                                    ) : null}

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
                                                    current_tier: activeTierKey,
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
