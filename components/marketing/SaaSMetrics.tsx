import React from 'react';
import { motion } from 'framer-motion';

const metrics = [
    { value: "10x", label: "Faster Planning" },
    { value: "2M+", label: "Activities Indexed" },
    { value: "50k", label: "Optimized Routes" },
    { value: "99%", label: "Stress Reduction" },
];

export const SaaSMetrics: React.FC = () => {
    return (
        <section className="py-24 bg-white border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
                    {metrics.map((metric, i) => (
                        <motion.div 
                            key={metric.label}
                            initial={{ opacity: 0, y: 20 }} 
                            whileInView={{ opacity: 1, y: 0 }} 
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="text-center flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm"
                        >
                            <div className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tighter mb-2" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                                {metric.value}
                            </div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest text-balance">
                                {metric.label}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};
