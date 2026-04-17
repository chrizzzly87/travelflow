import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowSquareOut,
    GlobeHemisphereWest,
    Lightning,
    ShieldCheck,
    Warning,
} from '@phosphor-icons/react';

import type {
    ICountryGuideFact,
    ICountryGuideLink,
    ICountryGuideSection,
    ICountryTravelGuide,
    ITrip,
} from '../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

interface TravelerWarningSummary {
    cityName: string;
    notes: string[];
}

interface TripViewPrepWorkspaceProps {
    trip: ITrip;
    tripDateRange: string;
    tripSpanCompactLabel: string;
    travelerWarnings: TravelerWarningSummary[];
}

interface PrepChecklistCard {
    id: 'before_departure' | 'on_arrival' | 'on_the_ground';
    title: string;
    bullets: string[];
}

const sectionToneClassNames = (tone?: ICountryGuideSection['tone']) => {
    if (tone === 'accent') {
        return 'border-emerald-200 bg-emerald-50/85';
    }
    if (tone === 'warning') {
        return 'border-amber-200 bg-amber-50/90';
    }
    return 'border-stone-200 bg-white';
};

const factToneClassNames = (tone?: ICountryGuideFact['tone']) => {
    if (tone === 'accent') {
        return 'border-emerald-200 bg-emerald-50/85 text-emerald-950';
    }
    if (tone === 'warning') {
        return 'border-amber-200 bg-amber-50/90 text-amber-950';
    }
    return 'border-stone-200 bg-[#f8f4ed] text-stone-900';
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const buildFactBullet = (fact: ICountryGuideFact): string => (
    normalizeWhitespace(fact.helper ? `${fact.label}: ${fact.helper}` : `${fact.label}: ${fact.value}`)
);

const collectChecklistBullets = (
    guide: ICountryTravelGuide,
    sectionIds: string[],
    factKeywords: string[],
): string[] => {
    const bullets = guide.sections
        .filter((section) => sectionIds.includes(section.id))
        .flatMap((section) => section.bullets.slice(0, 2));
    const factBullets = guide.quickFacts
        ?.filter((fact) => {
            const haystack = `${fact.label} ${fact.value} ${fact.helper || ''}`.toLowerCase();
            return factKeywords.some((keyword) => haystack.includes(keyword));
        })
        .map(buildFactBullet) || [];
    return Array.from(new Set([...factBullets, ...bullets])).slice(0, 4);
};

const buildPrepChecklistCards = (
    guide: ICountryTravelGuide,
    t: (key: string) => string,
): PrepChecklistCard[] => [
    {
        id: 'before_departure',
        title: t('tripView.prep.beforeDeparture'),
        bullets: collectChecklistBullets(guide, ['entry', 'health'], ['visa', 'arrival', 'passport', 'insurance']),
    },
    {
        id: 'on_arrival',
        title: t('tripView.prep.onArrival'),
        bullets: collectChecklistBullets(guide, ['entry', 'money'], ['arrival', 'sim', 'emergency']),
    },
    {
        id: 'on_the_ground',
        title: t('tripView.prep.onTheGround'),
        bullets: collectChecklistBullets(guide, ['safety', 'money'], ['cash', 'emergency', 'warning']),
    },
];

const getUniqueCityTitles = (trip: ITrip): string[] => {
    const seen = new Set<string>();
    return trip.items
        .filter((item) => item.type === 'city')
        .map((item) => item.title?.trim())
        .filter((title): title is string => Boolean(title))
        .filter((title) => {
            if (seen.has(title)) return false;
            seen.add(title);
            return true;
        });
};

const SourceLink: React.FC<{ link: ICountryGuideLink }> = ({ link }) => (
    <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
            trackEvent('trip_view__country_guide_source', {
                label: link.label,
            });
        }}
        className="rounded-[1.35rem] border border-stone-200 bg-white px-4 py-4 transition-colors hover:bg-stone-50"
        {...getAnalyticsDebugAttributes('trip_view__country_guide_source', { label: link.label })}
    >
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-sm font-bold text-stone-950">{link.label}</p>
                {link.helper && (
                    <p className="mt-2 text-sm leading-6 text-stone-600">{link.helper}</p>
                )}
            </div>
            <ArrowSquareOut size={16} weight="bold" className="mt-1 shrink-0 text-stone-500" />
        </div>
    </a>
);

