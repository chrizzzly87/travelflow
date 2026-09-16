import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Hotel, MapPin } from 'lucide-react';

import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { TransportModeIcon } from '../TransportModeIcon';
import { normalizeActivityTypes } from '../../utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { MARKDOWN_HEADS_UP_BANNER_CLASS, remarkHeadsUpBanners } from '../markdownPresentation';
import type { MobileDayPlanDay } from './mobileDayPlanModel';

interface TripMobileDayPanelProps {
    tripId: string;
    day: MobileDayPlanDay;
    selectedItemId: string | null;
    onSelect: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
}

const MARKDOWN_COMPONENTS = {
    h1: ({ node, children, ...props }: any) => <p {...props} className="mt-2 text-sm font-semibold text-slate-900">{children}</p>,
    h2: ({ node, children, ...props }: any) => <p {...props} className="mt-2 text-sm font-semibold text-slate-900">{children}</p>,
    h3: ({ node, children, ...props }: any) => <p {...props} className="mt-2 text-sm font-semibold text-slate-900">{children}</p>,
    p: ({ node, ...props }: any) => <p {...props} className="my-1 leading-6" />,
    ul: ({ node, ...props }: any) => {
        const isHeadsUpList = Boolean(node?.properties?.['data-heads-up-list']);
        return <ul {...props} className={isHeadsUpList ? MARKDOWN_HEADS_UP_BANNER_CLASS : 'my-1 list-disc ps-5 leading-6'} />;
    },
    ol: ({ node, ...props }: any) => <ol {...props} className="my-1 list-decimal ps-5 leading-6" />,
    a: ({ node, children, ...props }: any) => (
        <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2" target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    ),
};

const formatTransferDuration = (durationHours: number | null): string | null => {
    if (!durationHours || !Number.isFinite(durationHours) || durationHours <= 0) return null;
    if (durationHours >= 24) {
        const days = durationHours / 24;
        return Number.isInteger(days) ? `${days.toFixed(0)}d` : `${days.toFixed(1)}d`;
    }
    return Number.isInteger(durationHours) ? `${durationHours.toFixed(0)}h` : `${durationHours.toFixed(1)}h`;
};

export const TripMobileDayPanel: React.FC<TripMobileDayPanelProps> = ({
    tripId,
    day,
    selectedItemId,
    onSelect,
}) => {
    const city = day.city;
    const cityTitle = city?.title?.trim() || city?.location?.trim() || '';
    const hotels = (city?.hotels || []).filter((hotel) => hotel.name?.trim() || hotel.address?.trim());
    const transferDuration = formatTransferDuration(day.transfer?.durationHours ?? null);

    return (
        <div className="px-4 pb-10 pt-1">
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {day.fullDateLabel}
                </p>
                {day.isToday && (
                    <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-700">
                        Today
                    </span>
                )}
            </div>

            {city ? (
                <button
                    type="button"
                    onClick={() => {
                        trackEvent('trip_view__mobile_day_city--open', { trip_id: tripId, city_id: city.id });
                        onSelect(city.id, { isCity: true });
                    }}
                    className="mt-1 flex w-full items-center gap-2.5 text-start"
                    {...getAnalyticsDebugAttributes('trip_view__mobile_day_city--open', { trip_id: tripId, city_id: city.id })}
                >
                    <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: day.cityColorHex || 'var(--tf-accent-500, #4f46e5)' }}
                    />
                    <span className={`truncate text-xl font-semibold tracking-tight ${selectedItemId === city.id ? 'text-accent-700' : 'text-slate-900'}`}>
                        {cityTitle}
                    </span>
                    {day.isArrivalDay && (
                        <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                            Arrival
                        </span>
                    )}
                </button>
            ) : (
                <p className="mt-1 text-xl font-semibold tracking-tight text-slate-400">Unscheduled day</p>
            )}

            {hotels.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                    {hotels.map((hotel) => (
                        <div key={hotel.id} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <Hotel size={14} className="mt-0.5 shrink-0 text-accent-600" />
                            <div className="min-w-0">
                                {hotel.name?.trim() && <p className="truncate font-semibold text-slate-900">{hotel.name.trim()}</p>}
                                {hotel.address?.trim() && (
                                    <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                                        <MapPin size={12} className="mt-0.5 shrink-0" />
                                        <span className="break-words">{hotel.address.trim()}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {day.activities.length === 0 ? (
                <p className="py-6 text-sm leading-6 text-slate-500">Nothing planned for this day yet.</p>
            ) : (
                <ol className="mt-2 divide-y divide-slate-200/80">
                    {day.activities.map((activity) => {
                        const isSelected = selectedItemId === activity.id;
                        const activityTypes = normalizeActivityTypes(activity.activityType, []);
                        return (
                            <li key={activity.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        trackEvent('trip_view__mobile_day_activity--open', {
                                            trip_id: tripId,
                                            item_id: activity.id,
                                        });
                                        onSelect(activity.id);
                                    }}
                                    className="w-full py-3.5 text-start"
                                    {...getAnalyticsDebugAttributes('trip_view__mobile_day_activity--open', {
                                        trip_id: tripId,
                                        item_id: activity.id,
                                    })}
                                >
                                    <p className={`text-[16px] leading-6 ${isSelected ? 'font-semibold text-accent-700' : 'font-medium text-slate-900'}`}>
                                        {activity.title}
                                    </p>
                                    {activity.description && (
                                        <div className="mt-1.5 text-sm text-slate-600">
                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkHeadsUpBanners]} components={MARKDOWN_COMPONENTS}>
                                                {activity.description}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                    {activityTypes.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                            {activityTypes.map((type) => {
                                                const label = formatActivityTypeLabel(type);
                                                return (
                                                    <span
                                                        key={`${activity.id}-${type}`}
                                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getActivityTypePaletteClass(type)}`}
                                                    >
                                                        <ActivityTypeIcon type={type} size={12} />
                                                        {label}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}

            {day.transfer && (
                <button
                    type="button"
                    onClick={() => {
                        if (!day.transfer?.item) return;
                        onSelect(day.transfer.item.id);
                    }}
                    disabled={!day.transfer.item}
                    className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-3 text-start disabled:cursor-default"
                    {...getAnalyticsDebugAttributes('trip_view__mobile_day_transfer--open', {
                        trip_id: tripId,
                        item_id: day.transfer.item?.id || 'none',
                    })}
                >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                        <TransportModeIcon mode={day.transfer.mode as never} size={16} />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                            On to {day.transfer.toCityTitle}
                        </span>
                        <span className="block text-xs text-slate-500">
                            {[day.transfer.departureTime, transferDuration].filter(Boolean).join(' · ') || 'Departure today'}
                        </span>
                    </span>
                </button>
            )}
        </div>
    );
};
