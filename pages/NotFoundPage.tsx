import React, { useEffect } from 'react';
import { Link, useLocation } from '@/app/navigation';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { DEFAULT_LOCALE } from '../config/locales';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath } from '../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildImageCdnUrl } from '../utils/imageDelivery';

const PLAN_CTA_EVENT = 'not_found__cta--plan_yours';
const CONTACT_LINK_EVENT = 'not_found__link--contact';

// Same frame artwork as the hero PlaneWindow, sized for the 404 porthole.
const NOT_FOUND_WINDOW_SRC = '/images/plane-window.png';
const NOT_FOUND_WINDOW_IMAGE_WIDTH = 640;
const NOT_FOUND_WINDOW_IMAGE_HEIGHT = 938;
const notFoundWindowSrc = buildImageCdnUrl(NOT_FOUND_WINDOW_SRC, {
    width: NOT_FOUND_WINDOW_IMAGE_WIDTH,
    format: 'webp',
    quality: 68,
});

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
                    {/* The "0" of 404: the hero's window frame and glass over a
                      * sky with drifting CSS clouds.
                      *
                      * Deliberately not the hero PlaneWindow component. On a
                      * direct load of a deferred route the 404 page once rendered
                      * before the route chunk resolved and its subtree leaked into
                      * the resolved page, so this stays a static element with its
                      * own class names: no WebGL scene, no shade, no theme grip. */}
                    <div
                        aria-hidden="true"
                        className="not-found-window relative w-[clamp(8.25rem,24vw,15.5rem)] shrink-0 select-none"
                        style={{ aspectRatio: '580 / 850' }}
                    >
                        <div className="not-found-window-sky absolute overflow-hidden">
                            <div className="not-found-window-clouds absolute inset-0" />
                        </div>
                        <img
                            src={notFoundWindowSrc}
                            alt=""
                            width={NOT_FOUND_WINDOW_IMAGE_WIDTH}
                            height={NOT_FOUND_WINDOW_IMAGE_HEIGHT}
                            draggable={false}
                            decoding="async"
                            onError={(event) => {
                                // Fall back to the original asset if the image CDN fails.
                                if (!event.currentTarget.src.endsWith(NOT_FOUND_WINDOW_SRC)) {
                                    event.currentTarget.src = NOT_FOUND_WINDOW_SRC;
                                }
                            }}
                            className="not-found-window-frame relative z-10 size-full object-contain drop-shadow-xl"
                        />
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
