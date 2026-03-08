import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';

import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, ANONYMOUS_TRIP_LIMIT } from '../config/productLimits';
import { buildPath } from '../config/routes';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { buildBillingCheckoutPath, type BillingCheckoutTierKey } from '../services/billingService';
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
    const { access, isAuthenticated } = useAuth();
    const [paddlePublicConfig, setPaddlePublicConfig] = useState<PaddlePublicConfig | null>(null);
    const unlimitedLabel = t('shared.unlimited');
    const noExpiryLabel = t('shared.noExpiry');
    const enabledLabel = t('shared.enabled');
    const disabledLabel = t('shared.disabled');
    const activeTierKey = access?.tierKey ?? 'tier_free';
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

                <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
                    {PLAN_ORDER.map((tierKey) => {
                        const tier = PLAN_CATALOG[tierKey];
                        const style = TIER_STYLE[tier.publicSlug];
                        const isPaidTier = tier.monthlyPriceUsd > 0;
                        const supportsCheckout = (tier.key === 'tier_mid' || tier.key === 'tier_premium')
                            && isPaddleTierCheckoutConfigured(paddlePublicConfig, tier.key as BillingCheckoutTierKey);
                        const featureList = resolveTierFeatures(tier.key);
                        const isCurrentTier = isAuthenticated && activeTierKey === tier.key;
                        const freeTierTarget = isAuthenticated ? buildPath('profile') : buildPath('login');
                        const checkoutTarget = buildBillingCheckoutPath({
                            tierKey: tier.key as BillingCheckoutTierKey,
                            source: 'pricing_page',
                            returnTo: buildPath('pricing'),
                        });

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
                                        supportsCheckout ? (
                                            <Link
                                                to={checkoutTarget}
                                                onClick={() => trackEvent(`pricing__tier--${tier.publicSlug}`)}
                                                className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                                {...getAnalyticsDebugAttributes(`pricing__tier--${tier.publicSlug}`)}
                                            >
                                                {t(`tiers.${tier.publicSlug}.cta`)}
                                            </Link>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
                                            >
                                                {t(`tiers.${tier.publicSlug}.cta`)}
                                            </button>
                                        )
                                    ) : (
                                        <Link
                                            to={freeTierTarget}
                                            onClick={() => trackEvent(`pricing__tier--${tier.publicSlug}`)}
                                            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
                                            {...getAnalyticsDebugAttributes(`pricing__tier--${tier.publicSlug}`)}
                                        >
                                            {t(`tiers.${tier.publicSlug}.cta`)}
                                        </Link>
                                    )}
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
