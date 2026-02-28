import React, { useEffect, useMemo, useRef } from 'react';

import type { ITrip } from '../../types';
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

export const TripTimelineListView: React.FC<TripTimelineListViewProps> = ({
    trip,
    selectedItemId,
    onSelect,
}) => {
    const model = useMemo(() => buildTimelineListModel(trip), [trip]);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const markerRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const hasAutoScrolledToTodayRef = useRef(false);

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

    return (
        <div
            ref={viewportRef}
            className="h-full overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-white"
        >
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 pb-14 sm:px-6 lg:px-8">
                {model.sections.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                        No city stops available yet.
                    </div>
                )}
                {model.sections.map((section, index) => {
                    const cityStartDay = Math.max(1, Math.floor(section.city.startDateOffset) + 1);
                    const cityEndDay = Math.max(cityStartDay, Math.ceil(section.city.startDateOffset + Math.max(0, section.city.duration)));
                    const cityTitle = section.city.title || section.city.location || `Stop ${index + 1}`;
                    return (
                        <section
                            key={section.city.id}
                            className="relative pb-3"
                            style={{ paddingInlineStart: '2.5rem' }}
                        >
                            <div
                                aria-hidden
                                className="absolute inset-y-0 w-px bg-slate-200"
                                style={{ insetInlineStart: '0.75rem' }}
                            />
                            <div
                                ref={(node) => {
                                    markerRefs.current[`city-${section.city.id}`] = node;
                                }}
                                className="absolute top-7 size-3 rounded-full border-2 border-white shadow-sm"
                                style={{
                                    backgroundColor: section.colorHex,
                                    insetInlineStart: '0.75rem',
                                    transform: 'translateX(-50%)',
                                }}
                            />

                            <div
                                className={`sticky top-0 z-20 rounded-xl border px-4 py-3 shadow-sm backdrop-blur ${
                                    selectedItemId === section.city.id
                                        ? 'border-accent-300 bg-accent-50/95'
                                        : 'border-slate-200 bg-white/95'
                                }`}
                                onClick={() => onSelect(section.city.id, { isCity: true })}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(section.city.id, { isCity: true });
                                    }
                                }}
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-slate-900">{cityTitle}</h3>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                        Days {cityStartDay} - {cityEndDay}
                                    </span>
                                    {section.hasToday && (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                            Today
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs font-medium text-slate-700">{section.arrivalTitle}</p>
                                {section.arrivalDescription && (
                                    <p className="mt-1 text-xs text-slate-500">{section.arrivalDescription}</p>
                                )}
                            </div>

                            <div className="mt-3 space-y-2">
                                {section.activities.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-500">
                                        No activities planned yet.
                                    </div>
                                ) : (
                                    section.activities.map((activity) => {
                                        const markerId = `activity-${activity.item.id}`;
                                        return (
                                            <button
                                                key={activity.item.id}
                                                type="button"
                                                ref={(node) => {
                                                    markerRefs.current[markerId] = node;
                                                }}
                                                onClick={() => onSelect(activity.item.id)}
                                                className={`w-full rounded-xl border px-3 py-3 text-start transition-colors ${
                                                    selectedItemId === activity.item.id
                                                        ? 'border-accent-300 bg-accent-50'
                                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-900">
                                                            {activity.item.title}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {formatTripDayLabel(trip.startDate, activity.dayOffset)} - Day {activity.dayOffset + 1}
                                                        </p>
                                                    </div>
                                                    {activity.isToday && (
                                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                            Today
                                                        </span>
                                                    )}
                                                </div>
                                                {activity.item.description && (
                                                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                                                        {activity.item.description}
                                                    </p>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
};