export const TripViewPrepWorkspace: React.FC<TripViewPrepWorkspaceProps> = ({
    trip,
    tripDateRange,
    tripSpanCompactLabel,
    travelerWarnings,
}) => {
    const { t } = useTranslation('common');
    const countryInfo = trip.countryInfo;
    const guide = countryInfo?.travelGuide;

    const uniqueCities = useMemo(() => getUniqueCityTitles(trip), [trip]);
    const checklistCards = useMemo(
        () => (guide ? buildPrepChecklistCards(guide, t).filter((card) => card.bullets.length > 0) : []),
        [guide, t],
    );

    if (!guide) {
        return (
            <main className="flex-1 overflow-auto bg-[#f4efe7]">
                <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="rounded-[2rem] border border-stone-200 bg-[#fffdf9] px-6 py-6 shadow-[0_20px_45px_-28px_rgba(37,32,26,0.25)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                            {t('tripView.prep.eyebrow')}
                        </p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
                            {countryInfo?.countryName || trip.title}
                        </h2>
                        <p className="mt-3 max-w-[60ch] text-sm leading-7 text-stone-600">
                            {t('tripView.prep.empty')}
                        </p>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-auto bg-[#f4efe7]">
            <div className="mx-auto flex max-w-[1520px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
                <section className="rounded-[2.1rem] border border-stone-200 bg-[#fffdf9] px-6 py-6 shadow-[0_20px_45px_-28px_rgba(37,32,26,0.25)]">
                    <div className="flex flex-wrap items-start justify-between gap-6">
                        <div className="max-w-3xl">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                                {t('tripView.prep.eyebrow')}
                            </p>
                            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
                                {guide.title}
                            </h2>
                            <p className="mt-3 max-w-[62ch] text-sm leading-7 text-stone-600">
                                {guide.summary}
                            </p>
                        </div>
                        {guide.disclaimer && (
                            <div className="max-w-sm rounded-[1.6rem] border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm leading-6 text-amber-950">
                                {guide.disclaimer}
                            </div>
                        )}
                    </div>
                    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {guide.quickFacts?.map((fact) => (
                            <div
                                key={`${fact.label}-${fact.value}`}
                                className={`rounded-[1.5rem] border px-4 py-4 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)] ${factToneClassNames(fact.tone)}`}
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                    {fact.label}
                                </p>
                                <p className="mt-3 text-base font-bold leading-6">{fact.value}</p>
                                {fact.helper && (
                                    <p className="mt-2 text-sm leading-6 text-stone-600">{fact.helper}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
                    <div className="space-y-6">
                        <section className="rounded-[1.9rem] border border-stone-200 bg-[#fffdf9] px-5 py-5 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)]">
                            <div className="flex items-center gap-2 text-stone-950">
                                <GlobeHemisphereWest size={18} weight="duotone" />
                                <h3 className="text-base font-bold">{t('tripView.prep.routeContext')}</h3>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <div className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                        {t('tripView.prep.departure')}
                                    </p>
                                    <p className="mt-2 text-sm font-bold text-stone-950">{tripDateRange}</p>
                                </div>
                                <div className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                        {t('tripView.prep.duration')}
                                    </p>
                                    <p className="mt-2 text-sm font-bold text-stone-950">{tripSpanCompactLabel}</p>
                                </div>
                                <div className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                        {t('tripView.prep.country')}
                                    </p>
                                    <p className="mt-2 text-sm font-bold text-stone-950">{countryInfo?.countryName || '—'}</p>
                                </div>
                            </div>
                            {uniqueCities.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                        {t('tripView.prep.cities')}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {uniqueCities.map((city) => (
                                            <span
                                                key={city}
                                                className="rounded-full border border-stone-300 bg-white px-3 py-1 text-sm font-medium text-stone-700"
                                            >
                                                {city}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="rounded-[1.9rem] border border-stone-200 bg-[#fffdf9] px-5 py-5 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)]">
                            <div className="flex items-center gap-2 text-stone-950">
                                <ShieldCheck size={18} weight="duotone" />
                                <h3 className="text-base font-bold">{t('tripView.prep.priorityChecks')}</h3>
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                {checklistCards.map((card) => (
                                    <article
                                        key={card.id}
                                        className="rounded-[1.5rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4"
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                            {card.title}
                                        </p>
                                        <ul className="mt-3 space-y-2">
                                            {card.bullets.map((bullet) => (
                                                <li key={`${card.id}-${bullet}`} className="flex items-start gap-2 text-sm leading-6 text-stone-700">
                                                    <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600" />
                                                    <span>{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section className="grid gap-4 xl:grid-cols-2">
                            {guide.sections?.map((section) => (
                                <article
                                    key={section.id}
                                    className={`rounded-[1.9rem] border px-5 py-5 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)] ${sectionToneClassNames(section.tone)}`}
                                >
                                    {section.eyebrow && (
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                            {section.eyebrow}
                                        </p>
                                    )}
                                    <h3 className="mt-2 text-lg font-bold text-stone-950">{section.title}</h3>
                                    <p className="mt-3 text-sm leading-6 text-stone-700">{section.summary}</p>
                                    <div className="mt-4 grid gap-2">
                                        {section.bullets.map((bullet) => (
                                            <div
                                                key={`${section.id}-${bullet}`}
                                                className="rounded-[1.25rem] border border-white/80 bg-white/85 px-4 py-3 text-sm leading-6 text-stone-700"
                                            >
                                                {bullet}
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </section>

                        {(guide.updates?.length || 0) > 0 && (
                            <section className="rounded-[1.9rem] border border-stone-200 bg-[#fffdf9] px-5 py-5 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)]">
                                <div className="flex items-center gap-2 text-stone-950">
                                    <Warning size={18} weight="duotone" />
                                    <h3 className="text-base font-bold">{t('tripView.prep.referenceUpdates')}</h3>
                                </div>
                                <div className="mt-4 grid gap-3">
                                    {guide.updates?.map((update) => (
                                        <article
                                            key={update.id}
                                            className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-700">
                                                    {update.category}
                                                </span>
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                                                    {update.ageLabel}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-sm font-bold text-stone-950">{update.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-stone-600">{update.summary}</p>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="space-y-4 xl:sticky xl:top-4 xl:h-fit">
                        {(travelerWarnings.length || 0) > 0 && (
                            <section className="rounded-[1.9rem] border border-amber-200 bg-amber-50/90 px-5 py-5 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)]">
                                <div className="flex items-center gap-2 text-amber-950">
                                    <Warning size={18} weight="duotone" />
                                    <h3 className="text-base font-bold">{t('tripView.prep.travelerWarnings')}</h3>
                                </div>
                                <div className="mt-4 grid gap-3">
                                    {travelerWarnings.map((warning) => (
                                        <article
                                            key={`${warning.cityName}-${warning.notes.join('|')}`}
                                            className="rounded-[1.35rem] border border-amber-200 bg-white/80 px-4 py-4"
                                        >
                                            <p className="text-sm font-bold text-amber-950">{warning.cityName}</p>
                                            <ul className="mt-3 space-y-2">
                                                {warning.notes.map((note) => (
                                                    <li key={`${warning.cityName}-${note}`} className="flex items-start gap-2 text-sm leading-6 text-stone-700">
                                                        <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                                        <span>{note}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="rounded-[1.9rem] border border-stone-200 bg-[#fffdf9] px-5 py-5 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)]">
                            <div className="flex items-center gap-2 text-stone-950">
                                <Lightning size={18} weight="duotone" />
                                <h3 className="text-base font-bold">{t('tripView.prep.utilities')}</h3>
                            </div>
                            <div className="mt-4 grid gap-3">
                                {countryInfo?.currencyName && (
                                    <div className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                            {t('tripView.prep.currency')}
                                        </p>
                                        <p className="mt-2 text-sm font-bold text-stone-950">
                                            {countryInfo.currencyName} {countryInfo.currencyCode ? `(${countryInfo.currencyCode})` : ''}
                                        </p>
                                    </div>
                                )}
                                {(countryInfo?.languages?.length || 0) > 0 && (
                                    <div className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                            {t('tripView.prep.languages')}
                                        </p>
                                        <p className="mt-2 text-sm font-bold text-stone-950">{countryInfo.languages?.join(', ')}</p>
                                    </div>
                                )}
                                {countryInfo?.electricSockets && (
                                    <div className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                            {t('tripView.prep.power')}
                                        </p>
                                        <p className="mt-2 text-sm font-bold text-stone-950">{countryInfo.electricSockets}</p>
                                    </div>
                                )}
                                {guide.utilities?.map((fact) => (
                                    <div
                                        key={`${fact.label}-${fact.value}`}
                                        className="rounded-[1.35rem] border border-stone-200 bg-[#f8f4ed] px-4 py-4"
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-500">
                                            {fact.label}
                                        </p>
                                        <p className="mt-2 text-sm font-bold text-stone-950">{fact.value}</p>
                                        {fact.helper && (
                                            <p className="mt-2 text-sm leading-6 text-stone-600">{fact.helper}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {(guide.officialLinks?.length || 0) > 0 && (
                            <section className="rounded-[1.9rem] border border-stone-200 bg-[#fffdf9] px-5 py-5 shadow-[0_14px_30px_-24px_rgba(37,32,26,0.18)]">
                                <div className="flex items-center gap-2 text-stone-950">
                                    <GlobeHemisphereWest size={18} weight="duotone" />
                                    <h3 className="text-base font-bold">{t('tripView.prep.officialSources')}</h3>
                                </div>
                                <div className="mt-4 grid gap-3">
                                    {guide.officialLinks?.map((link) => (
                                        <SourceLink key={link.url} link={link} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    );
};
