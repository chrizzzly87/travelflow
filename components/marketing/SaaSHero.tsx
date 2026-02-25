import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkle, ArrowRight, MapPin } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { buildPath } from '../../config/routes';
import { trackEvent, getAnalyticsDebugAttributes } from '../../services/analyticsService';
import { SaaSGlobe } from './SaaSGlobe';

export const SaaSHero: React.FC = () => {
    const { scrollY } = useScroll();
    
    // Abstract Parallax Values
    const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
    const y2 = useTransform(scrollY, [0, 1000], [0, -150]);
    const rotate1 = useTransform(scrollY, [0, 1000], [0, 15]);
    const rotate2 = useTransform(scrollY, [0, 1000], [0, -10]);
    const opacityFade = useTransform(scrollY, [0, 400], [1, 0.2]);

    const handleCtaClick = () => {
        trackEvent('home__hero_cta--start_planning');
    };

    return (
        <section className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden bg-white border-b border-slate-100 pb-16 pt-10">
            {/* The spinning 3D Globe adds serious "pop", anchored to the container */}
            <SaaSGlobe />

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-12 lg:gap-8 items-center h-full mt-10 lg:mt-0">
                
                {/* Left Column: Typography Block */}
                <motion.div style={{ opacity: opacityFade }} className="flex flex-col items-start text-left pt-20 lg:pt-0">
                    
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 backdrop-blur-md px-4 py-1.5 text-xs uppercase tracking-[0.15em] font-semibold text-slate-600 shadow-sm mb-6 mt-12 lg:mt-0">
                            <Sparkle size={14} weight="fill" className="text-slate-900" />
                            The new standard for travel planning
                        </span>
                    </motion.div>

                    {/* Left-Aligned SaaS typography */}
                    <motion.h1 
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className="text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold tracking-[-0.04em] text-slate-900 leading-[1.05]"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        Plan trips at the <span className="text-slate-400 text-4xl sm:text-5xl md:text-[4.5rem]">speed of thought.</span>
                    </motion.h1>

                    <motion.p 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-500 tracking-tight"
                    >
                        The intelligent itinerary architect that turns chaotic travel planning into a seamless, visual, and highly collaborative experience.
                    </motion.p>

                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-10 flex items-center justify-start w-full"
                    >
                        <Link
                            to={buildPath('createTrip')}
                            onClick={handleCtaClick}
                            className="group relative flex h-14 items-center justify-center gap-3 rounded-full bg-slate-900 px-8 text-base font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-xl"
                            {...getAnalyticsDebugAttributes('home__hero_cta--start_planning')}
                        >
                            <span>Start building for free</span>
                            <ArrowRight size={18} weight="bold" className="transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                    </motion.div>
                </motion.div>

                {/* Right Column: Clustered Mockups */}
                <div className="hidden lg:block relative h-[600px] w-full pointer-events-none perspective-1000">
                    
                    {/* Floating Destination Micro-Animations */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.5, delay: 0.8 }}
                        className="absolute -top-4 right-12 z-30"
                    >
                        <motion.div 
                            animate={{ y: [-10, 10, -10], rotate: [-2, 2, -2] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
                        >
                            <span className="text-2xl drop-shadow-sm">🌸</span>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800 leading-tight">Kyoto</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Japan</span>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Back Mockup (Itinerary) - Slightly Right & Tilted */}
                    <motion.div 
                        style={{ y: y1, rotate: rotate1 }}
                        className="absolute top-10 right-0 w-[380px] bg-white border border-slate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col opacity-95 rounded-2xl z-10"
                    >
                        <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-300" />
                            <div className="w-3 h-3 rounded-full bg-slate-300" />
                            <div className="w-3 h-3 rounded-full bg-slate-300" />
                            <span className="ml-4 text-xs font-semibold text-slate-500">Day 1: Classic Kyoto</span>
                        </div>
                        <div className="p-6 flex flex-col gap-6">
                            <div className="space-y-4">
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-500 text-lg shadow-sm">📍</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="text-sm font-bold text-slate-900">Fushimi Inari Taisha</div>
                                        <div className="text-xs text-slate-500 font-medium overflow-hidden whitespace-nowrap text-ellipsis max-w-[220px]">Iconic shrine with 10,000 torii gates.</div>
                                        <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider mt-1">08:00 AM • 2.5 Hrs</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-500 text-lg shadow-sm">🏛️</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="text-sm font-bold text-slate-900">Kiyomizu-dera Temple</div>
                                        <div className="text-xs text-slate-500 font-medium overflow-hidden whitespace-nowrap text-ellipsis max-w-[220px]">Historic wooden temple with city views.</div>
                                        <div className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">11:00 AM • 1.5 Hrs</div>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-amber-500 text-lg shadow-sm">🍝</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="text-sm font-bold text-slate-900">Nishiki Market Lunch</div>
                                        <div className="text-xs text-slate-500 font-medium overflow-hidden whitespace-nowrap text-ellipsis max-w-[220px]">Kyoto's Kitchen - sample local street food.</div>
                                        <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-1">01:00 PM • 1 Hrs</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Front Mockup (AI Assistant) - Slightly Left & Overlapping */}
                    <motion.div 
                        style={{ y: y2, rotate: rotate2 }}
                        className="absolute bottom-20 left-4 w-[340px] rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)] p-5 flex flex-col gap-4 z-20"
                    >
                        <div className="flex flex-col gap-2 absolute -top-4 -left-4">
                            <motion.div 
                                animate={{ y: [15, -15, 15], rotate: [2, -2, 2] }}
                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
                            >
                                <span className="text-lg drop-shadow-sm">🥐</span>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800 leading-tight">Paris</span>
                                </div>
                            </motion.div>
                        </div>

                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mt-4">
                            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-md">
                                <Sparkle weight="fill" size={18} />
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-sm font-bold text-slate-900">TravelFlow AI</div>
                                <div className="text-xs text-emerald-500 font-medium">Online</div>
                            </div>
                        </div>
                        <div className="self-end bg-indigo-50 text-indigo-900 border border-indigo-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-xs shadow-sm max-w-[90%] font-medium">
                            Can you add a good sushi omakase dinner to day 2 in Shibuya?
                        </div>
                        <div className="self-start bg-white text-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm text-xs shadow-sm border border-slate-200 max-w-[95%] font-medium leading-relaxed">
                            Absolutely! I've added <span className="font-bold text-slate-900">Sushi Kyubey</span> to your evening. It fits perfectly between your Yoyogi Park walk and the Shibuya crossing.
                        </div>
                        <div className="self-end bg-slate-900 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-xs shadow-sm max-w-[80%] font-medium mt-1">
                            Optimize my route!
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
};
