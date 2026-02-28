import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { TransportModeIcon } from '../TransportModeIcon';
import type { ITrip } from '../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildTimelineListModel } from './timelineListViewModel';

interface TripTimelineListViewProps {
    trip: ITrip;
    selectedItemId: string | null;
    onSelect: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
}

const formatTripDayLabel = (tripStartDate: string, dayOffset: number): string => {
    const date = new Date(tripStartDate);
    if (Number.isNaN(date.getTime())) return `Day ${dayOffset + 1}`;
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTransferDuration = (durationHours: number | null): string | null => {
    if (!durationHours || !Number.isFinite(durationHours) || durationHours <= 0) return null;

    if (durationHours >= 24) {
        const days = durationHours / 24;
        return Number.isInteger(days) ? `${days.toFixed(0)}d` : `${days.toFixed(1)}d`;
    }

    return Number.isInteger(durationHours)
        ? `${durationHours.toFixed(0)}h`
        : `${durationHours.toFixed(1)}h`;
};

const areTransferPositionsEqual = (
    previous: Record<string, number>,
    next: Record<string, number>,
): boolean => {
    const previousKeys = Object.keys(previous);
    const nextKeys = Object.keys(next);
    if (previousKeys.length !== nextKeys.length) return false;

    for (const key of previousKeys) {
        if (!(key in next)) return false;
        if (Math.abs(previous[key] - next[key]) > 0.5) return false;
    }

    return true;
};

const MARKDOWN_COMPONENTS = {
    a: ({ node, ...props }: any) => (
        <a
            {...props}
            className="text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800"
            target="_blank"
            rel="noopener noreferrer"
        />
    ),
    p: ({ node, ...props }: any) => <p {...props} className="my-0 leading-6" />,
    ul: ({ node, ...props }: any) => <ul {...props} className="my-2 list-disc ps-5 space-y-1" />,
    ol: ({ node, ...props }: any) => <ol {...props} className="my-2 list-decimal ps-5 space-y-1" />,
    li: ({ node, ...props }: any) => <li {...props} className="leading-6" />,
    code: ({ node, ...props }: any) => <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-slate-700" />,
    pre: ({ node, ...props }: any) => <pre {...props} className="my-2 overflow-x-auto rounded-md bg-slate-100 p-2 text-[12px] text-slate-700" />,
};

export const TripTimelineListView: React.FC<TripTimelineListViewProps> = ({
    trip,
    selectedItemId,
    onSelect,
}) => {
    const model = useMemo(() => buildTimelineListModel(trip), [trip]);
    const sectionContainerRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const markerRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const hasAutoScrolledToTodayRef = useRef(false);
    const [transferMidpoints, setTransferMidpoints] = useState<Record<string, number>>({});
    const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    const titleHoverShiftClass = isRtl
        ? 'group-hover:-translate-x-1 group-focus-visible:-translate-x-1'
        : 'group-hover:translate-x-1 group-focus-visible:translate-x-1';

    const showCountryRooftitle = useMemo(() => {
        const countryLabels = new Set(
            model.sections
                .map((section) => section.city.countryName?.trim() || section.city.countryCode?.trim() || '')
                .map((value) => value.toLowerCase())
                .filter(Boolean),
        );
        return countryLabels.size > 1;
    }, [model.sections]);

    const updateTransferMidpoints = useCallback(() => {
        const sectionContainer = sectionContainerRef.current;
        if (!sectionContainer) return;

        const containerRect = sectionContainer.getBoundingClientRect();
        const nextMidpoints: Record<string, number> = {};

        model.sections.forEach((section, index) => {
            if (index === 0 || !section.incomingTransfer) return;
            const previousSection = model.sections[index - 1];
            const previousDot = markerRefs.current[`city-${previousSection.city.id}`];
            const currentDot = markerRefs.current[`city-${section.city.id}`];
            if (!previousDot || !currentDot) return;

            const previousRect = previousDot.getBoundingClientRect();
            const currentRect = currentDot.getBoundingClientRect();
            const previousCenter = previousRect.top - containerRect.top + (previousRect.height / 2);
            const currentCenter = currentRect.top - containerRect.top + (currentRect.height / 2);
            nextMidpoints[section.city.id] = (previousCenter + currentCenter) / 2;
        });

        setTransferMidpoints((previous) => (
            areTransferPositionsEqual(previous, nextMidpoints) ? previous : nextMidpoints
        ));
    }, [model.sections]);

    useEffect(() => {
        if (hasAutoScrolledToTodayRef.current) return;
        if (!model.todayMarkerId) return;

        const viewport = viewportRef.current;
        const marker = markerRefs.current[model.todayMarkerId];
        if (!viewport || !marker) return;

        const markerTop = marker.offsetTop;
        const minimumDistanceForAutoScroll = Math.max(220, viewport.clientHeight * 0.4);
        if ((markerTop - viewport.scrollTop) <= minimumDistanceForAutoScroll) return;

        hasAutoScrolledToTodayRef.current = true;
        marker.scrollIntoView({
            block: 'start',
            behavior: 'smooth',
        });
    }, [model.todayMarkerId, model.sections.length]);

    useLayoutEffect(() => {
        updateTransferMidpoints();
    }, [updateTransferMidpoints]);

    useEffect(() => {
        const sectionContainer = sectionContainerRef.current;
        if (!sectionContainer) return;

        updateTransferMidpoints();

        const handleResize = () => {
            updateTransferMidpoints();
        };

        window.addEventListener('resize', handleResize);

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => {
                updateTransferMidpoints();
            });
            observer.observe(sectionContainer);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            observer?.disconnect();
        };
    }, [updateTransferMidpoints]);

    return (
        <div
            ref={viewportRef}
            className="h-full overflow-y-auto bg-white"
        >
            <div className="mx-auto w-full max-w-4xl px-4 py-7 pb-16 sm:px-7 lg:px-10">
                {model.sections.length === 0 && (
                    <div className="ps-2 text-sm leading-7 text-slate-500">
                        No city stops available yet.
                    </div>
                )}
                {model.sections.length > 0 && (
                    <div ref={sectionContainerRef} className="relative">
                        <div aria-hidden className="absolute inset-y-0 start-8 w-px bg-slate-200" />
                        <div className="pointer-events-none absolute inset-0 z-10">
                            {model.sections.map((section, index) => {
                                if (index === 0 || !section.incomingTransfer) return null;
                                const transfer = section.incomingTransfer;
                                const transferDuration = formatTransferDuration(transfer.durationHours ?? null);
                                const transferTop = transferMidpoints[section.city.id];
                                if (!Number.isFinite(transferTop)) return null;

                                const handleTransferSelect = () => {
                                    if (!transfer.itemId) return;
                                    trackEvent('trip_view__timeline_transfer--open', {
                                        trip_id: trip.id,
                                        item_id: transfer.itemId,
                                        city_id: section.city.id,
                                        mode: transfer.mode,
                                    });
                                    onSelect(transfer.itemId);
                                };

                                return (
                                    <div
                                        key={`transfer-pill-${section.city.id}`}
                                        className="absolute start-8 -translate-x-1/2 -translate-y-1/2"
                                        style={{ top: transferTop }}
                                    >
                                        <button
                                            type="button"
                                            onClick={handleTransferSelect}
                                            disabled={!transfer.itemId}
                                            aria-label={`Open ${transfer.modeLabel} transfer details`}
                                            className={`pointer-events-auto origin-center -rotate-90 rounded-full border bg-white/95 shadow-sm transition-colors ${
                                                transfer.itemId
                                                    ? 'border-slate-300 text-slate-700 hover:border-accent-300 hover:text-accent-700'
                                                    : 'border-slate-200 text-slate-400'
                                            }`}
                                            {...getAnalyticsDebugAttributes('trip_view__timeline_transfer--open', {
                                                trip_id: trip.id,
                                                item_id: transfer.itemId,
                                                city_id: section.city.id,
                                                mode: transfer.mode,
                                            })}
                                        >
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap">
                                                <TransportModeIcon mode={transfer.mode} size={12} />
                                                <span>{transfer.modeLabel}</span>
                                                {transferDuration && (
                                                    <span className="text-[10px] font-medium text-slate-500">{transferDuration}</span>
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {model.sections.map((section, index) => {
                            const cityStartDay = Math.max(1, Math.floor(section.city.startDateOffset) + 1);
                            const cityEndDay = Math.max(cityStartDay, Math.ceil(section.city.startDateOffset + Math.max(0, section.city.duration)));
                            const cityTitle = section.city.title || section.city.location || `Stop ${index + 1}`;
                            const countryLabel = section.city.countryName?.trim() || section.city.countryCode?.trim() || null;
                            const citySelected = selectedItemId === section.city.id;
                            const citySummaryMarkdown = section.city.description?.trim() || section.arrivalDescription || '';

                            const handleCitySelect = () => {
                                trackEvent('trip_view__timeline_city--open', {
                                    trip_id: trip.id,
                                    city_id: section.city.id,
                                });
                                onSelect(section.city.id, { isCity: true });
                            };

                            return (
                                <React.Fragment key={section.city.id}>
                                    <section className="relative ps-14 pb-12">
                                        <div
                                            ref={(node) => {
                                                markerRefs.current[`city-${section.city.id}`] = node;
                                            }}
                                            className="absolute start-8 top-5 z-20 size-3 rounded-full border-2 border-white shadow-sm"
                                            style={{
                                                backgroundColor: section.colorHex,
                                                transform: 'translateX(-50%)',
                                            }}
                                        />

                                        <header className="sticky top-0 z-20 bg-white/95 py-2 backdrop-blur-sm">
                                            {showCountryRooftitle && countryLabel && (
                                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] leading-6 text-slate-400">
                                                    {countryLabel}
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                className="group w-full cursor-pointer text-left"
                                                onClick={handleCitySelect}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        handleCitySelect();
                                                    }
                                                }}
                                                {...getAnalyticsDebugAttributes('trip_view__timeline_city--open', {
                                                    trip_id: trip.id,
                                                    city_id: section.city.id,
                                                })}
                                            >
                                                <div className="flex flex-wrap items-end justify-between gap-3">
                                                    <h3 className={`text-2xl font-semibold tracking-tight underline-offset-4 decoration-2 transition-all group-hover:underline ${citySelected ? 'text-accent-700 decoration-accent-500' : 'text-slate-900 decoration-slate-400'}`}>
                                                        {cityTitle}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium tracking-[0.08em] text-slate-600 uppercase">
                                                            Days {cityStartDay} - {cityEndDay}
                                                        </span>
                                                        {section.hasToday && (
                                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                                Today
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        </header>

                                        {citySummaryMarkdown && (
                                            <div className="pb-2 text-sm text-slate-600">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                                                    {citySummaryMarkdown}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        <div className="pt-1">
                                            {section.activities.length === 0 ? (
                                                <p className="py-3 text-sm leading-7 text-slate-500">
                                                    No activities planned yet.
                                                </p>
                                            ) : (
                                                <ol className="divide-y divide-slate-200/80">
                                                    {section.activities.map((activity) => {
                                                        const markerId = `activity-${activity.item.id}`;
                                                        const isSelected = selectedItemId === activity.item.id;
                                                        return (
                                                            <li
                                                                key={activity.item.id}
                                                                ref={(node) => {
                                                                    markerRefs.current[markerId] = node;
                                                                }}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        trackEvent('trip_view__timeline_activity--open', {
                                                                            trip_id: trip.id,
                                                                            item_id: activity.item.id,
                                                                            city_id: section.city.id,
                                                                        });
                                                                        onSelect(activity.item.id);
                                                                    }}
                                                                    className="group w-full py-4 text-left"
                                                                    {...getAnalyticsDebugAttributes('trip_view__timeline_activity--open', {
                                                                        trip_id: trip.id,
                                                                        item_id: activity.item.id,
                                                                        city_id: section.city.id,
                                                                    })}
                                                                >
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                                                                            {formatTripDayLabel(trip.startDate, activity.dayOffset)} · Day {activity.dayOffset + 1}
                                                                        </p>
                                                                        {activity.isToday && (
                                                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                                                Today
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className={`mt-1 inline-flex cursor-pointer text-[17px] leading-7 underline-offset-4 decoration-2 transition-all ${titleHoverShiftClass} group-hover:underline ${isSelected ? 'font-semibold text-accent-700 decoration-accent-400' : 'font-medium text-slate-900 decoration-slate-300'}`}>
                                                                        {activity.item.title}
                                                                    </p>
                                                                    {activity.item.description && (
                                                                        <div className="mt-2 max-w-3xl text-sm text-slate-600">
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                                                                                {activity.item.description}
                                                                            </ReactMarkdown>
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ol>
                                            )}
                                        </div>
                                    </section>
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
