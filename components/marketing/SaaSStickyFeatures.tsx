import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkle, SlidersHorizontal, MapTrifold, CaretRight } from '@phosphor-icons/react';

const stickyContent = [
    {
        id: 'feature-ai',
        icon: Sparkle,
        title: "Deterministic AI Generation.",
        description: "Skip the prompt engineering. Enter a destination and TravelFlow computes an optimized, minute-by-minute itinerary balancing pace, geography, and operating hours.",
    },
    {
        id: 'feature-drag',
        icon: SlidersHorizontal,
        title: "Fluid Timeline Architecture.",
        description: "Your itinerary is not a static document. Drag, drop, and resize events on a professional calendar interface. Our system auto-resolves constraints and travel times.",
    },
    {
        id: 'feature-map',
        icon: MapTrifold,
        title: "Contextual Geographic Intelligence.",
        description: "Every modification reflects instantly on an interactive, high-performance map. Visualize your daily routes and optimize geographical efficiency effortlessly.",
    }
];

export const SaaSStickyFeatures: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        const index = Number(entry.target.getAttribute('data-index'));
                        setActiveIndex(index);
                    }
                });
            },
            { rootMargin: '-30% 0px -30% 0px', threshold: 0.5 }
        );

        itemRefs.current.forEach((ref) => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, []);

    // Helper variants for the mockups
    const mockupVariants: import('framer-motion').Variants = {
        initial: { opacity: 0, scale: 0.95, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
        exit: { opacity: 0, scale: 1.05, y: -20, transition: { duration: 0.4, ease: "easeInOut" } }
    };

    return (
        <section className="relative w-full bg-white py-24 md:py-32" ref={containerRef}>
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 relative items-start">
                
                {/* Left Side: Scrolling Text */}
                <div className="flex flex-col gap-[40vh] py-[10vh] md:py-[30vh]">
                    {stickyContent.map((item, index) => {
                        const isActive = index === activeIndex;
                        return (
                            <div 
                                key={item.id} 
                                ref={(el) => { itemRefs.current[index] = el; }}
                                data-index={index}
                                className={`transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-30'}`}
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 border border-slate-200">
                                            <item.icon size={20} weight="duotone" className="text-slate-900" />
                                        </div>
                                        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">0{index + 1}</span>
                                    </div>
                                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                                        {item.title}
                                    </h2>
                                    <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed tracking-tight">
                                        {item.description}
                                    </p>
                                </motion.div>
                            </div>
                        );
                    })}
                </div>

                {/* Right Side: Sticky Visuals */}
                <div className="hidden md:block sticky top-[20vh] h-[60vh] rounded-[2rem] bg-slate-50 border border-slate-200 shadow-sm overflow-hidden p-8 flex flex-col items-center justify-center">
                    <div className="relative w-full h-full">
                        <AnimatePresence mode="wait">
                            
                            {/* Visual 0: AI Generation Mockup */}
                            {activeIndex === 0 && (
                                <motion.div key="mockup-0" variants={mockupVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-full max-h-[400px] rounded-2xl bg-white border border-slate-200 shadow-md flex flex-col overflow-hidden">
                                        <div className="h-14 bg-slate-50 border-b border-slate-100 flex items-center px-5 gap-3 shrink-0">
                                            <Sparkle size={20} className="text-slate-700" weight="fill" />
                                            <div className="text-sm font-semibold text-slate-900">AI Assistant</div>
                                        </div>
                                        {/* A custom noisy/dot pattern background */}
                                        <div className="flex-1 p-6 flex flex-col gap-6 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQPSI0Ij4KPHJlY3Qgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2ZmZiIvPgo8Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0iI2YxZjVmOSIvPgo8L3N2Zz4=')] overflow-y-auto custom-scrollbar">
                                            <div className="self-end bg-slate-900 text-white px-5 py-3 rounded-2xl rounded-tr-sm text-sm shadow-sm max-w-[85%] border border-slate-800 shrink-0">
                                                Plan a 3-day trip to Kyoto focusing on historic temples and local food.
                                            </div>
                                            <div className="self-start bg-white text-slate-700 px-5 py-4 rounded-2xl rounded-tl-sm text-sm shadow-sm border border-slate-200 max-w-[95%] shrink-0">
                                                <div className="font-semibold text-slate-900 mb-4">I can help with that! Generating your optimized itinerary:</div>
                                                <div className="space-y-4">
                                                    
                                                    {/* Fake streaming Day 1 */}
                                                    <div className="space-y-2">
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Day 1: Classic Eastern Kyoto</div>
                                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                                                <span className="text-sm font-bold text-slate-900">Kiyomizu-dera Temple</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1 pl-4">09:00 AM • Explore the wooden stage.</div>
                                                        </div>
                                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse delay-75" />
                                                                <span className="text-sm font-bold text-slate-900">Nishiki Market Lunch</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1 pl-4">12:30 PM • Kyoto's legendary food street.</div>
                                                        </div>
                                                    </div>

                                                    {/* Fake streaming loader for next day */}
                                                    <div className="flex items-center gap-2 pt-2">
                                                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        <span className="text-xs text-slate-400 ml-1 font-medium italic">Drafting Day 2 (Arashiyama)...</span>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Visual 1: Drag & Drop Mockup */}
                            {activeIndex === 1 && (
                                <motion.div key="mockup-1" variants={mockupVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-full max-h-[400px] rounded-2xl bg-white border border-slate-200 shadow-md p-6 flex gap-4 overflow-hidden">
                                        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col gap-3">
                                            <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1">DAY 1: HIGASHIYAMA</div>
                                            
                                            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 flex flex-col gap-1">
                                                <div className="text-xs font-bold text-slate-900">Kiyomizu-dera</div>
                                                <div className="text-[10px] font-medium text-slate-500">09:00 AM - 11:30 AM</div>
                                            </div>
                                            
                                            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-slate-800 flex flex-col gap-1">
                                                <div className="text-xs font-bold text-slate-900">Sannenzaka Walk</div>
                                                <div className="text-[10px] font-medium text-slate-500">11:30 AM - 12:30 PM</div>
                                            </div>

                                            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-amber-500 flex flex-col gap-1 opacity-60">
                                                <div className="text-xs font-bold text-slate-900">Gion Corner</div>
                                                <div className="text-[10px] font-medium text-slate-500">06:00 PM - 08:30 PM</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col gap-3 relative">
                                            <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1">DAY 2: ARASHIYAMA</div>
                                            
                                            {/* Actively dragged item */}
                                            <motion.div 
                                                animate={{ y: [0, 8, 0], scale: [1, 1.05, 1], rotate: [0, 2, 0] }} 
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 w-[110%] bg-white p-3 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-rose-200 border-l-4 border-l-rose-500 z-10 cursor-grabbing flex flex-col gap-1"
                                            >
                                                <div className="text-xs font-bold text-slate-900">Nishiki Market</div>
                                                <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                                                    <span className="text-rose-500">⚠ Travel time conflict</span>
                                                </div>
                                            </motion.div>
                                            
                                            {/* Placeholder drop zone */}
                                            <div className="mt-[4.5rem] border-2 border-dashed border-indigo-300 rounded-lg h-[4.5rem] bg-indigo-50/50 flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-indigo-400">Drop to reschedule</span>
                                            </div>

                                            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-indigo-500 flex flex-col gap-1 mt-3">
                                                <div className="text-xs font-bold text-slate-900">Bamboo Grove</div>
                                                <div className="text-[10px] font-medium text-slate-500">03:00 PM - 05:00 PM</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Visual 2: Map Mockup */}
                            {activeIndex === 2 && (
                                <motion.div key="mockup-2" variants={mockupVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-full max-h-[400px] rounded-2xl bg-slate-100 border border-slate-200 shadow-md flex relative overflow-hidden">
                                        {/* Stylized map background */}
                                        <div className="absolute inset-0 bg-[#f8fafc] opacity-100">
                                            {/* Roads */}
                                            <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 400 400" preserveAspectRatio="none">
                                                <path d="M -50 200 Q 150 150 200 450" fill="none" stroke="#cbd5e1" strokeWidth="8" />
                                                <path d="M 100 -50 Q 150 250 450 300" fill="none" stroke="#cbd5e1" strokeWidth="12" />
                                                <path d="M 0 300 Q 200 350 400 200" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                                            </svg>
                                        </div>
                                        
                                        {/* Route path */}
                                        <svg className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="none">
                                            <path d="M 90 200 C 150 150, 200 280, 280 150" fill="none" stroke="#4f46e5" strokeWidth="4" strokeDasharray="8 8" className="animate-[dash_20s_linear_infinite]" />
                                        </svg>
                                        
                                        {/* Markers */}
                                        <div className="absolute top-[185px] left-[70px] z-20 w-8 h-8 bg-white rounded-full shadow-md border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-900 shrink-0">1</div>
                                        <div className="absolute top-[240px] left-[180px] z-20 w-8 h-8 bg-white rounded-full shadow-md border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-900 shrink-0">2</div>
                                        <div className="absolute top-[135px] left-[265px] z-20 w-9 h-9 bg-slate-900 rounded-full shadow-lg border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-white scale-110 shrink-0">3</div>
                                        
                                        {/* Floating Context Card */}
                                        <div className="absolute bottom-5 left-5 right-5 z-30 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">Kinkaku-ji (Golden Pavilion)</div>
                                                <div className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> 
                                                    Optimal routing • 12 mins transit
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm shrink-0">
                                                <CaretRight size={18} weight="bold" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            
                        </AnimatePresence>
                    </div>
                </div>

            </div>
        </section>
    );
};
