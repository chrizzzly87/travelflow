import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';

export const CtaBanner: React.FC = () => {
    const { t } = useTranslation(['home', 'common']);

    return (
        <section className="pb-16 md:pb-24 animate-scroll-scale-in">
            <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-[60px]" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent-400/20 blur-[50px]" />

                <h2 className="relative text-3xl font-black tracking-tight text-white md:text-5xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                    {t('home:cta.title')}
                </h2>
                <p className="relative mx-auto mt-4 max-w-xl text-base text-accent-100 md:text-lg">
                    {t('home:cta.subtitle')}
                </p>
                <Link
                    to={buildPath('createTrip')}
                    onClick={() =>
                        trackEvent('home__bottom_cta')
                    }
                    className="relative mt-8 inline-block rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:shadow-xl hover:bg-accent-50 hover:scale-[1.03] active:scale-[0.98]"
                    {...getAnalyticsDebugAttributes('home__bottom_cta')}
                >
                    {t('common:buttons.startPlanningFree')}
                </Link>
            </div>
        </section>
    );
};
