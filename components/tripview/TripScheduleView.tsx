import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BusFront, CalendarDays, MapPin, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { localeToIntlLocale } from '../../config/locales';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { AppLanguage, ITimelineItem, ITrip } from '../../types';
import { getHexFromColorClass } from '../../utils';
import { buildTripScheduleModel, type TripScheduleDay, type TripScheduleEntry } from './scheduleViewModel';

interface TripScheduleViewProps {
    trip: ITrip;
    locale: AppLanguage;
    selectedItemId: string | null;
    onSelect: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
}

const formatScheduleDate = (
    dateIso: string | null,
    locale: AppLanguage,
    options: Intl.DateTimeFormatOptions,
): string | null => {
    if (!dateIso) return null;
    const date = new Date(`${dateIso}T00:00:00.000Z`);
    return new Intl.DateTimeFormat(localeToIntlLocale(locale), {
        ...options,
        timeZone: 'UTC',
    }).format(date);
};

const isToday = (dateIso: string | null): boolean => {
    if (!dateIso) return false;
    const now = new Date();
    const todayIso = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('-');
    return dateIso === todayIso;
};

const getEntryIcon = (item: ITimelineItem): React.ReactNode => {
    if (item.type === 'travel' || item.type === 'travel-empty') {
        return <BusFront size={14} aria-hidden="true" />;
    }
    return <Sparkles size={14} aria-hidden="true" />;
};

const trackScheduleSelection = (tripId: string, item: ITimelineItem) => {
    if (item.type === 'city') {
        trackEvent('trip_view__timeline_city--open', {
            trip_id: tripId,
            city_id: item.id,
            source: 'schedule',
        });
        return;
    }
    if (item.type === 'activity') {
        trackEvent('trip_view__timeline_activity--open', {
            trip_id: tripId,
            item_id: item.id,
            source: 'schedule',
        });
        return;
    }
    trackEvent('trip_view__timeline_transfer--open', {
        trip_id: tripId,
        item_id: item.id,
        mode: item.transportMode,
        source: 'schedule',
    });
};

const ScheduleEntryButton: React.FC<{
    entry: TripScheduleEntry;
    selectedItemId: string | null;
    tripId: string;
    onSelect: TripScheduleViewProps['onSelect'];
}> = ({ entry, selectedItemId, tripId, onSelect }) => {
    const { t } = useTranslation('common');
    const { item } = entry;
    const isSelected = selectedItemId === item.id;
    const isTransfer = item.type === 'travel' || item.type === 'travel-empty';
    const color = getHexFromColorClass(item.color);

    return (
        <button
            type="button"
            onClick={() => {
                trackScheduleSelection(tripId, item);
                onSelect(item.id, { isCity: item.type === 'city' });
            }}
            aria-pressed={isSelected}
            className={`group w-full rounded-xl border bg-white p-3 text-start shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
                isSelected ? 'border-accent-500 ring-2 ring-accent-100' : 'border-slate-200'
            }`}
            style={{ borderInlineStartWidth: 4, borderInlineStartColor: color }}
            {...getAnalyticsDebugAttributes(
                isTransfer
                    ? 'trip_view__timeline_transfer--open'
                    : 'trip_view__timeline_activity--open',
                { surface: 'schedule', item_id: item.id },
            )}
        >
            <span className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-400">{getEntryIcon(item)}</span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{item.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>{isTransfer ? t('tripView.workspace.schedule.transfer') : t('tripView.workspace.schedule.activity')}</span>
                        {item.departureTime ? <time dateTime={item.departureTime}>{item.departureTime}</time> : null}
                        {item.location ? <span className="truncate">{item.location}</span> : null}
                    </span>
                </span>
            </span>
        </button>
    );
};

