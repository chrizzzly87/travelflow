import React from 'react';
import { useTranslation } from 'react-i18next';

interface Feature {
    title: string;
    description: string;
}

export const FeatureShowcase: React.FC = () => {
    const { t } = useTranslation('home');

    const features: Feature[] = [
        {
            title: t('featureShowcase.items.aiTripCreation.title'),
            description: t('featureShowcase.items.aiTripCreation.description'),
        },
        {
            title: t('featureShowcase.items.interactiveMapStyles.title'),
            description: t('featureShowcase.items.interactiveMapStyles.description'),
        },
        {
            title: t('featureShowcase.items.easyItineraryAdjustments.title'),
            description: t('featureShowcase.items.easyItineraryAdjustments.description'),
        },
        {
            title: t('featureShowcase.items.communityExamples.title'),
            description: t('featureShowcase.items.communityExamples.description'),
        },
        {
            title: t('featureShowcase.items.shareCollaborate.title'),
            description: t('featureShowcase.items.shareCollaborate.description'),
        },
        {
            title: t('featureShowcase.items.activityBookingLinks.title'),
            description: t('featureShowcase.items.activityBookingLinks.description'),
        },
    ];

    return (
        <section className="border-t border-slate-200 py-20 md:py-28 lazy-feature-showcase">
            <div className="grid gap-5 lg:grid-cols-12">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl lg:col-span-7">
                    {t('featureShowcase.title')}
                </h2>
                <p className="max-w-[64ch] text-base leading-7 text-slate-600 lg:col-span-5 lg:pt-2">
                    {t('featureShowcase.subtitle')}
                </p>
            </div>

            <div className="mt-14 grid border-t border-slate-200 md:grid-cols-2">
                {features.map((feature, index) => {
                    return (
                        <article
                            key={feature.title}
                            className={`grid grid-cols-[2.5rem_1fr] gap-4 border-b border-slate-200 py-8 md:min-h-52 md:p-8 ${index % 2 === 0 ? 'md:border-r' : ''}`}
                        >
                            <span className="font-mono text-xs tabular-nums text-slate-400">0{index + 1}</span>
                            <div className="max-w-xl">
                                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                                    {feature.title}
                                </h3>
                                <p className="mt-3 text-base leading-7 text-slate-600">
                                    {feature.description}
                                </p>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};
