import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';

export const CtaBanner: React.FC = () => {
    const { t } = useTranslation(['home', 'common']);

    return (
        <section className="pb-16 md:pb-24 px-5 sm:px-8 w-full max-w-7xl mx-auto">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative rounded-[2rem] bg-slate-50 border border-slate-200 px-8 py-16 text-center md:px-16 md:py-24 overflow-hidden shadow-sm flex flex-col items-center"
            >
                {/* Minimal Abstract Pattern */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQPSI4Ij4KPHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0iIzAwMCI+PC9jaXJjbGU+Cjwvc3ZnPg==')]" />

                <div className="relative z-10 w-full max-w-2xl">
                    <h2 className="text-3xl font-extrabold tracking-tighter text-slate-900 md:text-5xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                        {t('home:cta.title')}
                    </h2>
                    
                    <p className="mx-auto mt-5 text-lg text-slate-500 font-medium tracking-tight">
                        {t('home:cta.subtitle')}
                    </p>
                    
                    <motion.div
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-10 inline-block"
                    >
                        <Link
                            to={buildPath('createTrip')}
                            onClick={() => trackEvent('home__bottom_cta')}
                            className="group relative inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-10 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg overflow-hidden"
                            {...getAnalyticsDebugAttributes('home__bottom_cta')}
                        >
                            <span className="relative z-10 block">{t('common:buttons.startPlanningFree')}</span>
                        </Link>
                    </motion.div>
                </div>
            </motion.div>
        </section>
    );
};
