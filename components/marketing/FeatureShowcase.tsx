import React from 'react';
import {
    Sparkle,
    MapTrifold,
    SlidersHorizontal,
    UsersThree,
    ShareNetwork,
    LinkSimple,
    MapPin,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface BentoCardProps {
    icon: Icon;
    title: string;
    description: string;
    className?: string;
    stagger?: number;
    visual?: React.ReactNode;
}

const BentoCard: React.FC<BentoCardProps> = ({
    icon: IconComponent,
    title,
    description,
    className = '',
    stagger = 0,
    visual,
}) => (
    <div
        className={`animate-scroll-fade-up tf-stagger-range group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow duration-200 hover:shadow-lg ${className}`}
        style={{ '--wi': stagger } as React.CSSProperties}
    >
        {visual}
        <div className="relative">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-accent-100 transition-transform duration-300 group-hover:scale-110">
                <IconComponent size={24} weight="duotone" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
    </div>
);

// Miniature timeline mock: colored day-bars, one "dragged" out of line.
const TimelineVisual: React.FC = () => (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-7 end-7 hidden w-56 flex-col justify-center gap-2.5 lg:flex">
        <div className="h-7 w-40 rounded-lg bg-teal-100 ring-1 ring-teal-200" />
        <div className="h-7 w-52 translate-x-3 rounded-lg bg-amber-100 shadow-md ring-1 ring-amber-200 transition-transform duration-300 group-hover:translate-x-5" />
        <div className="h-7 w-32 rounded-lg bg-rose-100 ring-1 ring-rose-200" />
        <div className="h-7 w-44 rounded-lg bg-accent-100 ring-1 ring-accent-200" />
    </div>
);

// Miniature map mock: soft gradient terrain with a dashed route and pins.
const MapVisual: React.FC = () => (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.55]">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-accent-50" />
        <svg className="absolute inset-0 size-full" viewBox="0 0 300 200" fill="none" preserveAspectRatio="xMidYMid slice">
            <path
                d="M40 160 C 100 120, 130 60, 210 70 S 280 40, 290 30"
                stroke="var(--tf-accent-300)"
                strokeWidth="2"
                strokeDasharray="5 5"
                strokeLinecap="round"
            />
            <circle cx="40" cy="160" r="5" fill="var(--tf-accent-400)" />
            <circle cx="210" cy="70" r="5" fill="var(--tf-accent-400)" />
        </svg>
    </div>
);

export const FeatureShowcase: React.FC = () => {
    const { t } = useTranslation('home');

    return (
        <section className="py-16 md:py-24 lazy-feature-showcase">
            <div className="animate-scroll-blur-in">
                <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                    {t('featureShowcase.title')}
                </h2>
                <p className="mt-3 max-w-xl text-pretty text-base text-slate-600 md:text-lg">
                    {t('featureShowcase.subtitle')}
                </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-6">
                <BentoCard
                    icon={Sparkle}
                    title={t('featureShowcase.items.aiTripCreation.title')}
                    description={t('featureShowcase.items.aiTripCreation.description')}
                    className="md:col-span-6 lg:col-span-4"
                    stagger={0}
                    visual={<TimelineVisual />}
                />
                <BentoCard
                    icon={MapTrifold}
                    title={t('featureShowcase.items.interactiveMapStyles.title')}
                    description={t('featureShowcase.items.interactiveMapStyles.description')}
                    className="md:col-span-3 lg:col-span-2"
                    stagger={1}
                    visual={<MapVisual />}
                />
                <BentoCard
                    icon={SlidersHorizontal}
                    title={t('featureShowcase.items.easyItineraryAdjustments.title')}
                    description={t('featureShowcase.items.easyItineraryAdjustments.description')}
                    className="md:col-span-3 lg:col-span-2"
                    stagger={0}
                />
                <BentoCard
                    icon={UsersThree}
                    title={t('featureShowcase.items.communityExamples.title')}
                    description={t('featureShowcase.items.communityExamples.description')}
                    className="md:col-span-3 lg:col-span-2"
                    stagger={1}
                />
                <BentoCard
                    icon={ShareNetwork}
                    title={t('featureShowcase.items.shareCollaborate.title')}
                    description={t('featureShowcase.items.shareCollaborate.description')}
                    className="md:col-span-3 lg:col-span-2"
                    stagger={2}
                />
                <BentoCard
                    icon={LinkSimple}
                    title={t('featureShowcase.items.activityBookingLinks.title')}
                    description={t('featureShowcase.items.activityBookingLinks.description')}
                    className="md:col-span-6"
                    stagger={0}
                    visual={
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 end-0 hidden items-center pe-10 lg:flex"
                        >
                            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm">
                                <MapPin size={14} weight="duotone" className="text-accent-500" />
                                travelflow.app/t/kyoto-7d
                            </div>
                        </div>
                    }
                />
            </div>
        </section>
    );
};
