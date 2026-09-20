import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Not `releaseNotesService`: that module's eager glob bundles every release note
// ever written (444 KB) and the trip view mounts this dialog on every visit.
import { getLatestInAppRelease } from '../services/latestInAppRelease';
import { getWebsiteVisibleItems, groupReleaseItemsByType } from '../services/releaseNotesFormat';
import { ReleasePill } from './marketing/ReleasePill';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
    readLocalStorageItem,
    writeLocalStorageItem,
} from '../services/browserStorageService';

const RELEASE_NOTICE_DISMISSED_KEY = 'tf_release_notice_dismissed_release_id';

export interface ReleaseNoticeDialogProps {
    enabled: boolean;
}

export const ReleaseNoticeDialog: React.FC<ReleaseNoticeDialogProps> = ({ enabled }) => {
    const latestInAppRelease = useMemo(() => getLatestInAppRelease(), []);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const dismissButtonRef = useRef<HTMLButtonElement | null>(null);
    const [dismissedReleaseId, setDismissedReleaseId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        try {
            return readLocalStorageItem(RELEASE_NOTICE_DISMISSED_KEY);
        } catch {
            return null;
        }
    });

    const latestReleaseItems = useMemo(() => {
        if (!latestInAppRelease) return [];
        return getWebsiteVisibleItems(latestInAppRelease).slice(0, 3);
    }, [latestInAppRelease]);
    const latestReleaseGroups = useMemo(() => groupReleaseItemsByType(latestReleaseItems), [latestReleaseItems]);

    const dismissReleaseNotice = useCallback(() => {
        if (!latestInAppRelease) return;
        setDismissedReleaseId(latestInAppRelease.id);
        if (typeof window === 'undefined') return;
        try {
            writeLocalStorageItem(RELEASE_NOTICE_DISMISSED_KEY, latestInAppRelease.id);
        } catch {
            // ignore storage issues
        }
    }, [latestInAppRelease]);

    const isNoticeOpen = enabled && Boolean(latestInAppRelease) && dismissedReleaseId !== latestInAppRelease.id;

    useFocusTrap({
        isActive: isNoticeOpen,
        containerRef: dialogRef,
        initialFocusRef: dismissButtonRef,
    });

    if (!isNoticeOpen || !latestInAppRelease) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[1650] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="release-update-title">
            <button
                type="button"
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
                aria-label="Close release update"
                onClick={dismissReleaseNotice}
            />
            <div ref={dialogRef} className="relative w-full max-w-lg rounded-3xl border border-accent-100 bg-card shadow-2xl">
                <div className="rounded-t-3xl border-b border-border bg-gradient-to-r from-accent-50 to-accent-100 px-6 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-200">
                        Latest release · {latestInAppRelease.version}
                    </p>
                    <h2 id="release-update-title" className="mt-2 text-xl font-black text-foreground">
                        {latestInAppRelease.title}
                    </h2>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {new Date(latestInAppRelease.publishedAt).toLocaleDateString()}
                    </p>
                </div>
                <div className="px-6 py-5">
                    {latestInAppRelease.summary && (
                        <div className="text-sm leading-6 text-foreground">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ node, ...props }) => <p {...props} className="m-0" />,
                                    a: ({ node, children, ...props }) => (
                                        <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800 dark:text-accent-200 dark:hover:text-accent-200 dark:hover:text-accent-300">{children}</a>
                                    ),
                                    code: ({ node, ...props }) => (
                                        <code {...props} className="rounded bg-secondary px-1 py-0.5 text-[0.92em] text-foreground" />
                                    ),
                                }}
                            >
                                {latestInAppRelease.summary}
                            </ReactMarkdown>
                        </div>
                    )}
                    {latestReleaseGroups.length > 0 && (
                        <div className="mt-3 space-y-3">
                            {latestReleaseGroups.map((group, groupIndex) => (
                                <div key={`${latestInAppRelease.id}-notice-group-${group.typeKey}-${group.typeLabel}-${groupIndex}`}>
                                    <ReleasePill item={group.items[0]} />
                                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground marker:text-muted-foreground">
                                        {group.items.map((item, itemIndex) => (
                                            <li key={`${latestInAppRelease.id}-notice-item-${group.typeKey}-${group.typeLabel}-${itemIndex}`}>
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({ node, ...props }) => <p {...props} className="m-0" />,
                                                        a: ({ node, children, ...props }) => (
                                                            <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800 dark:text-accent-200 dark:hover:text-accent-200 dark:hover:text-accent-300">{children}</a>
                                                        ),
                                                        code: ({ node, ...props }) => (
                                                            <code {...props} className="rounded bg-secondary px-1 py-0.5 text-[0.92em] text-foreground" />
                                                        ),
                                                    }}
                                                >
                                                    {item.text}
                                                </ReactMarkdown>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
                    <Link
                        to="/updates"
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-slate-400"
                    >
                        View full changelog
                    </Link>
                    <button
                        ref={dismissButtonRef}
                        type="button"
                        onClick={dismissReleaseNotice}
                        className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};