const ScheduleDayColumn: React.FC<{
    day: TripScheduleDay;
    locale: AppLanguage;
    selectedItemId: string | null;
    tripId: string;
    onSelect: TripScheduleViewProps['onSelect'];
}> = ({ day, locale, selectedItemId, tripId, onSelect }) => {
    const { t } = useTranslation('common');
    const weekday = formatScheduleDate(day.dateIso, locale, { weekday: 'short' });
    const dateLabel = formatScheduleDate(day.dateIso, locale, { day: 'numeric', month: 'short' });
    const today = isToday(day.dateIso);

    return (
        <article
            className={`min-h-[260px] rounded-2xl border bg-slate-50/70 p-3 ${
                today ? 'border-accent-300 shadow-[inset_0_3px_0_0_var(--tf-accent-500)]' : 'border-slate-200'
            }`}
            aria-labelledby={`schedule-day-${day.dayOffset}`}
        >
            <header className="mb-3 flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        {weekday || t('tripView.workspace.schedule.dayNumber', { count: day.dayOffset + 1 })}
                    </p>
                    <h3 id={`schedule-day-${day.dayOffset}`} className="mt-0.5 text-lg font-black text-slate-950">
                        {dateLabel || t('tripView.workspace.schedule.dayNumber', { count: day.dayOffset + 1 })}
                    </h3>
                </div>
                {today ? (
                    <span className="rounded-full bg-accent-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-800">
                        {t('tripView.workspace.schedule.today')}
                    </span>
                ) : null}
            </header>

            {day.cities.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5" aria-label={t('tripView.workspace.schedule.destinations')}>
                    {day.cities.map(({ item, continuesFromPreviousDay, continuesIntoNextDay }) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                                trackScheduleSelection(tripId, item);
                                onSelect(item.id, { isCity: true });
                            }}
                            aria-pressed={selectedItemId === item.id}
                            className={`inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
                                selectedItemId === item.id
                                    ? 'border-accent-500 bg-accent-100 text-accent-900'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                            {...getAnalyticsDebugAttributes('trip_view__timeline_city--open', { surface: 'schedule', city_id: item.id })}
                        >
                            <MapPin size={12} aria-hidden="true" />
                            <span className="truncate">{item.title}</span>
                            {(continuesFromPreviousDay || continuesIntoNextDay) ? (
                                <span className="sr-only">{t('tripView.workspace.schedule.multiDayDestination')}</span>
                            ) : null}
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="space-y-2">
                {day.entries.length > 0 ? day.entries.map((entry) => (
                    <ScheduleEntryButton
                        key={entry.item.id}
                        entry={entry}
                        selectedItemId={selectedItemId}
                        tripId={tripId}
                        onSelect={onSelect}
                    />
                )) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-5 text-center text-xs text-slate-400">
                        {t('tripView.workspace.schedule.emptyDay')}
                    </div>
                )}
            </div>
        </article>
    );
};

export const TripScheduleView: React.FC<TripScheduleViewProps> = ({
    trip,
    locale,
    selectedItemId,
    onSelect,
}) => {
    const { t } = useTranslation('common');
    const model = useMemo(() => buildTripScheduleModel(trip), [trip]);
    const [requestedWeekIndex, setRequestedWeekIndex] = useState(0);
    const weekIndex = Math.min(requestedWeekIndex, Math.max(0, model.weeks.length - 1));
    const activeWeek = model.weeks[weekIndex];
    const firstDay = activeWeek?.days[0];
    const lastDay = activeWeek?.days.at(-1);
    const rangeStart = formatScheduleDate(firstDay?.dateIso ?? null, locale, { day: 'numeric', month: 'short' });
    const rangeEnd = formatScheduleDate(lastDay?.dateIso ?? null, locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const rangeLabel = rangeStart && rangeEnd
        ? `${rangeStart} – ${rangeEnd}`
        : t('tripView.workspace.schedule.weekNumber', { count: weekIndex + 1 });

    return (
        <section className="flex size-full min-h-0 flex-col bg-white" aria-labelledby="trip-schedule-title">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-accent-600">
                        <CalendarDays size={16} aria-hidden="true" />
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em]">
                            {t('tripView.workspace.schedule.eyebrow')}
                        </p>
                    </div>
                    <h2 id="trip-schedule-title" className="mt-1 truncate text-xl font-black text-slate-950 sm:text-2xl">
                        {t('tripView.workspace.schedule.title')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{t('tripView.workspace.schedule.description')}</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setRequestedWeekIndex((current) => Math.max(0, current - 1))}
                        disabled={weekIndex === 0}
                        className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                        aria-label={t('tripView.workspace.schedule.previousWeek')}
                    >
                        <ArrowLeft className="rtl:rotate-180" size={17} aria-hidden="true" />
                    </button>
                    <div className="min-w-32 text-center">
                        <p className="text-sm font-bold tabular-nums text-slate-800">{rangeLabel}</p>
                        <p className="text-[11px] text-slate-500">
                            {t('tripView.workspace.schedule.weekProgress', {
                                current: weekIndex + 1,
                                total: model.weeks.length,
                            })}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setRequestedWeekIndex((current) => Math.min(model.weeks.length - 1, current + 1))}
                        disabled={weekIndex >= model.weeks.length - 1}
                        className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                        aria-label={t('tripView.workspace.schedule.nextWeek')}
                    >
                        <ArrowRight className="rtl:rotate-180" size={17} aria-hidden="true" />
                    </button>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4 lg:p-5">
                {model.isTruncated ? (
                    <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {t('tripView.workspace.schedule.truncated')}
                    </p>
                ) : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
                    {activeWeek.days.map((day) => (
                        <ScheduleDayColumn
                            key={day.dayOffset}
                            day={day}
                            locale={locale}
                            selectedItemId={selectedItemId}
                            tripId={trip.id}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};
