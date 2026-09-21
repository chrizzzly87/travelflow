import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BedDouble, LogOut, MapPin, Plus, SlidersHorizontal } from 'lucide-react';

import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { TransportModeIcon } from '../TransportModeIcon';
import { normalizeActivityTypes } from '../../utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { MARKDOWN_HEADS_UP_BANNER_CLASS, remarkHeadsUpBanners } from '../markdownPresentation';
import { TripDirectionsButton } from './TripDirectionsButton';
import { buildActivityDirectionsLabel } from '../../shared/mapDirectionsLinks';
import type { ITimelineItem } from '../../types';
import type { MobileDayPlanLeg, MobileDayPlanSegment, MobileDayPlanTransfer } from './mobileDayPlanModel';
import { TodayBadge } from '../ui/today-badge';

interface TripMobileDayPanelProps {
    tripId: string;
    /** One city-day: the part of a day spent in a single stay. */
    segment: MobileDayPlanSegment;
    selectedItemId: string | null;
    onSelect: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
    onEditTransport?: (leg: MobileDayPlanTransfer) => void;
    onAddActivity?: (dayOffset: number) => void;
}

const MARKDOWN_COMPONENTS = {
    h1: ({ node, children, ...props }: any) => <p {...props} className="mt-2 text-sm font-semibold text-foreground">{children}</p>,
    h2: ({ node, children, ...props }: any) => <p {...props} className="mt-2 text-sm font-semibold text-foreground">{children}</p>,
    h3: ({ node, children, ...props }: any) => <p {...props} className="mt-2 text-sm font-semibold text-foreground">{children}</p>,
    p: ({ node, ...props }: any) => <p {...props} className="my-1 leading-6" />,
    ul: ({ node, ...props }: any) => {
        const isHeadsUpList = Boolean(node?.properties?.['data-heads-up-list']);
        return <ul {...props} className={isHeadsUpList ? MARKDOWN_HEADS_UP_BANNER_CLASS : 'my-1 list-disc ps-5 leading-6'} />;
    },
    ol: ({ node, ...props }: any) => <ol {...props} className="my-1 list-decimal ps-5 leading-6" />,
    a: ({ node, children, ...props }: any) => (
        <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2 dark:text-accent-200" target="_blank" rel="noopener noreferrer">
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
    action?: { label: string; onClick: () => void };
    analytics?: Record<string, string | number | boolean>;
    analyticsId?: string;
}> = ({ icon, title, detail, time, onClick, action, analytics, analyticsId }) => {
    const body = (
        <>
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm dark:shadow-none">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
                {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
            </span>
            {time && (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{time}</span>
            )}
        </>
    );

    return (
        <div className="flex items-center">
            {onClick ? (
                <button
                    type="button"
                    onClick={onClick}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-card/70"
                    {...(analyticsId ? getAnalyticsDebugAttributes(analyticsId, analytics) : {})}
                >
                    {body}
                </button>
            ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">{body}</div>
            )}
            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    data-testid="mobile-day-transport-edit"
                    className="me-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-accent-600 dark:hover:text-accent-300"
                    aria-label={action.label}
                    title={action.label}
                >
                    <SlidersHorizontal size={15} />
                </button>
            )}
        </div>
    );
};

const buildTransferDetail = (transfer: MobileDayPlanTransfer): string | null => {
    const parts = [
        transfer.item ? transfer.modeLabel : 'Transport not set',
        transfer.durationLabel || 'duration n/a',
    ].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(' · ') : null;
};

const buildLegTitle = (leg: MobileDayPlanLeg): string => {
    if (leg.role === 'arrival') return `Arrive in ${leg.toCityTitle}`;
    if (leg.role === 'departure') return `Leave ${leg.fromCityTitle} for ${leg.toCityTitle}`;
    return `${leg.fromCityTitle} → ${leg.toCityTitle}`;
};

