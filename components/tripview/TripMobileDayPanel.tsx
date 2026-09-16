import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BedDouble, LogOut, MapPin } from 'lucide-react';

import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { TransportModeIcon } from '../TransportModeIcon';
import { normalizeActivityTypes } from '../../utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { MARKDOWN_HEADS_UP_BANNER_CLASS, remarkHeadsUpBanners } from '../markdownPresentation';
import { TripDirectionsButton } from './TripDirectionsButton';
import { buildActivityDirectionsLabel } from '../../shared/mapDirectionsLinks';
import type { MobileDayPlanDay, MobileDayPlanTransfer } from './mobileDayPlanModel';

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

const ScheduleRow: React.FC<{
    icon: React.ReactNode;
    title: string;
    detail: string | null;
    time: string | null;
    onClick?: () => void;
    analytics?: Record<string, string | number | boolean>;
    analyticsId?: string;
}> = ({ icon, title, detail, time, onClick, analytics, analyticsId }) => {
    const body = (
        <>
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
                {detail && <span className="block truncate text-xs text-slate-500">{detail}</span>}
            </span>
            {time && (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{time}</span>
            )}
        </>
    );

    if (!onClick) {
        return <div className="flex items-center gap-2.5 px-3 py-2.5">{body}</div>;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-white/70"
            {...(analyticsId ? getAnalyticsDebugAttributes(analyticsId, analytics) : {})}
        >
            {body}
        </button>
    );
};

const buildTransferDetail = (transfer: MobileDayPlanTransfer): string | null => {
    const parts = [transfer.modeLabel, transfer.durationLabel].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(' · ') : null;
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

    const hasSchedule = Boolean(day.arrival || day.departure || day.hotelCheckIn || day.hotelCheckOut);

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
                        className="h-5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: day.cityColorHex || 'var(--tf-accent-500, #4f46e5)' }}
                    />
                    <span className={`truncate text-xl font-semibold tracking-tight ${selectedItemId === city.id ? 'text-accent-700' : 'text-slate-900'}`}>
                        {cityTitle}
                    </span>
                </button>
            ) : (
                <p className="mt-1 text-xl font-semibold tracking-tight text-slate-400">Unscheduled day</p>
            )}

            {/* The day's fixed points come first: they are what the traveller
              * has to be somewhere for, and everything else is flexible. */}
            {hasSchedule && (
                <div
                    data-testid="planner-mobile-day-schedule"
                    className="mt-3 divide-y divide-slate-200/70 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80"
                >
                    {day.arrival && (
                        <ScheduleRow
                            icon={<TransportModeIcon mode={day.arrival.mode as never} size={15} />}
                            title={`Arrive in ${day.arrival.toCityTitle}`}
                            detail={[
                                `From ${day.arrival.fromCityTitle}`,
                                buildTransferDetail(day.arrival),
                                day.arrival.departureTime ? `departs ${day.arrival.departureTime}` : null,
                            ].filter(Boolean).join(' · ')}
                            time={day.arrival.arrivalTime
                                ? `${day.arrival.arrivalTime}${day.arrival.arrivalDayShift > 0 ? ` +${day.arrival.arrivalDayShift}` : ''}`
                                : null}
                            onClick={day.arrival.item ? () => onSelect(day.arrival!.item!.id) : undefined}
                            analyticsId="trip_view__mobile_day_arrival--open"
                            analytics={{ trip_id: tripId }}
                        />
                    )}

                    {day.hotelCheckIn && (
                        <ScheduleRow
                            icon={<BedDouble size={15} />}
                            title="Hotel check-in"
                            detail={day.hotelCheckIn.name?.trim() || day.hotelCheckIn.address?.trim() || null}
                            time={null}
                        />
                    )}

                    {day.hotelCheckOut && (
                        <ScheduleRow
                            icon={<LogOut size={15} />}
                            title="Hotel check-out"
                            detail={day.hotelCheckOut.name?.trim() || day.hotelCheckOut.address?.trim() || null}
                            time={null}
                        />
                    )}

                    {day.departure && (
                        <ScheduleRow
                            icon={<TransportModeIcon mode={day.departure.mode as never} size={15} />}
                            title={`On to ${day.departure.toCityTitle}`}
                            detail={[
                                buildTransferDetail(day.departure),
                                day.departure.arrivalTime
                                    ? `arrives ${day.departure.arrivalTime}${day.departure.arrivalDayShift > 0 ? ` +${day.departure.arrivalDayShift}` : ''}`
                                    : null,
                            ].filter(Boolean).join(' · ') || null}
                            time={day.departure.departureTime}
                            onClick={day.departure.item ? () => onSelect(day.departure!.item!.id) : undefined}
                            analyticsId="trip_view__mobile_day_transfer--open"
                            analytics={{ trip_id: tripId }}
                        />
                    )}
                </div>
            )}

            {hotels.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                    {hotels.map((hotel) => (
                        <div key={hotel.id} className="flex items-start gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            <BedDouble size={14} className="mt-0.5 shrink-0 text-accent-600" />
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
                        const directionsLabel = buildActivityDirectionsLabel(
                            activity.title,
                            activity.location,
                            cityTitle,
                        );
                        return (
                            <li
                                key={activity.id}
                                className={`flex items-start gap-2 ${isSelected ? 'bg-accent-50/50' : ''}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        trackEvent('trip_view__mobile_day_activity--open', {
                                            trip_id: tripId,
                                            item_id: activity.id,
                                        });
                                        onSelect(activity.id);
                                    }}
                                    aria-pressed={isSelected}
                                    className="min-w-0 flex-1 py-3.5 text-start"
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
                                <span className="shrink-0 self-center py-3.5 ps-1">
                                    <TripDirectionsButton
                                        tripId={tripId}
                                        itemId={activity.id}
                                        target={{
                                            coordinates: activity.coordinates ?? city?.coordinates ?? null,
                                            label: directionsLabel,
                                        }}
                                    />
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
};
