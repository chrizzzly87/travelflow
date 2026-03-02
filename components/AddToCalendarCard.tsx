import React, { useEffect, useMemo, useState } from 'react';
import { CalendarBlank, DownloadSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import type { BlogCalendarCardConfig } from '../services/blogCalendarCardService';
import { buildBlogCalendarIcs } from '../services/blogCalendarCardService';

interface AddToCalendarCardProps {
    config: BlogCalendarCardConfig;
    postSlug: string;
}

export const AddToCalendarCard: React.FC<AddToCalendarCardProps> = ({ config, postSlug }) => {
    const { t } = useTranslation('blog');
    const icsSource = useMemo(() => buildBlogCalendarIcs(config), [config]);
    const [icsHref, setIcsHref] = useState<string>('');
    const fileName = config.filename || 'calendar-events';
    const downloadLabel = t('post.calendarCard.downloadIcs');
    const titleLabel = t('post.calendarCard.badge');
    const eventCountLabel = t('post.calendarCard.eventCount', { count: config.events.length });
    const compatibleHint = t('post.calendarCard.compatibilityHint');

    useEffect(() => {
        const blob = new Blob([icsSource], { type: 'text/calendar;charset=utf-8' });
        const nextUrl = URL.createObjectURL(blob);
        setIcsHref(nextUrl);
        return () => {
            URL.revokeObjectURL(nextUrl);
        };
    }, [icsSource]);

    return (
        <section className="my-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 lg:-mx-8 lg:rounded-3xl lg:px-7 xl:-mx-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 ring-1 ring-accent-200">
                        <CalendarBlank size={20} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">
                            {titleLabel}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{config.title}</h3>
                        {config.description ? <p className="mt-1 text-sm text-slate-600">{config.description}</p> : null}
                        <p className="mt-1 text-xs font-medium text-slate-500">{eventCountLabel}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">{compatibleHint}</p>
                    </div>
                </div>
                <a
                    href={icsHref || '#'}
                    download={`${fileName}.ics`}
                    onClick={(event) => {
                        if (!icsHref) {
                            event.preventDefault();
                            return;
                        }
                        trackEvent('blog__calendar_card--download_ics', {
                            slug: postSlug,
                            event_count: config.events.length,
                        });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-800 transition-colors hover:border-accent-300 hover:bg-accent-100"
                    {...getAnalyticsDebugAttributes('blog__calendar_card--download_ics', {
                        slug: postSlug,
                        event_count: config.events.length,
                    })}
                >
                    <DownloadSimple size={14} weight="bold" />
                    <span>{downloadLabel}</span>
                </a>
            </div>
        </section>
    );
};
