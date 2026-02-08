import React, { useMemo } from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { ReleasePill } from '../components/marketing/ReleasePill';
import { getPublishedReleaseNotes, getWebsiteVisibleItems, groupReleaseItemsByType } from '../services/releaseNotesService';

const formatReleaseDate = (dateLike: string) => {
    const parsed = new Date(dateLike);
    if (Number.isNaN(parsed.getTime())) return dateLike;

    return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const UpdatesPage: React.FC = () => {
    const releases = useMemo(() => getPublishedReleaseNotes(), []);
    const releaseEntries = useMemo(
        () =>
            releases.flatMap((release) => {
                const visibleItems = getWebsiteVisibleItems(release);
                if (visibleItems.length === 0) return [];
                return [{ release, groupedItems: groupReleaseItemsByType(visibleItems) }];
            }),
        [releases]
    );

    return (
        <MarketingLayout>
            <section className="pt-5 pb-10 text-center md:pb-12">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">News & Updates</h1>
            </section>

            <section className="mt-2 space-y-4">
                {releaseEntries.length === 0 && (
                    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm text-slate-600">No published updates yet.</p>
                    </article>
                )}

                {releaseEntries.map(({ release, groupedItems }, releaseIndex) => {
                    const isTopNews = releaseIndex === 0;

                    return (
                        <article
                            key={release.id}
                            className={
                                isTopNews
                                    ? 'rounded-2xl border border-accent-200/80 bg-gradient-to-b from-accent-50/40 to-white p-6 shadow-accent-glow-md'
                                    : 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
                            }
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <h2 className="text-xl font-bold tracking-tight text-slate-900">{release.title}</h2>
                                <div className="text-right">
                                    <span
                                        className={
                                            isTopNews
                                                ? 'inline-flex rounded-full border border-accent-300 bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-800 shadow-accent-glow-sm'
                                                : 'inline-flex rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700'
                                        }
                                    >
                                        {release.version}
                                    </span>
                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                        {formatReleaseDate(release.publishedAt || release.date)}
                                    </p>
                                </div>
                            </div>

                            {release.summary && <p className="mt-3 max-w-[62ch] text-base leading-7 text-slate-600">{release.summary}</p>}

                            <div className="mt-4 space-y-4">
                                {groupedItems.map((group, groupIndex) => (
                                    <div key={`${release.id}-${group.typeKey}-${group.typeLabel}-${groupIndex}`}>
                                        <ReleasePill item={group.items[0]} />
                                        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700 marker:text-slate-400">
                                            {group.items.map((item, itemIndex) => (
                                                <li key={`${release.id}-${group.typeKey}-${group.typeLabel}-${itemIndex}`}>{item.text}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </article>
                    );
                })}
            </section>
        </MarketingLayout>
    );
};
