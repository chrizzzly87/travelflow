import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';
import { RocketLaunch } from '@phosphor-icons/react';

export const CtaBanner: React.FC = () => {
    const { t } = useTranslation(['home', 'common']);

    return (
        <section className="pb-16 md:pb-24 px-5 sm:px-8">
            <motion.div 
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
                className="relative max-w-5xl mx-auto rounded-[3rem] bg-slate-950 px-8 py-16 text-center md:px-16 md:py-24 overflow-hidden shadow-2xl"
            >
                {/* Animated Background Elements */}
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                    className="pointer-events-none absolute -top-[50%] -right-[20%] w-[80%] h-[150%] rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 blur-[80px]" 
                />
                <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="pointer-events-none absolute -bottom-[50%] -left-[20%] w-[80%] h-[150%] rounded-full bg-gradient-to-tr from-accent-500/20 to-cyan-400/20 blur-[80px]" 
                />

                <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="flex h-16 w-16 mb-8 items-center justify-center rounded-2xl bg-white/10 text-accent-300 backdrop-blur-md shadow-lg border border-white/10"
                    >
                        <RocketLaunch size={32} weight="duotone" />
                    </motion.div>

                    <h2 className="text-4xl font-black tracking-tight text-white md:text-6xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                        {t('home:cta.title')}
                    </h2>
                    
                    <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-slate-300 font-medium leading-relaxed">
                        {t('home:cta.subtitle')}
                    </p>
                    
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-10 inline-block"
                    >
                        <Link
                            to={buildPath('createTrip')}
                            onClick={() => trackEvent('home__bottom_cta')}
                            className="group relative inline-flex items-center justify-center rounded-full bg-white px-10 py-5 text-lg font-bold text-slate-900 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all hover:bg-slate-50 hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] overflow-hidden"
                            {...getAnalyticsDebugAttributes('home__bottom_cta')}
                        >
                            <span className="relative z-10">{t('common:buttons.startPlanningFree')}</span>
                            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-200/50 to-transparent group-hover:animate-shimmer" />
                        </Link>
                    </motion.div>
                </div>
            </motion.div>
        </section>
    );
};
