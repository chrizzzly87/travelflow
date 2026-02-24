import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { ReleasePill } from '../components/marketing/ReleasePill';
import { getPublishedReleaseNotes, getWebsiteVisibleItems, groupReleaseItemsByType } from '../services/releaseNotesService';
import { readLocalStorageItem } from '../services/browserStorageService';

const SIMULATED_LOGIN_STORAGE_KEY = 'tf_debug_simulated_login';
const SIMULATED_LOGIN_DEBUG_EVENT = 'tf:simulated-login-debug';
const DEBUGGER_STATE_DEBUG_EVENT = 'tf:on-page-debugger-state';

interface SimulatedLoginDebugDetail {
    available: boolean;
    loggedIn: boolean;
}

interface DebuggerStateDebugDetail {
    available: boolean;
    open: boolean;
}

type DebuggerHost = Window & {
    onPageDebugger?: {
        getState: () => { open: boolean; tracking: boolean };
    };
    getSimulatedLogin?: () => boolean;
};

const formatReleaseDate = (dateLike: string) => {
    const parsed = new Date(dateLike);
    if (Number.isNaN(parsed.getTime())) return dateLike;

    return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const readStoredBoolean = (storageKey: string, fallbackValue: boolean): boolean => {
    if (typeof window === 'undefined') return fallbackValue;
    try {
        const raw = readLocalStorageItem(storageKey);
        if (raw === '1') return true;
        if (raw === '0') return false;
        return fallbackValue;
    } catch {
        return fallbackValue;
    }
};

const readInitialDebuggerOpen = (): boolean => {
    if (typeof window === 'undefined') return false;
    const host = window as DebuggerHost;
    return Boolean(host.onPageDebugger?.getState()?.open);
};

const readInitialSimulatedLogin = (): boolean => {
    if (typeof window === 'undefined') return false;
    const host = window as DebuggerHost;
    if (typeof host.getSimulatedLogin === 'function') {
        return Boolean(host.getSimulatedLogin());
    }
    return readStoredBoolean(SIMULATED_LOGIN_STORAGE_KEY, false);
};

export const UpdatesPage: React.FC = () => {
    const { t } = useTranslation('pages');
    const releases = useMemo(() => getPublishedReleaseNotes(), []);
    const [isDebuggerOpen, setIsDebuggerOpen] = useState<boolean>(() => readInitialDebuggerOpen());
    const [isSimulatedLoggedIn, setIsSimulatedLoggedIn] = useState<boolean>(() => readInitialSimulatedLogin());
    const showInternalNews = isDebuggerOpen || isSimulatedLoggedIn;

    useEffect(() => {
        const syncFromHost = () => {
            const host = window as DebuggerHost;
            setIsDebuggerOpen(Boolean(host.onPageDebugger?.getState()?.open));
            if (typeof host.getSimulatedLogin === 'function') {
                setIsSimulatedLoggedIn(Boolean(host.getSimulatedLogin()));
                return;
            }
            setIsSimulatedLoggedIn(readStoredBoolean(SIMULATED_LOGIN_STORAGE_KEY, false));
        };

        const handleDebuggerState = (event: Event) => {
            const detail = (event as CustomEvent<DebuggerStateDebugDetail>).detail;
            if (!detail?.available) {
                setIsDebuggerOpen(false);
                return;
            }
            setIsDebuggerOpen(Boolean(detail.open));
        };

        const handleSimulatedLoginState = (event: Event) => {
            const detail = (event as CustomEvent<SimulatedLoginDebugDetail>).detail;
            if (!detail?.available) {
                setIsSimulatedLoggedIn(false);
                return;
            }
            setIsSimulatedLoggedIn(Boolean(detail.loggedIn));
        };

        syncFromHost();

        window.addEventListener(DEBUGGER_STATE_DEBUG_EVENT, handleDebuggerState as EventListener);
        window.addEventListener(SIMULATED_LOGIN_DEBUG_EVENT, handleSimulatedLoginState as EventListener);
        return () => {
            window.removeEventListener(DEBUGGER_STATE_DEBUG_EVENT, handleDebuggerState as EventListener);
            window.removeEventListener(SIMULATED_LOGIN_DEBUG_EVENT, handleSimulatedLoginState as EventListener);
        };
    }, []);

    const releaseEntries = useMemo(
        () =>
            releases.flatMap((release) => {
                const visibleItems = showInternalNews ? release.items : getWebsiteVisibleItems(release);
                if (visibleItems.length === 0) return [];
                return [{ release, groupedItems: groupReleaseItemsByType(visibleItems) }];
            }),
        [releases, showInternalNews]
    );

    return (
        <MarketingLayout>
            <section className="pt-5 pb-10 text-center md:pb-12">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{t('updates.title')}</h1>
            </section>

            <section className="mt-2 space-y-4">
                {showInternalNews && (
                    <article className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm">
                        <p className="text-sm font-medium text-rose-800">Internal view enabled. Hidden release items are visible.</p>
                    </article>
                )}

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

                            {release.summary && (
                                <div className="mt-3 max-w-[62ch] text-base leading-7 text-slate-600">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }) => <p {...props} className="m-0" />,
                                            a: ({ node, ...props }) => (
                                                <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800" />
                                            ),
                                            code: ({ node, ...props }) => (
                                                <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-800" />
                                            ),
                                        }}
                                    >
                                        {release.summary}
                                    </ReactMarkdown>
                                </div>
                            )}

                            <div className="mt-4 space-y-4">
                                {groupedItems.map((group, groupIndex) => (
                                    <div key={`${release.id}-${group.typeKey}-${group.typeLabel}-${groupIndex}`}>
                                        <ReleasePill item={group.items[0]} />
                                        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700 marker:text-slate-400">
                                            {group.items.map((item, itemIndex) => (
                                                <li key={`${release.id}-${group.typeKey}-${group.typeLabel}-${itemIndex}`}>
                                                    <div className="flex flex-wrap items-start gap-2">
                                                        {item.typeKey === 'internal' && (
                                                            <span className="mt-0.5 inline-flex shrink-0 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                                                                Internal
                                                            </span>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm]}
                                                                components={{
                                                                    p: ({ node, ...props }) => <p {...props} className="m-0" />,
                                                                    a: ({ node, ...props }) => (
                                                                        <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800" />
                                                                    ),
                                                                    code: ({ node, ...props }) => (
                                                                        <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-800" />
                                                                    ),
                                                                }}
                                                            >
                                                                {item.text}
                                                            </ReactMarkdown>
                                                        </div>
                                                    </div>
                                                </li>
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
