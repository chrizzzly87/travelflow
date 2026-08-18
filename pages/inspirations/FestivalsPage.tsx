import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Confetti } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { FestivalCalendarCard } from '../../components/inspirations/FestivalCalendarCard';
import { useFestivalDateLabels } from '../../components/inspirations/useFestivalDateLabels';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE } from '../../config/locales';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    FESTIVAL_CATALOG,
    listFestivalMonths,
    listFestivalRegions,
    type FestivalRegionId,
} from '../../services/festivalCatalogService';
import { sortFestivalsByNextOccurrence, type FestivalOccurrence } from '../../services/festivalDateService';

const ALL_FILTER = 'all';
const REGION_OPTIONS = listFestivalRegions();
const MONTH_OPTIONS = listFestivalMonths();

const FILTER_CHIP_BASE = 'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors';
const FILTER_CHIP_ACTIVE = 'border-accent-500 bg-accent-600 text-white';
const FILTER_CHIP_IDLE = 'border-slate-200 bg-white text-slate-600 hover:border-accent-200 hover:text-accent-700';

/**
 * `Event` structured data for the listed festivals. Only exact occurrences get a
 * `startDate` — schema.org has no way to express "usually in March", and an
 * invented date would be worse than an omitted one.
 */
const buildEventJsonLd = (
    items: Array<{ name: string; summary: string; countryName: string; occurrence: FestivalOccurrence; sourceUrl?: string }>,
): string => JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
            '@type': 'Event',
            name: item.name,
            description: item.summary,
            eventStatus: 'https://schema.org/EventScheduled',
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            location: { '@type': 'Country', name: item.countryName },
            ...(item.occurrence.kind === 'exact'
                ? { startDate: item.occurrence.date, endDate: item.occurrence.endDate }
                : {}),
            ...(item.sourceUrl ? { url: item.sourceUrl } : {}),
        },
    })),
});