export const TripMobileDayPanel: React.FC<TripMobileDayPanelProps> = ({
    tripId,
    segment,
    selectedItemId,
    onSelect,
    onEditTransport,
    onAddActivity,
}) => {
    const day = segment;
    const city = segment.city;
    const cityTitle = city?.title?.trim() || city?.location?.trim() || '';
    const hotels = (city?.hotels || []).filter((hotel) => hotel.name?.trim() || hotel.address?.trim());

    const hasSchedule = day.legs.length > 0 || Boolean(day.hotelCheckIn || day.hotelCheckOut);

    return (
        <div className="px-4 pb-10 pt-1">
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {day.fullDateLabel}
                </p>
                {day.isToday && <TodayBadge />}
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
                    <span className={`truncate text-xl font-semibold tracking-tight ${selectedItemId === city.id ? 'text-accent-700 dark:text-accent-200' : 'text-foreground'}`}>
                        {cityTitle}
                    </span>
                </button>
            ) : (
                <p className="mt-1 text-xl font-semibold tracking-tight text-muted-foreground">Unscheduled day</p>
            )}

            {/* The day's fixed points come first: they are what the traveller
              * has to be somewhere for, and everything else is flexible. */}
            {hasSchedule && (
                <div
                    data-testid="planner-mobile-day-schedule"
                    className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-secondary/80"
                >
                    {day.legs.map((leg) => (
                        <ScheduleRow
                            key={`${leg.item?.id || leg.toCityTitle}-${leg.role}`}
                            icon={<TransportModeIcon mode={leg.mode as never} size={15} />}
                            title={buildLegTitle(leg)}
                            detail={[
                                buildTransferDetail(leg),
                                leg.departureTime ? `departs ${leg.departureTime}` : null,
                                leg.arrivalTime
                                    ? `arrives ${leg.arrivalTime}${leg.arrivalDayShift > 0 ? ` +${leg.arrivalDayShift}` : ''}`
                                    : null,
                            ].filter(Boolean).join(' · ') || null}
                            time={leg.role === 'arrival' ? leg.arrivalTime : leg.departureTime}
                            onClick={leg.item ? () => onSelect(leg.item!.id) : undefined}
                            action={onEditTransport
                                ? {
                                    label: `Change transport for ${buildLegTitle(leg)}`,
                                    onClick: () => onEditTransport(leg),
                                }
                                : undefined}
                            analyticsId="trip_view__mobile_day_leg--open"
                            analytics={{ trip_id: tripId, role: leg.role }}
                        />
                    ))}

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

                </div>
            )}

            {hotels.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                    {hotels.map((hotel) => (
                        <div key={hotel.id} className="flex items-start gap-2 rounded-2xl border border-border px-3 py-2 text-sm text-foreground">
                            <BedDouble size={14} className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-300" />
                            <div className="min-w-0">
                                {hotel.name?.trim() && <p className="truncate font-semibold text-foreground">{hotel.name.trim()}</p>}
                                {hotel.address?.trim() && (
                                    <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                        <MapPin size={12} className="mt-0.5 shrink-0" />
                                        <span className="break-words">{hotel.address.trim()}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {day.activities.length > 0 ? 'Activities' : 'No activities yet'}
                </p>
                {onAddActivity && (
                    <button
                        type="button"
                        onClick={() => {
                            trackEvent('trip_view__mobile_activity--add', {
                                trip_id: tripId,
                                day_offset: day.dayOffset,
                            });
                            onAddActivity(day.dayOffset);
                        }}
                        data-testid="mobile-day-add-activity"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-100 dark:bg-accent-400/12 dark:hover:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30"
                        {...getAnalyticsDebugAttributes('trip_view__mobile_activity--add', {
                            trip_id: tripId,
                            day_offset: day.dayOffset,
                        })}
                    >
                        <Plus size={14} />
                        Add activity
                    </button>
                )}
            </div>

            {day.activities.length === 0 ? (
                <p className="py-4 text-sm leading-6 text-muted-foreground">
                    Nothing planned for this day yet.
                </p>
            ) : (
                <ol className="mt-1 flex flex-col gap-1">
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
                                data-selected={isSelected || undefined}
                                className={`flex items-start gap-2 rounded-xl border px-3 transition-colors ${
                                    isSelected
                                        ? 'border-accent-200 bg-accent-50 shadow-sm dark:bg-accent-400/12 dark:border-accent-400/30'
                                        : 'border-transparent'
                                }`}
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
                                    <p className={`text-[16px] leading-6 ${isSelected ? 'font-semibold text-accent-700 dark:text-accent-200' : 'font-medium text-foreground'}`}>
                                        {activity.title}
                                    </p>
                                    {activity.description && (
                                        <div className="mt-1.5 text-sm text-muted-foreground">
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
