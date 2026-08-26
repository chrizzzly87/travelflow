import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildPath } from '../../config/routes';

export const CtaBanner: React.FC = () => {
    const { t } = useTranslation(['home', 'common']);

    return (
        <section className="border-t border-slate-200 py-20 md:py-28 lazy-cta-banner">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-8">
                <h2 className="max-w-[18ch] text-balance text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                    {t('home:cta.title')}
                </h2>
                <p className="mt-4 max-w-[64ch] text-pretty text-base leading-7 text-slate-600 md:text-lg">
                    {t('home:cta.subtitle')}
                </p>
                </div>
                <div className="lg:col-span-4 lg:text-right">
                <Link
                    to={buildPath('createTrip')}
                    onClick={() =>
                        trackEvent('home__bottom_cta')
                    }
                    className="inline-flex min-h-12 items-center rounded-md bg-slate-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-black"
                    {...getAnalyticsDebugAttributes('home__bottom_cta')}
                >
                    {t('common:buttons.startPlanningFree')}
                </Link>
                </div>
            </div>
        </section>
    );
};
