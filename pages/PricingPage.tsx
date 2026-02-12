import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, ANONYMOUS_TRIP_LIMIT } from '../config/productLimits';
import { buildPath } from '../config/routes';

interface PricingTier {
    id: 'free' | 'casual' | 'globetrotter';
    price: string;
    period: string;
    badgeClass: string;
    accentClass: string;
    ringClass: string;
    ctaDisabled?: boolean;
    highlighted?: boolean;
}

const tierConfigs: PricingTier[] = [
    {
        id: 'free',
        price: '$0',
        period: '/mo',
        badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
        accentClass: 'from-slate-600 to-slate-800',
        ringClass: 'ring-slate-900/5',
    },
    {
        id: 'casual',
        price: '$9',
        period: '/mo',
        badgeClass: 'border-accent-300 bg-accent-100 text-accent-700',
        accentClass: 'from-accent-500 to-accent-700',
        ringClass: 'ring-accent-500/10',
        ctaDisabled: true,
        highlighted: true,
    },
    {
        id: 'globetrotter',
        price: '$19',
        period: '/mo',
        badgeClass: 'border-amber-300 bg-amber-100 text-amber-700',
        accentClass: 'from-amber-500 to-amber-700',
        ringClass: 'ring-amber-500/10',
        ctaDisabled: true,
    },
];

export const PricingPage: React.FC = () => {
    const { t } = useTranslation('pricing');

    return (
        <MarketingLayout>
            <div className="py-8 md:py-16">
                <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
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
                    {tierConfigs.map((tier) => {
                        const featureList = t(`tiers.${tier.id}.features`, { returnObjects: true }) as string[];
                        const tierName = t(`tiers.${tier.id}.name`);
                        const tierBadge = t(`tiers.${tier.id}.badge`);
                        const tierDescription = t(`tiers.${tier.id}.description`);
                        const tierCta = t(`tiers.${tier.id}.cta`);

                        return (
                            <div
                                key={tier.id}
                                className={`relative flex flex-col rounded-2xl bg-white p-8 shadow-lg ring-1 ${tier.ringClass} ${
                                    tier.highlighted ? 'md:-mt-4 md:mb-0 md:pb-12 md:pt-10 scale-[1.02] md:scale-105 z-10' : ''
                                }`}
                            >
                                <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${tier.accentClass}`} />

                                <span className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-semibold ${tier.badgeClass}`}>
                                    {tierBadge}
                                </span>

                                <div className="mt-5 flex items-baseline gap-1">
                                    <span
                                        className="text-4xl font-extrabold tracking-tight text-slate-900"
                                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                                    >
                                        {tier.price}
                                    </span>
                                    <span className="text-sm font-medium text-slate-500">{tier.period}</span>
                                </div>

                                <h2 className="mt-3 text-lg font-bold text-slate-900">{tierName}</h2>
                                <p className="mt-2 text-sm text-slate-500">{tierDescription}</p>

                                <ul className="mt-6 flex-1 space-y-3">
                                    {featureList.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                                            <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-accent-600" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-8">
                                    {tier.ctaDisabled ? (
                                        <button
                                            disabled
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
                                        >
                                            {tierCta}
                                        </button>
                                    ) : (
                                        <Link
                                            to={buildPath('createTrip')}
                                            onClick={() => trackEvent(`pricing__tier--${tier.id}`)}
                                            className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                            {...getAnalyticsDebugAttributes(`pricing__tier--${tier.id}`)}
                                        >
                                            {tierCta}
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
