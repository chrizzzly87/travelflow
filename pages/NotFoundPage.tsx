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
            <section className="flex min-h-[76vh] flex-col items-center justify-center py-8 md:py-12">
                <div className="flex select-none items-center justify-center gap-[clamp(0.35rem,1.6vw,1.4rem)]">
                    <span
                        className="pointer-events-none select-none text-[clamp(6.8rem,24vw,17rem)] font-black leading-[0.84] tracking-[-0.04em] text-slate-400/95"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        4
                    </span>
                    <div className="w-[clamp(8.25rem,24vw,15.5rem)] shrink-0">
                        <PlaneWindowAnimation />
                    </div>
                    <span
                        className="pointer-events-none select-none text-[clamp(6.8rem,24vw,17rem)] font-black leading-[0.84] tracking-[-0.04em] text-slate-400/95"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        4
                    </span>
                </div>

                <div className="mt-10 flex w-full max-w-3xl flex-col items-center text-center md:mt-14">
                    <h1
                        className="max-w-[18ch] text-2xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        {t('notFound.headline')}
                    </h1>

                    <Link
                        to={createTripPath}
                        onClick={() => trackEvent(PLAN_CTA_EVENT, { locale })}
                        className="mt-7 inline-flex items-center rounded-2xl bg-accent-600 px-7 py-3 text-base font-bold text-white shadow-lg shadow-accent-200 transition-all hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 hover:scale-[1.02] active:scale-[0.98] md:mt-8"
                        {...getAnalyticsDebugAttributes(PLAN_CTA_EVENT, { locale })}
                    >
                        {t('notFound.planCta')}
                    </Link>

                    <div className="mt-9 h-px w-24 bg-slate-300/80 md:mt-10" aria-hidden="true" />

                    <p className="mt-7 max-w-[44ch] text-sm text-slate-600 md:mt-8 md:text-base">
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
