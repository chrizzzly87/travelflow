import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { DEFAULT_LOCALE } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath } from '../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

const PLAN_CTA_EVENT = 'not_found__cta--plan_yours';
const CONTACT_LINK_EVENT = 'not_found__link--contact';

export const NotFoundPage: React.FC = () => {
    const { t } = useTranslation('pages');
    const routeLocation = useLocation();
    const locale = extractLocaleFromPath(routeLocation.pathname) ?? DEFAULT_LOCALE;
    const createTripPath = buildPath('createTrip');
    const contactPath = buildLocalizedMarketingPath('contact', locale);

    useEffect(() => {
        trackEvent('not_found__view', {
            locale,
            path: `${routeLocation.pathname}${routeLocation.search}`,
        });
    }, [locale, routeLocation.pathname, routeLocation.search]);

    return (
        <MarketingLayout>
            <section className="flex min-h-[76vh] flex-col items-center justify-center py-8 md:py-12">
                <div className="flex select-none items-center justify-center gap-[clamp(0.35rem,1.6vw,1.4rem)]">
                    <span
                        className="pointer-events-none select-none text-[clamp(6.8rem,24vw,17rem)] font-black leading-[0.84] tracking-normal text-muted-foreground/95"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        4
                    </span>
                    {/* The "0" of 404, drawn as a porthole.
                      *
                      * This used to render PlaneWindowAnimation. That mattered
                      * beyond styling: on a direct load of a deferred route the
                      * 404 page renders before the route chunk resolves, and its
                      * subtree leaked into the resolved page — which is how a
                      * plane window ended up on /features and got baked into the
                      * prerendered HTML. A static element with no shared class
                      * names cannot leak anything recognisable, and the old
                      * component (with the broken scroll loop) is gone. */}
                    <div
                        aria-hidden="true"
                        className="relative w-[clamp(8.25rem,24vw,15.5rem)] shrink-0"
                        style={{ aspectRatio: '580 / 850' }}
                    >
                        <div className="absolute inset-[6%] overflow-hidden rounded-[46%/40%] bg-gradient-to-b from-sky-400 via-sky-200 to-white shadow-inner dark:from-sky-900 dark:via-sky-800 dark:to-slate-700">
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-white/70 blur-md dark:bg-white/10" />
                        </div>
                        <div className="absolute inset-0 rounded-[46%/40%] border-[6px] border-secondary shadow-lg dark:border-border dark:shadow-none" />
                    </div>
                    <span
                        className="pointer-events-none select-none text-[clamp(6.8rem,24vw,17rem)] font-black leading-[0.84] tracking-normal text-muted-foreground/95"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        4
                    </span>
                </div>

                <div className="mt-10 flex w-full max-w-3xl flex-col items-center text-center md:mt-14">
                    <h1
                        className="max-w-[18ch] text-balance text-2xl font-semibold leading-tight text-foreground md:text-5xl"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        {t('notFound.headline')}
                    </h1>

                    <Link
                        to={createTripPath}
                        onClick={() => trackEvent(PLAN_CTA_EVENT, { locale })}
                        className="mt-7 inline-flex items-center rounded-2xl bg-accent-600 px-7 py-3 text-base font-bold text-white shadow-lg shadow-accent-200 transition-[scale,background-color,box-shadow] duration-150 ease-out hover:scale-[1.02] hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 active:scale-[0.96] md:mt-8"
                        {...getAnalyticsDebugAttributes(PLAN_CTA_EVENT, { locale })}
                    >
                        {t('notFound.planCta')}
                    </Link>

                    <div className="mt-9 h-px w-24 bg-slate-300/80 md:mt-10" aria-hidden="true" />

                    <p className="mt-7 max-w-[44ch] text-pretty text-sm text-muted-foreground md:mt-8 md:text-base">
                        {t('notFound.missingPrompt')}{' '}
                        <Link
                            to={contactPath}
                            onClick={() => trackEvent(CONTACT_LINK_EVENT, { locale })}
                            className="font-semibold text-accent-700 underline decoration-accent-300 underline-offset-2 transition-colors hover:text-accent-800 dark:text-accent-200 dark:hover:text-accent-200"
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
