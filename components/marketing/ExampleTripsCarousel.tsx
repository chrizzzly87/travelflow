import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { ITrip, IViewSettings } from '../../types';
import { exampleTripCards } from '../../data/exampleTripCards';
import { getExampleTemplateMiniCalendar, TRIP_FACTORIES } from '../../data/exampleTripTemplates';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ExampleTripCard } from './ExampleTripCard';

const INSPIRATIONS_LINK = '/inspirations';
const VIEW_TRANSITION_DEBUG_EVENT = 'tf:view-transition-debug';
const DESKTOP_AUTO_SCROLL_PX_PER_SECOND = 52;
const DRAG_CLICK_THRESHOLD_PX = 8;
const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DESKTOP_RIGHT_SCALE_START = 0.82;
const DESKTOP_RIGHT_SCALE_MIN = 0.94;
const MOBILE_CARD_WIDTH_PX = 300;
const MOBILE_LOOP_NORMALIZE_IDLE_MS = 90;
const SUPPORTS_SCROLLEND = typeof window !== 'undefined' && 'onscrollend' in window;

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

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

const normalizeLoopOffset = (offset: number, loopWidth: number): number => {
    if (loopWidth <= 0) return 0;
    return ((offset % loopWidth) + loopWidth) % loopWidth;
};

