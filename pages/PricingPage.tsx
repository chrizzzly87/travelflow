import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, ANONYMOUS_TRIP_LIMIT } from '../config/productLimits';
import { buildPath } from '../config/routes';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

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
    const { t } = useTranslation('pricing');
    const unlimitedLabel = t('shared.unlimited');
    const noExpiryLabel = t('shared.noExpiry');
    const enabledLabel = t('shared.enabled');
    const disabledLabel = t('shared.disabled');

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
                        const featureList = Array.isArray(featureTemplates)
                            ? featureTemplates.map((_, index) => (
                                t(`tiers.${tier.publicSlug}.features.${index}`, interpolationValues)
                            ))
                            : [];

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
                                        <button
                                            disabled
                                            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
                                        >
                                            {t(`tiers.${tier.publicSlug}.cta`)}
                                        </button>
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
