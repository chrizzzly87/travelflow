import React from 'react';
import {
    Sparkle,
    MapTrifold,
    SlidersHorizontal,
    UsersThree,
    ShareNetwork,
    LinkSimple,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface Feature {
    icon: Icon;
    title: string;
    description: string;
}

export const FeatureShowcase: React.FC = () => {
    const { t } = useTranslation('home');

    const features: Feature[] = [
        {
            icon: Sparkle,
            title: t('featureShowcase.items.aiTripCreation.title'),
            description: t('featureShowcase.items.aiTripCreation.description'),
        },
        {
            icon: MapTrifold,
            title: t('featureShowcase.items.interactiveMapStyles.title'),
            description: t('featureShowcase.items.interactiveMapStyles.description'),
        },
        {
            icon: SlidersHorizontal,
            title: t('featureShowcase.items.easyItineraryAdjustments.title'),
            description: t('featureShowcase.items.easyItineraryAdjustments.description'),
        },
        {
            icon: UsersThree,
            title: t('featureShowcase.items.communityExamples.title'),
            description: t('featureShowcase.items.communityExamples.description'),
        },
        {
            icon: ShareNetwork,
            title: t('featureShowcase.items.shareCollaborate.title'),
            description: t('featureShowcase.items.shareCollaborate.description'),
        },
        {
            icon: LinkSimple,
            title: t('featureShowcase.items.activityBookingLinks.title'),
            description: t('featureShowcase.items.activityBookingLinks.description'),
        },
    ];

    return (
        <section className="py-16 md:py-24">
            <div className="animate-scroll-blur-in">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    {t('featureShowcase.title')}
                </h2>
                <p className="mt-3 max-w-xl text-base text-slate-600">
                    {t('featureShowcase.subtitle')}
                </p>
            </div>

            <div className="mt-14 space-y-16 md:space-y-20">
                {features.map((feature, index) => {
                    const IconComponent = feature.icon;
                    const isEven = index % 2 === 0;
                    const slideClass = isEven
                        ? 'animate-scroll-slide-left'
                        : 'animate-scroll-slide-right';

                    return (
                        <div
                            key={`${feature.title}-${index}`}
                            className={`${slideClass} flex flex-col gap-6 md:flex-row md:items-center md:gap-12 ${
                                !isEven ? 'md:flex-row-reverse' : ''
                            }`}
                        >
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 shadow-sm ring-1 ring-accent-100 transition-transform duration-300 hover:scale-110 hover:shadow-md md:h-24 md:w-24">
                                <IconComponent size={40} weight="duotone" />
                            </div>

                            <div className="max-w-lg">
                                <h3 className="text-xl font-bold text-slate-900">
                                    {feature.title}
                                </h3>
                                <p className="mt-2 text-base leading-relaxed text-slate-600">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