export const ExampleTripsCarousel: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('home');
    const tripViewPrefetchRef = useRef<Promise<unknown> | null>(null);
    const [isMobileViewport, setIsMobileViewport] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false
    ));

    const containerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const motionCardRefs = useRef<Array<HTMLDivElement | null>>([]);
    const mobileScrollerRef = useRef<HTMLDivElement | null>(null);

    const loopWidthRef = useRef(0);
    const cardStrideRef = useRef(364);
    const cardWidthRef = useRef(340);
    const viewportWidthRef = useRef(0);
    const offsetRef = useRef(0);

    const isHoveredRef = useRef(false);
    const isMobileViewportRef = useRef(isMobileViewport);
    const prefersReducedMotionRef = useRef(false);

    const mobilePointerXRef = useRef<number | null>(null);
    const mobileDragDistanceRef = useRef(0);
    const suppressClickUntilRef = useRef(0);
    const mobileSetWidthRef = useRef(0);
    const mobileRecenteringRef = useRef(false);
    const mobileRecenteringRafRef = useRef<number | null>(null);
    const mobileNormalizeTimeoutRef = useRef<number | null>(null);
    const mobilePointerActiveRef = useRef(false);

    const doubledCards = useMemo(() => [...exampleTripCards, ...exampleTripCards], []);
    const mobileLoopCards = useMemo(() => [...exampleTripCards, ...exampleTripCards, ...exampleTripCards], []);

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

    const applyDesktopTransforms = useCallback(() => {
        const track = trackRef.current;
        if (!track || isMobileViewportRef.current) return;

        const loopWidth = loopWidthRef.current;
        if (loopWidth <= 0) return;

        const normalizedOffset = normalizeLoopOffset(offsetRef.current, loopWidth);
        offsetRef.current = normalizedOffset;
        track.style.transform = `translate3d(${-normalizedOffset}px, 0, 0)`;

        const viewportWidth = Math.max(1, viewportWidthRef.current);
        const cardStride = cardStrideRef.current;
        const cardWidth = cardWidthRef.current;

        motionCardRefs.current.forEach((cardNode, index) => {
            if (!cardNode) return;

            const baseX = (index * cardStride) - normalizedOffset;
            const wrappedX = ((baseX % loopWidth) + loopWidth) % loopWidth;
            const displayX = wrappedX > viewportWidth + cardStride ? wrappedX - loopWidth : wrappedX;
            const centerX = displayX + (cardWidth / 2);
            const progress = clamp(centerX / viewportWidth, 0, 1);
            const rightRamp = clamp((progress - DESKTOP_RIGHT_SCALE_START) / (1 - DESKTOP_RIGHT_SCALE_START), 0, 1);
            const scale = 1 - (rightRamp * (1 - DESKTOP_RIGHT_SCALE_MIN));

            cardNode.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(3)})`;
            cardNode.style.zIndex = '1';
        });
    }, []);

    const measureDesktopTrack = useCallback(() => {
        const track = trackRef.current;
        const container = containerRef.current;
        if (!track || !container) return;

        const firstCard = motionCardRefs.current[0];
        const computedStyle = window.getComputedStyle(track);
        const gapPx = Number.parseFloat(computedStyle.columnGap || computedStyle.gap || '24') || 24;

        if (firstCard) {
            cardWidthRef.current = firstCard.offsetWidth;
            cardStrideRef.current = firstCard.offsetWidth + gapPx;
            loopWidthRef.current = cardStrideRef.current * exampleTripCards.length;
        } else {
            loopWidthRef.current = track.scrollWidth / 2;
        }

        viewportWidthRef.current = container.clientWidth;
        offsetRef.current = normalizeLoopOffset(offsetRef.current, loopWidthRef.current);
        applyDesktopTransforms();
    }, [applyDesktopTransforms]);

    const measureMobileSetWidth = useCallback(() => {
        const scroller = mobileScrollerRef.current;
        if (!scroller || !isMobileViewportRef.current) return;
        const measuredSetWidth = scroller.scrollWidth / 3;
        if (Number.isFinite(measuredSetWidth) && measuredSetWidth > 0) {
            mobileSetWidthRef.current = measuredSetWidth;
        }
    }, []);

    const normalizeMobileLoopPosition = useCallback((mode: 'initial' | 'preserve' = 'preserve') => {
        const scroller = mobileScrollerRef.current;
        if (!scroller || !isMobileViewportRef.current) return;
        if (mobileRecenteringRef.current) return;
        if (mode === 'preserve' && mobilePointerActiveRef.current) return;

        measureMobileSetWidth();
        const setWidth = mobileSetWidthRef.current;
        if (!Number.isFinite(setWidth) || setWidth <= 0) return;

        const centerOffset = (scroller.clientWidth - MOBILE_CARD_WIDTH_PX) / 2;
        const centeredPosition = scroller.scrollLeft + centerOffset;
        let targetScrollLeft = scroller.scrollLeft;

        if (mode === 'initial') {
            targetScrollLeft = setWidth - centerOffset;
        } else {
            const isOutsideCenterSet = centeredPosition < setWidth || centeredPosition >= setWidth * 2;
            if (!isOutsideCenterSet) return;
            const centeredRemainder = ((centeredPosition % setWidth) + setWidth) % setWidth;
            targetScrollLeft = (setWidth + centeredRemainder) - centerOffset;
        }

        if (Math.abs(targetScrollLeft - scroller.scrollLeft) <= 0.5) return;

        mobileRecenteringRef.current = true;
        const previousInlineSnapType = scroller.style.scrollSnapType;
        scroller.style.scrollSnapType = 'none';
        scroller.scrollLeft = targetScrollLeft;
        if (mobileRecenteringRafRef.current !== null) {
            window.cancelAnimationFrame(mobileRecenteringRafRef.current);
        }
        mobileRecenteringRafRef.current = window.requestAnimationFrame(() => {
            scroller.style.scrollSnapType = previousInlineSnapType;
            mobileRecenteringRef.current = false;
            mobileRecenteringRafRef.current = null;
        });
    }, [measureMobileSetWidth]);

    const scheduleMobileLoopNormalization = useCallback((delayMs = MOBILE_LOOP_NORMALIZE_IDLE_MS) => {
        if (!isMobileViewportRef.current) return;
        if (mobileNormalizeTimeoutRef.current !== null) {
            window.clearTimeout(mobileNormalizeTimeoutRef.current);
        }
        mobileNormalizeTimeoutRef.current = window.setTimeout(() => {
            mobileNormalizeTimeoutRef.current = null;
            normalizeMobileLoopPosition('preserve');
        }, delayMs);
    }, [normalizeMobileLoopPosition]);

    useEffect(() => {
        isMobileViewportRef.current = isMobileViewport;
        if (!isMobileViewport) {
            measureDesktopTrack();
            return;
        }

        const scroller = mobileScrollerRef.current;
        if (!scroller) return;

        const rafId = window.requestAnimationFrame(() => {
            normalizeMobileLoopPosition('initial');
            scheduleMobileLoopNormalization(0);
        });

        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [isMobileViewport, measureDesktopTrack, normalizeMobileLoopPosition, scheduleMobileLoopNormalization]);

    useEffect(() => {
        const mobileMediaQuery = window.matchMedia(MOBILE_QUERY);
        const handleMediaChange = (event: MediaQueryListEvent) => {
            setIsMobileViewport(event.matches);
        };

        setIsMobileViewport(mobileMediaQuery.matches);
        mobileMediaQuery.addEventListener('change', handleMediaChange);
        return () => {
            mobileMediaQuery.removeEventListener('change', handleMediaChange);
        };
    }, []);

    useEffect(() => {
        const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
        prefersReducedMotionRef.current = reducedMotionQuery.matches;

        const handleReducedMotionChange = (event: MediaQueryListEvent) => {
            prefersReducedMotionRef.current = event.matches;
        };

        reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
        return () => {
            reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
        };
    }, []);

    useEffect(() => {
        const scroller = mobileScrollerRef.current;
        if (!scroller || !isMobileViewport || !SUPPORTS_SCROLLEND) return;

        const handleScrollEnd = () => {
            normalizeMobileLoopPosition('preserve');
            scheduleMobileLoopNormalization(0);
        };

        scroller.addEventListener('scrollend', handleScrollEnd as EventListener);
        return () => {
            scroller.removeEventListener('scrollend', handleScrollEnd as EventListener);
        };
    }, [isMobileViewport, normalizeMobileLoopPosition, scheduleMobileLoopNormalization]);

    useEffect(() => {
        measureDesktopTrack();
        measureMobileSetWidth();
        normalizeMobileLoopPosition('preserve');
        scheduleMobileLoopNormalization(0);

        const handleWindowResize = () => {
            measureDesktopTrack();
            measureMobileSetWidth();
            normalizeMobileLoopPosition('preserve');
            scheduleMobileLoopNormalization(0);
        };

        const resizeObserver = new ResizeObserver(() => {
            measureDesktopTrack();
            measureMobileSetWidth();
            normalizeMobileLoopPosition('preserve');
            scheduleMobileLoopNormalization(0);
        });

        if (containerRef.current) resizeObserver.observe(containerRef.current);
        if (trackRef.current) resizeObserver.observe(trackRef.current);
        if (mobileScrollerRef.current) resizeObserver.observe(mobileScrollerRef.current);

        window.addEventListener('resize', handleWindowResize);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleWindowResize);
            if (mobileNormalizeTimeoutRef.current !== null) {
                window.clearTimeout(mobileNormalizeTimeoutRef.current);
                mobileNormalizeTimeoutRef.current = null;
            }
            if (mobileRecenteringRafRef.current !== null) {
                window.cancelAnimationFrame(mobileRecenteringRafRef.current);
                mobileRecenteringRafRef.current = null;
            }
            mobilePointerActiveRef.current = false;
            mobileRecenteringRef.current = false;
        };
    }, [measureDesktopTrack, measureMobileSetWidth, normalizeMobileLoopPosition, scheduleMobileLoopNormalization]);

    useEffect(() => {
        let rafId = 0;
        let lastFrameTime = performance.now();

        const tick = (timeMs: number) => {
            const deltaSeconds = Math.min(0.05, (timeMs - lastFrameTime) / 1000);
            lastFrameTime = timeMs;

            if (!isMobileViewportRef.current && loopWidthRef.current > 0) {
                if (!isHoveredRef.current && !prefersReducedMotionRef.current) {
                    offsetRef.current += DESKTOP_AUTO_SCROLL_PX_PER_SECOND * deltaSeconds;
                }
                offsetRef.current = normalizeLoopOffset(offsetRef.current, loopWidthRef.current);
                applyDesktopTransforms();
            }

            rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [applyDesktopTransforms]);

    const handleMobilePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!isMobileViewportRef.current) return;
        if (event.button !== 0 || !event.isPrimary) return;
        mobilePointerActiveRef.current = true;
        if (mobileNormalizeTimeoutRef.current !== null) {
            window.clearTimeout(mobileNormalizeTimeoutRef.current);
            mobileNormalizeTimeoutRef.current = null;
        }
        mobilePointerXRef.current = event.clientX;
        mobileDragDistanceRef.current = 0;
    }, []);

    const handleMobilePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (mobilePointerXRef.current === null) return;
        mobileDragDistanceRef.current += Math.abs(event.clientX - mobilePointerXRef.current);
        mobilePointerXRef.current = event.clientX;
    }, []);

    const finishMobilePointer = useCallback(() => {
        if (mobilePointerXRef.current === null) return;
        if (mobileDragDistanceRef.current > DRAG_CLICK_THRESHOLD_PX) {
            suppressClickUntilRef.current = performance.now() + 250;
        }
        mobilePointerActiveRef.current = false;
        mobilePointerXRef.current = null;
        mobileDragDistanceRef.current = 0;
        if (!SUPPORTS_SCROLLEND) {
            scheduleMobileLoopNormalization(70);
        }
    }, [scheduleMobileLoopNormalization]);

    const handleCardButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>, templateId?: string, transitionKey?: string) => {
        if (performance.now() < suppressClickUntilRef.current) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (!templateId || !transitionKey) return;
        handleCardClick(templateId, transitionKey);
    }, [handleCardClick]);

    return (
        <section id="examples" className="py-16 md:py-24 overflow-x-hidden md:overflow-x-visible">
            <div className="animate-scroll-blur-in">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    {t('examples.title')}
                </h2>
                <p className="mt-3 max-w-xl text-base text-slate-600">
                    {t('examples.subtitle')}
                </p>
            </div>

            <div className="relative mt-12 -mx-5 md:-mx-8 lg:mx-[calc(-50vw+50%)] overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-gradient-to-r from-slate-50 via-slate-50/85 to-transparent sm:w-14 md:w-24" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-slate-50 via-slate-50/85 to-transparent sm:w-14 md:w-24" />

                <div
                    ref={containerRef}
                    className="group relative hidden md:block py-8"
                    onMouseEnter={() => {
                        isHoveredRef.current = true;
                    }}
                    onMouseLeave={() => {
                        isHoveredRef.current = false;
                    }}
                >
                    <div ref={trackRef} className="flex w-max gap-6 will-change-transform">
                        {doubledCards.map((card, index) => {
                            const miniCalendar = card.templateId
                                ? getExampleTemplateMiniCalendar(card.templateId)
                                : null;
                            const transitionKey = `desktop-${card.templateId || card.id}-${index}`;
                            const examplePath = card.templateId
                                ? `/example/${encodeURIComponent(card.templateId)}`
                                : undefined;

                            return (
                                <div
                                    key={`desktop-${card.id}-${index}`}
                                    ref={(node) => {
                                        motionCardRefs.current[index] = node;
                                    }}
                                    className="w-[340px] flex-shrink-0 transform-gpu will-change-transform origin-center"
                                    style={{ transform: 'translate3d(0, 0, 0) scale(1)' }}
                                >
                                    <button
                                        type="button"
                                        onClick={(event) => handleCardButtonClick(event, card.templateId, transitionKey)}
                                        onMouseEnter={prewarmTripView}
                                        onFocus={prewarmTripView}
                                        onTouchStart={prewarmTripView}
                                        data-prefetch-href={examplePath}
                                        className="block w-full text-left cursor-pointer select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [&_*]:select-none [&_*]:[-webkit-user-select:none] [&_*]:[-webkit-touch-callout:none] transition-transform duration-300 hover:scale-[1.02] active:scale-[0.99]"
                                        {...(card.templateId
                                            ? getAnalyticsDebugAttributes('home__carousel_card', { template: card.templateId })
                                            : {})}
                                    >
                                        <ExampleTripCard
                                            card={card}
                                            miniCalendar={miniCalendar}
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div
                    ref={mobileScrollerRef}
                    className="md:hidden overflow-x-auto snap-x snap-proximity touch-pan-x overscroll-x-none scrollbar-hide"
                    onScroll={() => {
                        if (mobileRecenteringRef.current) return;
                        if (!SUPPORTS_SCROLLEND) {
                            scheduleMobileLoopNormalization();
                        }
                    }}
                    onPointerDown={handleMobilePointerDown}
                    onPointerMove={handleMobilePointerMove}
                    onPointerUp={finishMobilePointer}
                    onPointerCancel={finishMobilePointer}
                    style={{
                        scrollPaddingInline: `calc((100% - ${MOBILE_CARD_WIDTH_PX}px) / 2)`,
                    }}
                >
                    <div className="flex items-start gap-5 py-4">
                        {mobileLoopCards.map((card, index) => {
                            const miniCalendar = card.templateId
                                ? getExampleTemplateMiniCalendar(card.templateId)
                                : null;
                            const transitionKey = `mobile-${card.templateId || card.id}-${index}`;
                            const examplePath = card.templateId
                                ? `/example/${encodeURIComponent(card.templateId)}`
                                : undefined;

                            return (
                                <div
                                    key={`mobile-${card.id}-${index}`}
                                    className="w-[300px] flex-shrink-0 snap-center [scroll-snap-stop:always]"
                                >
                                    <button
                                        type="button"
                                        onClick={(event) => handleCardButtonClick(event, card.templateId, transitionKey)}
                                        onTouchStart={prewarmTripView}
                                        onFocus={prewarmTripView}
                                        data-prefetch-href={examplePath}
                                        className="block w-full text-left cursor-pointer select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [&_*]:select-none [&_*]:[-webkit-user-select:none] [&_*]:[-webkit-touch-callout:none] transition-transform duration-300 active:scale-[0.99]"
                                        {...(card.templateId
                                            ? getAnalyticsDebugAttributes('home__carousel_card', { template: card.templateId })
                                            : {})}
                                    >
                                        <ExampleTripCard
                                            card={card}
                                            miniCalendar={miniCalendar}
                                        />
                                    </button>
                                </div>
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
                    {t('examples.moreInspirationsCta', { defaultValue: 'Discover more inspirations' })}
                    <ArrowRight size={14} weight="bold" />
                </Link>
            </div>
        </section>
    );
};