export const FestivalsPage: React.FC = () => {
    const { t } = useTranslation('pages');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const { formatMonthName } = useFestivalDateLabels(locale);

    const [regionFilter, setRegionFilter] = useState<FestivalRegionId | typeof ALL_FILTER>(ALL_FILTER);
    const [monthFilter, setMonthFilter] = useState<number | typeof ALL_FILTER>(ALL_FILTER);

    // Resolved once per mount: "soonest first" must not reshuffle mid-session,
    // and a single clock value keeps every card consistent with every other.
    const rankedFestivals = useMemo(() => {
        const now = new Date();
        const byId = new Map(FESTIVAL_CATALOG.map((entry) => [entry.event, entry]));
        return sortFestivalsByNextOccurrence(FESTIVAL_CATALOG.map((entry) => entry.event), now)
            .map(({ event, occurrence }) => ({ entry: byId.get(event)!, occurrence }));
    }, []);

    const visibleFestivals = useMemo(() => rankedFestivals.filter(({ entry }) => (
        (regionFilter === ALL_FILTER || entry.regionId === regionFilter)
        && (monthFilter === ALL_FILTER || entry.event.month === monthFilter)
    )), [monthFilter, rankedFestivals, regionFilter]);

    const exactCount = useMemo(
        () => rankedFestivals.filter(({ occurrence }) => occurrence.kind === 'exact').length,
        [rankedFestivals],
    );

    const jsonLd = useMemo(() => buildEventJsonLd(rankedFestivals.map(({ entry, occurrence }) => ({
        name: entry.event.name,
        summary: entry.event.summary,
        countryName: entry.countryName,
        occurrence,
        sourceUrl: entry.event.sourceUrl,
    }))), [rankedFestivals]);

    const selectRegion = (region: FestivalRegionId | typeof ALL_FILTER) => {
        setRegionFilter(region);
        trackEvent('inspirations__festival_filter--region', { region });
    };

    const selectMonth = (month: number | typeof ALL_FILTER) => {
        setMonthFilter(month);
        trackEvent('inspirations__festival_filter--month', { month });
    };

    return (
        <MarketingLayout>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

            <section className="pt-8 pb-8 md:pt-14 md:pb-10 animate-hero-entrance">
                <Link
                    to={buildLocalizedMarketingPath('inspirations', locale)}
                    className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-accent-700"
                >
                    <ArrowLeft className="rtl:rotate-180" size={14} weight="bold" />
                    {t('inspirations.subpages.backToInspirations')}
                </Link>
                <span className="flex w-fit items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                    <Confetti size={14} weight="duotone" />
                    {t('inspirations.subpages.festivals.pill')}
                </span>
                <h1
                    className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
                    style={{ fontFamily: 'var(--tf-font-heading)' }}
                >
                    {t('inspirations.subpages.festivals.title')}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    {t('inspirations.subpages.festivals.description')}
                </p>
                <p className="mt-4 max-w-2xl text-sm font-semibold text-accent-700">
                    {t('inspirations.subpages.festivals.counts', {
                        total: rankedFestivals.length,
                        exact: exactCount,
                    })}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                    {t('inspirations.subpages.festivals.accuracyNote')}
                </p>
            </section>

            <section className="border-y border-slate-200 py-5" aria-label={t('inspirations.subpages.festivals.filtersLabel')}>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="me-1 text-xs font-black uppercase tracking-wide text-slate-400">
                            {t('inspirations.subpages.festivals.filterRegion')}
                        </span>
                        <button
                            type="button"
                            onClick={() => selectRegion(ALL_FILTER)}
                            aria-pressed={regionFilter === ALL_FILTER}
                            className={`${FILTER_CHIP_BASE} ${regionFilter === ALL_FILTER ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}`}
                            {...getAnalyticsDebugAttributes('inspirations__festival_filter--region', { region: ALL_FILTER })}
                        >
                            {t('inspirations.subpages.festivals.filterAll')}
                        </button>
                        {REGION_OPTIONS.map((region) => (
                            <button
                                key={region}
                                type="button"
                                onClick={() => selectRegion(region)}
                                aria-pressed={regionFilter === region}
                                className={`${FILTER_CHIP_BASE} ${regionFilter === region ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}`}
                                {...getAnalyticsDebugAttributes('inspirations__festival_filter--region', { region })}
                            >
                                {t(`inspirations.subpages.festivals.regions.${region}`)}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="me-1 text-xs font-black uppercase tracking-wide text-slate-400">
                            {t('inspirations.subpages.festivals.filterMonth')}
                        </span>
                        <button
                            type="button"
                            onClick={() => selectMonth(ALL_FILTER)}
                            aria-pressed={monthFilter === ALL_FILTER}
                            className={`${FILTER_CHIP_BASE} ${monthFilter === ALL_FILTER ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}`}
                            {...getAnalyticsDebugAttributes('inspirations__festival_filter--month', { month: ALL_FILTER })}
                        >
                            {t('inspirations.subpages.festivals.filterAll')}
                        </button>
                        {MONTH_OPTIONS.map((month) => (
                            <button
                                key={month}
                                type="button"
                                onClick={() => selectMonth(month)}
                                aria-pressed={monthFilter === month}
                                className={`${FILTER_CHIP_BASE} ${monthFilter === month ? FILTER_CHIP_ACTIVE : FILTER_CHIP_IDLE}`}
                                {...getAnalyticsDebugAttributes('inspirations__festival_filter--month', { month })}
                            >
                                {formatMonthName(month)}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="pb-16 pt-8 md:pb-24">
                <p className="mb-5 text-sm font-semibold text-slate-500">
                    {t('inspirations.subpages.festivals.resultCount', { count: visibleFestivals.length })}
                </p>
                {visibleFestivals.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleFestivals.map(({ entry, occurrence }) => (
                            <FestivalCalendarCard key={entry.id} entry={entry} occurrence={occurrence} locale={locale} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
                        {t('inspirations.subpages.festivals.emptyState')}
                    </div>
                )}
            </section>
        </MarketingLayout>
    );
};
