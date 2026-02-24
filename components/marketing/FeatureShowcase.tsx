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
    bgColor?: string;
}

const containerVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15
        }
    }
};

const itemVariants: import('framer-motion').Variants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};

export const FeatureShowcase: React.FC = () => {
    const { t } = useTranslation('home');

    const features: Feature[] = [
        {
            icon: Sparkle,
            title: t('featureShowcase.items.aiTripCreation.title'),
            description: t('featureShowcase.items.aiTripCreation.description'),
            span: "md:col-span-2 md:row-span-2",
            color: "text-accent-500",
            bgColor: "bg-gradient-to-br from-accent-500/10 to-accent-600/5"
        },
        {
            icon: MapTrifold,
            title: t('featureShowcase.items.interactiveMapStyles.title'),
            description: t('featureShowcase.items.interactiveMapStyles.description'),
            color: "text-emerald-500",
            bgColor: "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5"
        },
        {
            icon: SlidersHorizontal,
            title: t('featureShowcase.items.easyItineraryAdjustments.title'),
            description: t('featureShowcase.items.easyItineraryAdjustments.description'),
            color: "text-purple-500",
            bgColor: "bg-gradient-to-br from-purple-500/10 to-purple-600/5"
        },
        {
            icon: UsersThree,
            title: t('featureShowcase.items.communityExamples.title'),
            description: t('featureShowcase.items.communityExamples.description'),
            color: "text-pink-500",
            bgColor: "bg-gradient-to-br from-pink-500/10 to-pink-600/5"
        },
        {
            icon: ShareNetwork,
            title: t('featureShowcase.items.shareCollaborate.title'),
            description: t('featureShowcase.items.shareCollaborate.description'),
            span: "md:col-span-2",
            color: "text-indigo-500",
            bgColor: "bg-gradient-to-br from-indigo-500/10 to-indigo-600/5"
        },
        {
            icon: LinkSimple,
            title: t('featureShowcase.items.activityBookingLinks.title'),
            description: t('featureShowcase.items.activityBookingLinks.description'),
            color: "text-amber-500",
            bgColor: "bg-gradient-to-br from-amber-500/10 to-amber-600/5"
        },
    ];

    return (
        <section className="py-24 md:py-32 relative">
            <div className="absolute top-1/2 left-0 w-full h-[500px] bg-accent-100/30 blur-[120px] rounded-full -z-10 pointer-events-none -translate-y-1/2" />
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7 }}
                className="max-w-3xl text-center mx-auto mb-16 md:mb-24"
            >
                <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-6xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                    {t('featureShowcase.title')}
                </h2>
                <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed font-medium">
                    {t('featureShowcase.subtitle')}
                </p>
            </motion.div>

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-50px" }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]"
            >
                {features.map((feature, index) => {
                    const IconComponent = feature.icon;

                    return (
                        <motion.div
                            key={`${feature.title}-${index}`}
                            variants={itemVariants}
                            whileHover={{ y: -8, scale: 1.01 }}
                            className={`group relative overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white/60 p-8 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all ${feature.span || ''} ${feature.bgColor}`}
                        >
                            <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            
                            <div className="relative z-10 flex flex-col h-full">
                                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md shadow-slate-200 mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${feature.color}`}>
                                    <IconComponent size={32} weight="duotone" />
                                </div>

                                <div className="mt-auto">
                                    <h3 className={`text-2xl font-bold text-slate-900 mb-3 tracking-tight ${feature.span?.includes('col-span-2') ? 'md:text-3xl' : ''}`}>
                                        {feature.title}
                                    </h3>
                                    <p className="text-base font-medium leading-relaxed text-slate-600/90">
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
