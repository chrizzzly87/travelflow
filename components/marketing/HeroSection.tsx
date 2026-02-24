import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkle, ShareNetwork, LinkSimple, RocketLaunch, Play, ArrowRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform } from 'framer-motion';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';

export const HeroSection: React.FC = () => {
    const { t } = useTranslation('home');

    const handleCtaClick = (ctaName: string) => {
        trackEvent(`home__hero_cta--${ctaName}`);
    };

    const heroCtaDebugAttributes = (ctaName: string) =>
        getAnalyticsDebugAttributes(`home__hero_cta--${ctaName}`);

    const { scrollY } = useScroll();
    const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
    const y2 = useTransform(scrollY, [0, 1000], [0, -100]);
    const opacity = useTransform(scrollY, [0, 500], [1, 0]);

    return (
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-950 px-5 py-24 md:py-32 rounded-b-[3rem] shadow-2xl z-10">
            {/* Dynamic Animated Background Mesh */}
            <div className="absolute inset-0 z-0 opacity-40">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 2 }}
                    className="absolute -top-[20%] -right-[10%] w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-600/30 blur-[120px]" 
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 2.5, delay: 0.5 }}
                    className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr from-accent-500/30 to-cyan-400/30 blur-[100px]" 
                />
            </div>

            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CjxjaXJjbGUgY3g9IjEiIGN5PSIxIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+Cjwvc3ZnPg==')] z-0 [mask-image:linear-gradient(to_bottom,white,transparent)]" />

            {/* Glowing Orbs for parallax */}
            <motion.div style={{ y: y1 }} className="absolute top-1/4 left-1/4 w-4 h-4 rounded-full bg-accent-400 shadow-[0_0_30px_10px_rgba(56,189,248,0.5)] z-0" />
            <motion.div style={{ y: y2 }} className="absolute bottom-1/3 right-1/4 w-6 h-6 rounded-full bg-purple-500 shadow-[0_0_40px_15px_rgba(168,85,247,0.4)] z-0" />

            <motion.div style={{ opacity }} className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center text-center">
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 text-sm font-semibold tracking-wide text-accent-300 shadow-2xl mb-8">
                        <Sparkle size={16} weight="duotone" className="text-accent-400" />
                        {t('hero.badge')}
                    </span>
                </motion.div>

                <motion.h1 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                    className="text-5xl font-black tracking-tight text-white md:text-7xl lg:text-8xl max-w-5xl leading-[1.1]" 
                    style={{ fontFamily: 'var(--tf-font-heading)' }}
                >
                    {t('hero.titleBefore')} <br className="hidden md:block"/>
                    <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-accent-400 via-indigo-400 to-purple-400">
                        {t('hero.titleHighlight')}
                    </span>
                </motion.h1>

                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className="mt-8 max-w-2xl text-lg md:text-xl font-medium leading-relaxed text-slate-300"
                >
                    {t('hero.description')}
                </motion.p>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                    className="mt-12 flex flex-col sm:flex-row items-center gap-5"
                >
                    <Link
                        to={buildPath('createTrip')}
                        onClick={() => handleCtaClick('start_planning')}
                        className="group relative flex items-center justify-center gap-2 rounded-full bg-accent-500 px-8 py-4 text-lg font-bold text-white shadow-[0_0_40px_-10px_rgba(56,189,248,0.8)] transition-all hover:bg-accent-400 hover:shadow-[0_0_60px_-15px_rgba(56,189,248,1)] hover:scale-105 active:scale-95 overflow-hidden"
                        {...heroCtaDebugAttributes('start_planning')}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            {t('common:buttons.startPlanning')}
                            <ArrowRight size={20} weight="bold" className="transition-transform group-hover:translate-x-1" />
                        </span>
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
                    </Link>
                    
                    <a
                        href="#examples"
                        onClick={() => handleCtaClick('see_examples')}
                        className="group flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-8 py-4 backdrop-blur-md text-lg font-bold text-white transition-all hover:bg-white/10 hover:border-white/30 hover:scale-105 active:scale-95"
                        {...heroCtaDebugAttributes('see_examples')}
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 group-hover:bg-accent-400 group-hover:text-white transition-colors">
                            <Play size={14} weight="fill" />
                        </span>
                        {t('common:buttons.seeExampleTrips')}
                    </a>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="mt-16 flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-slate-400"
                >
                    <div className="flex items-center gap-2 transition-colors hover:text-white cursor-default">
                        <RocketLaunch size={18} className="text-accent-400" weight="duotone" />
                        {t('hero.floating.ai')}
                    </div>
                    <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-700" />
                    <div className="flex items-center gap-2 transition-colors hover:text-white cursor-default">
                        <ShareNetwork size={18} className="text-purple-400" weight="duotone" />
                        {t('hero.floating.share')}
                    </div>
                    <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-700" />
                    <div className="flex items-center gap-2 transition-colors hover:text-white cursor-default">
                        <LinkSimple size={18} className="text-emerald-400" weight="duotone" />
                        {t('hero.floating.booking')}
                    </div>
                </motion.div>
                
            </motion.div>
        </section>
    );
};
