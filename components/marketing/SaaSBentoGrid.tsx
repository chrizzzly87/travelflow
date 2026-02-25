import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ShareNetwork, ShieldCheck, DownloadSimple, LinkSimple } from '@phosphor-icons/react';

const bentoData = [
    {
        icon: ShareNetwork,
        title: "Real-time Collaboration",
        description: "Invite your entire group. Watch as edits happen instantly across all devices. No more outdated spreadsheets or messy group chats.",
        span: "md:col-span-2",
    },
    {
        icon: ShieldCheck,
        title: "Always in Sync",
        description: "Changes are persisted instantly to the cloud, ensuring your itinerary is safe and accessible offline when traveling.",
        span: "md:col-span-1",
    },
    {
        icon: DownloadSimple,
        title: "Seamless Exporting",
        description: "Need a hard copy? Export your entire timeline to beautiful, printer-friendly PDFs with a single click.",
        span: "md:col-span-1",
    },
    {
        icon: LinkSimple,
        title: "Smart Booking Links",
        description: "Every activity automatically maps to relevant booking partners, streamlining the transition from planning to actually booking.",
        span: "md:col-span-2",
    }
];

export const SaaSBentoGrid: React.FC = () => {
    return (
        <section className="relative w-full max-w-7xl mx-auto px-6 py-24 md:py-32">
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-2xl mb-16"
            >
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                    Powerful primitives for modern planning.
                </h2>
                <p className="text-lg text-slate-500 font-medium leading-relaxed tracking-tight">
                    Beyond AI generation, TravelFlow provides a suite of professional tools designed to keep massive itineraries organized, synced, and easily actionable.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(260px,auto)]">
                {bentoData.map((item, i) => {
                    const IconComp = item.icon;
                    return (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className={`group relative overflow-hidden rounded-[2rem] bg-slate-50 border border-slate-200 p-10 flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:border-slate-300 hover:bg-white cursor-pointer ${item.span || ''}`}
                        >
                            {/* Subtle premium gradient wash on hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 mix-blend-multiply" />
                            
                            <div className="relative z-10">
                                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-sm mb-8 transition-all duration-500 group-hover:scale-110 group-hover:shadow-md group-hover:border-slate-300">
                                    <IconComp size={24} weight="duotone" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight transition-colors duration-300">{item.title}</h3>
                                    <p className="text-slate-500 font-medium leading-relaxed">{item.description}</p>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
};
