import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { PlaneWindowAnimation } from '../components/marketing/PlaneWindowAnimation';
import { DEFAULT_LOCALE } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath } from '../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

const PLAN_CTA_EVENT = 'not_found__cta--plan_yours';
const CONTACT_LINK_EVENT = 'not_found__link--contact';

export const NotFoundPage: React.FC = () => {
    const { t } = useTranslation('pages');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const createTripPath = buildPath('createTrip');
    const contactPath = buildLocalizedMarketingPath('contact', locale);

    useEffect(() => {
        trackEvent('not_found__view', {
            locale,
            path: `${location.pathname}${location.search}`,
        });
    }, [locale, location.pathname, location.search]);

    return (
        <MarketingLayout>
            <section className="flex min-h-[72vh] flex-col items-center justify-center py-4 md:py-8">
                <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-8">
                    <span
                        className="text-[clamp(4.5rem,19vw,13rem)] font-black leading-none text-slate-900"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        4
                    </span>
                    <div className="w-[clamp(5.25rem,18vw,11rem)] shrink-0">
                        <PlaneWindowAnimation />
                    </div>
                    <span
                        className="text-[clamp(4.5rem,19vw,13rem)] font-black leading-none text-slate-900"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        4
                    </span>
                </div>

                <div className="mt-8 max-w-2xl text-center md:mt-10">
                    <h1
                        className="text-2xl font-black tracking-tight text-slate-900 md:text-4xl"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        {t('notFound.headline')}
                    </h1>

                    <Link
                        to={createTripPath}
                        onClick={() => trackEvent(PLAN_CTA_EVENT, { locale })}
                        className="mt-6 inline-flex items-center rounded-2xl bg-accent-600 px-7 py-3 text-base font-bold text-white shadow-lg shadow-accent-200 transition-all hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 hover:scale-[1.02] active:scale-[0.98]"
                        {...getAnalyticsDebugAttributes(PLAN_CTA_EVENT, { locale })}
                    >
                        {t('notFound.planCta')}
                    </Link>

                    <p className="mt-10 text-sm text-slate-600 md:text-base">
                        {t('notFound.missingPrompt')}{' '}
                        <Link
                            to={contactPath}
                            onClick={() => trackEvent(CONTACT_LINK_EVENT, { locale })}
                            className="font-semibold text-accent-700 underline decoration-accent-300 underline-offset-2 transition-colors hover:text-accent-800"
                            {...getAnalyticsDebugAttributes(CONTACT_LINK_EVENT, { locale })}
                        >
                            {t('notFound.contactCta')}
                        </Link>
                    </p>
                </div>
            </section>
        </MarketingLayout>
    );
};
