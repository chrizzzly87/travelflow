import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';

export const CtaBanner: React.FC = () => {
    const { t } = useTranslation(['home', 'common']);

    return (
        <section className="pb-16 md:pb-24 animate-scroll-scale-in lazy-cta-banner">
            <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                <h2 className="relative text-balance text-3xl font-semibold text-white md:text-5xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                    {t('home:cta.title')}
                </h2>
                <p className="relative mx-auto mt-4 max-w-xl text-pretty text-base text-accent-100 md:text-lg">
                    {t('home:cta.subtitle')}
                </p>
                <Link
                    to={buildPath('createTrip')}
                    onClick={() =>
                        trackEvent('home__bottom_cta')
                    }
                    className="relative mt-8 inline-block rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-[scale,background-color,box-shadow] duration-150 ease-out hover:scale-[1.03] hover:bg-accent-50 hover:shadow-xl active:scale-[0.96]"
                    {...getAnalyticsDebugAttributes('home__bottom_cta')}
                >
                    {t('common:buttons.startPlanningFree')}
                </Link>
            </div>
        </section>
    );
};
