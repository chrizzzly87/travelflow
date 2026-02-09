import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';

interface PricingTier {
    name: string;
    price: string;
    period: string;
    badge: string;
    badgeClass: string;
    description: string;
    accentClass: string;
    ringClass: string;
    features: string[];
    notIncluded?: string[];
    cta: string;
    ctaLink?: string;
    ctaDisabled?: boolean;
    highlighted?: boolean;
}

const tiers: PricingTier[] = [
    {
        name: 'Free',
        price: '$0',
        period: '/mo',
        badge: 'Current plan',
        badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
        description: 'Everything you need to plan your next trip.',
        accentClass: 'from-slate-600 to-slate-800',
        ringClass: 'ring-slate-900/5',
        features: [
            'AI trip generation (3 modes)',
            'Interactive map & timeline',
            'Drag-and-drop itinerary builder',
            'Print-ready layouts',
            'Up to 5 saved trips',
            'Share via link',
        ],
        cta: 'Get Started',
        ctaLink: '/create-trip',
    },
    {
        name: 'Casual',
        price: '$9',
        period: '/mo',
        badge: 'Coming Soon',
        badgeClass: 'border-accent-300 bg-accent-100 text-accent-700',
        description: 'For frequent travelers who want more power.',
        accentClass: 'from-accent-500 to-accent-700',
        ringClass: 'ring-accent-500/10',
        features: [
            'Everything in Free, plus:',
            'Unlimited saved trips',
            'Priority AI generation',
            'PDF & calendar export',
            'Advanced sharing controls',
            'Custom map styles',
        ],
        cta: 'Coming Soon',
        ctaDisabled: true,
        highlighted: true,
    },
    {
        name: 'Globetrotter',
        price: '$19',
        period: '/mo',
        badge: 'Coming Soon',
        badgeClass: 'border-amber-300 bg-amber-100 text-amber-700',
        description: 'The ultimate travel planning experience.',
        accentClass: 'from-amber-500 to-amber-700',
        ringClass: 'ring-amber-500/10',
        features: [
            'Everything in Casual, plus:',
            'Collaborative editing',
            'Premium travel insights',
            'Offline access',
            'Premium support',
            'Early access to new features',
        ],
        cta: 'Coming Soon',
        ctaDisabled: true,
    },
];

export const PricingPage: React.FC = () => {
    return (
        <MarketingLayout>
            <div className="py-8 md:py-16">
                <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
                    <h1
                        className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                        Simple, transparent pricing
                    </h1>
                    <p className="mt-4 text-lg text-slate-500">
                        Start for free and upgrade when you need more. No hidden fees, cancel anytime.
                    </p>
                </div>

                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`relative flex flex-col rounded-2xl bg-white p-8 shadow-lg ring-1 ${tier.ringClass} ${
                                tier.highlighted ? 'md:-mt-4 md:mb-0 md:pb-12 md:pt-10 scale-[1.02] md:scale-105 z-10' : ''
                            }`}
                        >
                            {/* Accent bar */}
                            <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${tier.accentClass}`} />

                            {/* Badge */}
                            <span className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-semibold ${tier.badgeClass}`}>
                                {tier.badge}
                            </span>

                            {/* Price */}
                            <div className="mt-5 flex items-baseline gap-1">
                                <span
                                    className="text-4xl font-extrabold tracking-tight text-slate-900"
                                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                                >
                                    {tier.price}
                                </span>
                                <span className="text-sm font-medium text-slate-500">{tier.period}</span>
                            </div>

                            <p className="mt-2 text-sm text-slate-500">{tier.description}</p>

                            {/* Features */}
                            <ul className="mt-6 flex-1 space-y-3">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                                        <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-accent-600" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <div className="mt-8">
                                {tier.ctaDisabled ? (
                                    <button
                                        disabled
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
                                    >
                                        {tier.cta}
                                    </button>
                                ) : (
                                    <Link
                                        to={tier.ctaLink || '/create-trip'}
                                        className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                    >
                                        {tier.cta}
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mx-auto mt-16 max-w-2xl text-center">
                    <p className="text-sm text-slate-400">
                        Prices shown are for illustration only. TravelFlow is currently free during early access.
                    </p>
                </div>
            </div>
        </MarketingLayout>
    );
};
