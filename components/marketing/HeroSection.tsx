import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkle, ArrowRight, Play } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform } from 'framer-motion';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';

export const HeroSection: React.FC = () => {
    const { t } = useTranslation(['home', 'common']);

    const handleCtaClick = (ctaName: string) => {
        trackEvent(`home__hero_cta--${ctaName}`);
    };

    const heroCtaDebugAttributes = (ctaName: string) =>
        getAnalyticsDebugAttributes(`home__hero_cta--${ctaName}`);

    const { scrollY } = useScroll();
    
    // Sophisticated, smooth parallax
    const y1 = useTransform(scrollY, [0, 1000], [0, 150]);
    const y2 = useTransform(scrollY, [0, 1000], [0, -80]);
    const opacityFade = useTransform(scrollY, [0, 400], [1, 0]);

    return (
        <section className="relative min-h-[85vh] flex flex-col items-center justify-center overflow-hidden bg-white px-5 py-24 md:py-32 rounded-b-[2.5rem] md:rounded-b-[3.5rem] border-b border-slate-100 z-10 w-full">
            {/* Extremely Subtle Abstract Grid Background */}
            <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDIiIGhlaWdodD0iNDAyIj48cGF0aCBkPSJNMCAwSDQwMlY0MDJIMHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCAwSDRWMHY0SDB6bTM5OCAzOThoNHY0aC00em0wLTM5OGg0djRoLTR6TTkgM2gzODRWNWgtMzg0eloiIGZpbGw9IiNlN2U1ZTQiLz48cGF0aCBkPSJNOSAzOTloMzhZNDAxaC0zODR6bTAtMzk2aDNWODNINXpnLTMgMTE1SDZWODdoM3ptMCAxMTRINlYyMDFoM3ptMCAxMTVINlYzMTVzOHAiIGZpbGw9IiNlN2U1ZTQiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

            {/* Faint Radial Gradients */}
            <div className="absolute inset-0 z-0 opacity-[0.15] pointer-events-none">
                <motion.div 
                    style={{ y: y1 }}
                    className="absolute -top-[10%] -right-[5%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-bl from-slate-300 to-transparent blur-[80px]" 
                />
                <motion.div 
                    style={{ y: y2 }}
                    className="absolute top-[20%] -left-[10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-tr from-slate-200 to-transparent blur-[60px]" 
                />
            </div>

            <motion.div style={{ opacity: opacityFade }} className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center">
                
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/50 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold tracking-wide text-slate-600 shadow-sm mb-8">
                        <Sparkle size={14} weight="duotone" className="text-slate-400" />
                        {t('home:hero.badge')}
                    </span>
                </motion.div>

                {/* Extremely crisp typography tracking */}
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-5xl font-extrabold tracking-tighter text-slate-900 md:text-7xl lg:text-[5.5rem] max-w-4xl leading-[1.05]" 
                    style={{ fontFamily: 'var(--tf-font-heading)' }}
                >
                    {t('home:hero.titleBefore')} <br className="hidden md:block"/>
                    <span className="text-slate-500">
                        {t('home:hero.titleHighlight')}
                    </span>
                </motion.h1>

                <motion.p 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-6 max-w-2xl text-lg md:text-xl font-medium leading-relaxed text-slate-600 tracking-tight"
                >
                    {t('home:hero.description')}
                </motion.p>

                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-10 flex flex-col sm:flex-row items-center gap-4"
                >
                    <Link
                        to={buildPath('createTrip')}
                        onClick={() => handleCtaClick('start_planning')}
                        className="group relative flex h-12 items-center justify-center gap-2 rounded-full bg-slate-900 px-8 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5"
                        {...heroCtaDebugAttributes('start_planning')}
                    >
                        <span>{t('common:buttons.startPlanning')}</span>
                        <ArrowRight size={16} weight="bold" className="transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                    
                    <a
                        href="#examples"
                        onClick={() => handleCtaClick('see_examples')}
                        className="group flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5"
                        {...heroCtaDebugAttributes('see_examples')}
                    >
                        <Play size={14} weight="fill" className="text-slate-400 transition-colors group-hover:text-slate-600" />
                        {t('common:buttons.seeExampleTrips')}
                    </a>
                </motion.div>
                
            </motion.div>
        </section>
    );
};
