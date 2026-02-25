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
import { motion } from 'framer-motion';

interface Feature {
    icon: Icon;
    title: string;
    description: string;
    span?: string;
    color?: string;
}

const containerVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        }
    }
};

const itemVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
        opacity: 1, 
        y: 0, 
        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } 
    }
};

export const FeatureShowcase: React.FC = () => {
    const { t } = useTranslation('home');

    const features: Feature[] = [
        {
            icon: Sparkle,
            title: t('featureShowcase.items.aiTripCreation.title'),
            description: t('featureShowcase.items.aiTripCreation.description'),
            span: "md:col-span-2 md:row-span-2",
            color: "text-slate-900",
        },
        {
            icon: MapTrifold,
            title: t('featureShowcase.items.interactiveMapStyles.title'),
            description: t('featureShowcase.items.interactiveMapStyles.description'),
            color: "text-slate-700",
        },
        {
            icon: SlidersHorizontal,
            title: t('featureShowcase.items.easyItineraryAdjustments.title'),
            description: t('featureShowcase.items.easyItineraryAdjustments.description'),
            color: "text-slate-700",
        },
        {
            icon: UsersThree,
            title: t('featureShowcase.items.communityExamples.title'),
            description: t('featureShowcase.items.communityExamples.description'),
            color: "text-slate-700",
        },
        {
            icon: ShareNetwork,
            title: t('featureShowcase.items.shareCollaborate.title'),
            description: t('featureShowcase.items.shareCollaborate.description'),
            span: "md:col-span-2",
            color: "text-slate-800",
        },
        {
            icon: LinkSimple,
            title: t('featureShowcase.items.activityBookingLinks.title'),
            description: t('featureShowcase.items.activityBookingLinks.description'),
            color: "text-slate-700",
        },
    ];

    return (
        <section className="py-24 md:py-32 relative max-w-7xl mx-auto px-5 md:px-8 w-full">
            <motion.div 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-3xl mb-16 md:mb-24"
            >
                <h2 className="text-3xl font-extrabold tracking-tighter text-slate-900 md:text-5xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                    {t('featureShowcase.title')}
                </h2>
                <p className="mt-5 text-lg text-slate-500 leading-relaxed font-medium tracking-tight">
                    {t('featureShowcase.subtitle')}
                </p>
            </motion.div>

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-50px" }}
                className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[minmax(220px,auto)]"
            >
                {features.map((feature, index) => {
                    const IconComponent = feature.icon;

                    return (
                        <motion.div
                            key={`${feature.title}-${index}`}
                            variants={itemVariants}
                            whileHover={{ y: -4, transition: { duration: 0.2 } }}
                            className={`group relative overflow-hidden rounded-[1.5rem] bg-white border border-slate-200 p-8 shadow-sm transition-shadow hover:shadow-md ${feature.span || ''}`}
                        >
                            <div className="relative z-10 flex flex-col h-full">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 mb-8 transition-transform duration-300 group-hover:scale-105 ${feature.color}`}>
                                    <IconComponent size={24} weight="duotone" />
                                </div>

                                <div className="mt-auto">
                                    <h3 className={`text-xl font-bold text-slate-900 mb-2 tracking-tight ${feature.span?.includes('col-span-2') ? 'md:text-2xl' : ''}`}>
                                        {feature.title}
                                    </h3>
                                    <p className="text-sm md:text-base font-medium leading-relaxed text-slate-500">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </section>
    );
};
