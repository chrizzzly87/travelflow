import React, { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { ITrip, IViewSettings } from '../../types';
import { exampleTripCards } from '../../data/exampleTripCards';
import { buildExampleTemplateMapPreviewUrl, getExampleTemplateMiniCalendar, TRIP_FACTORIES } from '../../data/exampleTripTemplates';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ExampleTripCard } from './ExampleTripCard';

const ROTATIONS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.8];
const INSPIRATIONS_LINK = '/inspirations';
const VIEW_TRANSITION_DEBUG_EVENT = 'tf:view-transition-debug';

interface ViewTransitionDebugDetail {
    phase: string;
    templateId?: string;
    transitionKey?: string;
    targetPath?: string;
    durationMs?: number;
    reason?: string;
    error?: string;
}

const emitViewTransitionDebug = (detail: ViewTransitionDebugDetail): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<ViewTransitionDebugDetail>(VIEW_TRANSITION_DEBUG_EVENT, { detail }));
};

export const ExampleTripsCarousel: React.FC = () => {
    const navigate = useNavigate();
    const tripViewPrefetchRef = useRef<Promise<unknown> | null>(null);
    const doubledCards = [...exampleTripCards, ...exampleTripCards];

    const prewarmTripView = useCallback(() => {
        if (!tripViewPrefetchRef.current) {
            tripViewPrefetchRef.current = import('../TripView')
                .catch(() => {
                    tripViewPrefetchRef.current = null;
                    return null;
                });
        }
    }, []);

    useEffect(() => {
        prewarmTripView();
    }, [prewarmTripView]);

    const handleCardClick = useCallback((templateId: string, transitionKey: string) => {
        const factory = TRIP_FACTORIES[templateId];
        if (!factory) return;
        prewarmTripView();
        trackEvent('home__carousel_card', { template: templateId });

        const target = `/example/${encodeURIComponent(templateId)}`;
        const nowMs = Date.now();
        const generated = factory(new Date(nowMs).toISOString());
        const resolvedView: IViewSettings = {
            layoutMode: generated.defaultView?.layoutMode ?? 'horizontal',
            timelineView: generated.defaultView?.timelineView ?? 'horizontal',
            mapStyle: generated.defaultView?.mapStyle ?? 'standard',
            zoomLevel: generated.defaultView?.zoomLevel ?? 1,
            routeMode: generated.defaultView?.routeMode,
            showCityNames: generated.defaultView?.showCityNames,
            sidebarWidth: generated.defaultView?.sidebarWidth,
            timelineHeight: generated.defaultView?.timelineHeight,
        };
        const selectedCard = exampleTripCards.find((card) => (card.templateId || '') === templateId) || null;
        const templateCountries = selectedCard?.countries?.map((country) => country.name).filter(Boolean) || [];
        const preparedTrip: ITrip = {
            ...generated,
            createdAt: nowMs,
            updatedAt: nowMs,
            isFavorite: false,
            isExample: true,
            exampleTemplateId: templateId,
            exampleTemplateCountries: templateCountries,
            sourceKind: 'example',
            defaultView: resolvedView,
        };

        const navigation = () => navigate(target, {
            state: {
                useExampleSharedTransition: true,
                prefetchedExampleTrip: preparedTrip,
                prefetchedExampleView: resolvedView,
                prefetchedTemplateTitle: selectedCard?.title,
                prefetchedTemplateCountries: templateCountries,
            },
        });

        emitViewTransitionDebug({
            phase: 'card-click',
            templateId,
            transitionKey,
            targetPath: target,
        });

        emitViewTransitionDebug({
            phase: 'navigate-direct',
            templateId,
            transitionKey,
            targetPath: target,
        });
        navigation();
    }, [navigate, prewarmTripView]);

    return (
        <section id="examples" className="py-16 md:py-24 overflow-x-hidden md:overflow-x-visible">
            <div className="animate-scroll-blur-in">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    Trips built with TravelFlow
                </h2>
                <p className="mt-3 max-w-xl text-base text-slate-600">
                    Browse real itineraries created by our community — from week-long island getaways to cross-country road trips.
                </p>
            </div>

            <div className="relative mt-12 -mx-5 md:-mx-8 lg:mx-[calc(-50vw+50%)] overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 to-transparent md:w-24" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 to-transparent md:w-24" />

                <div className="group py-6 overflow-x-hidden md:overflow-visible">
                    <div
                        className="flex w-max gap-6 animate-marquee group-hover:[animation-play-state:paused]"
                        style={{ '--marquee-duration': '60s' } as React.CSSProperties}
                    >
                        {doubledCards.map((card, index) => {
                            const rotation = ROTATIONS[index % ROTATIONS.length];
                            const mapPreviewUrl = card.templateId
                                ? buildExampleTemplateMapPreviewUrl(card.templateId)
                                : null;
                            const miniCalendar = card.templateId
                                ? getExampleTemplateMiniCalendar(card.templateId)
                                : null;
                            const transitionKey = `${card.templateId || card.id}-${index}`;

                            return (
                                <button
                                    key={`${card.id}-${index}`}
                                    type="button"
                                    onClick={() => card.templateId && handleCardClick(card.templateId, transitionKey)}
                                    onMouseEnter={prewarmTripView}
                                    onFocus={prewarmTripView}
                                    onTouchStart={prewarmTripView}
                                    className="block w-[300px] md:w-[340px] flex-shrink-0 transform-gpu will-change-transform transition-transform duration-300 hover:!rotate-0 hover:scale-105 text-left cursor-pointer"
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                    {...(card.templateId
                                        ? getAnalyticsDebugAttributes('home__carousel_card', { template: card.templateId })
                                        : {})}
                                >
                                    <ExampleTripCard
                                        card={card}
                                        mapPreviewUrl={mapPreviewUrl}
                                        miniCalendar={miniCalendar}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-5">
                <Link
                    to={INSPIRATIONS_LINK}
                    onClick={() => trackEvent('home__carousel_cta--inspirations')}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-accent-600 transition-colors hover:text-accent-800"
                    {...getAnalyticsDebugAttributes('home__carousel_cta--inspirations')}
                >
                    Discover more inspirations
                    <ArrowRight size={14} weight="bold" />
                </Link>
            </div>
        </section>
    );
};
