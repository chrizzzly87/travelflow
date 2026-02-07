import React, { useMemo } from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { ReleasePill } from '../components/marketing/ReleasePill';
import { getPublishedReleaseNotes, getWebsiteVisibleItems } from '../services/releaseNotesService';

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

    return (
        <MarketingLayout>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">News & Updates</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                    Product updates are published from markdown release files during deploy. Each item can be toggled visible or hidden for marketing output.
                </p>
            </section>

            <section className="mt-6 space-y-4">
                {releases.length === 0 && (
                    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm text-slate-600">No published updates yet.</p>
                    </article>
                )}

                {releases.map((release) => {
                    const visibleItems = getWebsiteVisibleItems(release);
                    if (visibleItems.length === 0) return null;

                    return (
                        <article key={release.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900">{release.title}</h2>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                            {release.version}
                                        </span>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                            {formatReleaseDate(release.publishedAt || release.date)}
                                        </p>
                                    </div>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {visibleItems.length} highlights
                                </span>
                            </div>

                            {release.summary && <p className="mt-3 text-sm leading-6 text-slate-600">{release.summary}</p>}

                            <ul className="mt-4 space-y-2">
                                {visibleItems.map((item, index) => (
                                    <li key={`${release.id}-${item.typeKey}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                                        <ReleasePill item={item} />
                                        <span className="pt-0.5 text-sm leading-6 text-slate-700">{item.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    );
                })}
            </section>
        </MarketingLayout>
    );
};
