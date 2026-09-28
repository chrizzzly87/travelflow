import { Archive, Check, History, Lock, MessageCirclePlus, Sparkles, X } from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import {
    archiveTripAgentThread,
    createTripAgentThread,
    readTripAgentError,
    type TripAgentBootstrap,
} from '../../services/tripAgentService';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { TripAgentChatSkeleton } from './TripAgentChatSkeleton';
import type { TripAgentPanelProps } from './tripAgentPanelTypes';
import {
    loadTripAgentBootstrapForPanel,
    loadTripAgentChatSessionModule,
    readCachedTripAgentBootstrap,
} from './tripAgentPrefetch';
import { formatTripAgentTimestamp, groupTripAgentThreads } from './tripAgentTime';
import { useMinuteTick } from './useMinuteTick';

export type { TripAgentPanelProps } from './tripAgentPanelTypes';

// The panel frame ships with the planner so it opens on the click; the chat,
// with the AI SDK and its renderers, streams in behind a skeleton.
const TripAgentChatSession = lazy(() => loadLazyComponentWithRecovery(
    'TripAgentChatSession',
    () => loadTripAgentChatSessionModule().then((module) => ({ default: module.TripAgentChatSession })),
));

/** Enough to tell whether a remembered chat is still the one on the server. */
const bootstrapSignature = (bootstrap: TripAgentBootstrap): string => (
    `${bootstrap.currentThreadId || ''}:${bootstrap.messages.length}:${bootstrap.messages.at(-1)?.id || ''}`
);

export const TripAgentPanel: React.FC<TripAgentPanelProps> = ({
    trip,
    contextRefs,
    isOpen,
    onClose,
    onAdoptCommittedTripVersion,
    onPreviewTrip,
    onRevertAgentChange,
    onReapplyAgentChange,
}) => {
    const { t, i18n } = useTranslation('common');
    const now = useMinuteTick();
    // A reopen paints the chat this page last saw, then checks it is current.
    const [cachedBootstrap] = useState(() => readCachedTripAgentBootstrap(trip.id));
    const [bootstrap, setBootstrap] = useState<TripAgentBootstrap | null>(cachedBootstrap);
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(cachedBootstrap?.currentThreadId ?? null);
    const [isRevalidating, setIsRevalidating] = useState(Boolean(cachedBootstrap));
    const [sessionRevision, setSessionRevision] = useState(0);
    const [loadError, setLoadError] = useState<{ code: string } | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    const panelRef = useRef<HTMLElement | null>(null);
    const launcherRef = useRef<Element | null>(null);
    const initialFocusRef = useRef<HTMLElement | null>(null);
    const requestSeqRef = useRef(0);
    const isShowingCacheRef = useRef(Boolean(cachedBootstrap));

    useEffect(() => {
        if (!isOpen) return;
        launcherRef.current = document.activeElement;
        // The prompt field arrives with the chat chunk; until then focus sits
        // on the first live control, and moves on once the field exists.
        const firstField = panelRef.current?.querySelector<HTMLElement>('textarea, button:not([disabled])') || null;
        initialFocusRef.current = firstField;
        firstField?.focus();
        return () => {
            // Send focus back where it came from, so closing does not drop the
            // reader at the top of the document.
            const launcher = launcherRef.current as HTMLElement | null;
            if (launcher?.isConnected) launcher.focus();
        };
    }, [isOpen]);

    const handleSessionReady = useCallback(() => {
        const initial = initialFocusRef.current;
        if (!initial || document.activeElement !== initial) return;
        initialFocusRef.current = null;
        panelRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }, []);

    const handlePanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab' || !panelRef.current) return;
        const focusable = (Array.from(panelRef.current.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )) as HTMLElement[]).filter((element) => element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
    }, [onClose]);

    /**
     * Loads a thread, or the trip's default one for `null`. Only the latest
     * request may write state, so a slow answer never replaces a newer one.
     */
    const refresh = useCallback(async (threadId: string | null) => {
        const seq = ++requestSeqRef.current;
        try {
            let next = await loadTripAgentBootstrapForPanel(trip.id, threadId);
            if (!next.currentThreadId) {
                // A server that predates `ensureThread` answers without one.
                const created = await createTripAgentThread(trip.id);
                next = await loadTripAgentBootstrapForPanel(trip.id, created.id);
            }
            if (seq !== requestSeqRef.current) return;
            if (isShowingCacheRef.current && cachedBootstrap
                && bootstrapSignature(cachedBootstrap) !== bootstrapSignature(next)) {
                // The remembered chat is out of date; restart it on the real one.
                setSessionRevision((revision) => revision + 1);
            }
            isShowingCacheRef.current = false;
            setBootstrap(next);
            setCurrentThreadId(next.currentThreadId);
            setLoadError(null);
        } catch (error) {
            if (seq !== requestSeqRef.current) return;
            // The code is localized here; server text is never shown verbatim.
            setLoadError({ code: readTripAgentError(error).code });
        } finally {
            if (seq === requestSeqRef.current) setIsRevalidating(false);
        }
    }, [cachedBootstrap, trip.id]);

    // One load per open. Closing, or switching trips, orphans the request.
    useEffect(() => {
        if (!isOpen) return;
        void refresh(null);
        return () => {
            requestSeqRef.current += 1;
        };
    }, [isOpen, refresh]);

    const selectThread = async (threadId: string) => {
        setCurrentThreadId(threadId);
        await refresh(threadId);
    };

    const archiveThread = async (threadId: string) => {
        await archiveTripAgentThread(trip.id, threadId).catch(() => undefined);
        trackEvent('trip_agent__thread--archive', { trip_id: trip.id, thread_id: threadId });
        await refresh(threadId === currentThreadId ? null : currentThreadId);
    };

    const createThread = async () => {
        setIsHistoryOpen(false);
        const thread = await createTripAgentThread(trip.id);
        trackEvent('trip_agent__thread--create', { trip_id: trip.id });
        await selectThread(thread.id);
    };

    const currentThread = bootstrap?.threads.find((thread) => thread.id === currentThreadId) || null;
    const changeSetStatuses = useMemo(() => Object.fromEntries(
        (bootstrap?.changeSets || []).map((entry) => [
            entry.id,
            {
                status: entry.status,
                appliedOperationIds: entry.appliedOperationIds,
                appliedVersionId: entry.appliedVersionId,
            },
        ]),
    ), [bootstrap?.changeSets]);
    const threadSections = useMemo(
        () => groupTripAgentThreads(bootstrap?.threads || [], now),
        [bootstrap?.threads, now],
    );

    return (
        <>
            {/* Mobile renders as a sheet over the planner, so it is a dialog:
                it takes focus, keeps it, closes on Escape, and hands focus back.
                While a preview is showing, the planner behind it must stay
                visible and usable to look at. */}
            {!isPreviewActive && (
                <div
                    className="fixed inset-0 z-[1490] bg-slate-950/20 sm:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={t('tripAgent.title')}
                className={`trip-agent-panel-enter fixed inset-x-0 bottom-0 z-[1500] flex flex-col overflow-hidden rounded-t-[1.5rem] border border-border bg-card shadow-[0_-24px_80px_rgba(15,23,42,0.18)] transition-[height] duration-200 sm:inset-x-auto sm:bottom-4 sm:end-4 sm:h-[min(720px,calc(100dvh-2rem))] sm:w-[420px] sm:rounded-[1.5rem] sm:shadow-2xl ${
                    isPreviewActive ? 'h-[min(42dvh,340px)]' : 'h-[min(82dvh,720px)]'
                }`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                onKeyDown={handlePanelKeyDown}
            >
            <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                <div aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background"><Sparkles className="size-4" /></div>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-foreground">{t('tripAgent.title')}</h2>
                    <p className="truncate text-xs text-muted-foreground">
                        {currentThread ? currentThread.title : t('tripAgent.subtitle')}
                    </p>
                </div>
                {isRevalidating && (
                    <Spinner className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!bootstrap}
                    onClick={() => setIsHistoryOpen((current) => !current)}
                    aria-label={t('tripAgent.history')}
                    title={t('tripAgent.history')}
                    aria-expanded={isHistoryOpen}
                >
                    <History className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!bootstrap}
                    onClick={() => void createThread()}
                    aria-label={t('tripAgent.newChat')}
                    title={t('tripAgent.newChat')}
                >
                    <MessageCirclePlus className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    aria-label={t('tripAgent.close')}
                    {...getAnalyticsDebugAttributes('trip_agent__panel--close', { trip_id: trip.id })}
                >
                    <X className="size-4" />
                </Button>
            </header>
            {isHistoryOpen ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {threadSections.length === 0 && (
                        <p className="px-1 py-4 text-center text-xs text-muted-foreground">{t('tripAgent.historyEmpty')}</p>
                    )}
                    {threadSections.map((section) => (
                        <section key={section.key} className="mb-3">
                            <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {t(`tripAgent.historySections.${section.key}`)}
                            </h3>
                            <ul className="space-y-1">
                                {section.threads.map((thread) => (
                                    <li key={thread.id}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsHistoryOpen(false);
                                                void selectThread(thread.id);
                                            }}
                                            aria-current={thread.id === currentThreadId ? 'true' : undefined}
                                            className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-start outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                                                thread.id === currentThreadId
                                                    ? 'border-accent-200 bg-accent-50 dark:bg-accent-400/12 dark:border-accent-400/30'
                                                    : 'border-border hover:bg-secondary'
                                            }`}
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm text-foreground">{thread.title}</span>
                                                <span className="block text-[11px] text-muted-foreground">
                                                    {formatTripAgentTimestamp(thread.updatedAt, i18n.language, now)}
                                                </span>
                                            </span>
                                            {thread.id === currentThreadId && <Check className="mt-0.5 size-3.5 text-accent-600 dark:text-accent-300" />}
                                            {thread.status === 'archived' && <Archive className="mt-0.5 size-3.5 text-muted-foreground" />}
                                        </button>
                                        {thread.status === 'active' && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                onClick={() => void archiveThread(thread.id)}
                                                className="mt-0.5 w-full justify-start rounded-lg px-2.5 text-[11px] font-normal text-muted-foreground hover:bg-secondary hover:text-foreground dark:hover:bg-secondary"
                                            >
                                                {t('tripAgent.archive')}
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {section.hiddenCount > 0 && (
                                <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                                    {t('tripAgent.historyHidden', { count: section.hiddenCount })}
                                </p>
                            )}
                        </section>
                    ))}
                </div>
            ) : loadError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <Lock className="size-6 text-amber-600" />
                    <p className="text-sm text-foreground">
                        {t([`tripAgent.errors.${loadError.code}`, 'tripAgent.errors.TRIP_AGENT_REQUEST_FAILED'])}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => void refresh(currentThreadId)}>{t('tripAgent.retry')}</Button>
                </div>
            ) : currentThread && bootstrap ? (
                <Suspense fallback={<TripAgentChatSkeleton />}>
                    <TripAgentChatSession
                        key={`${currentThread.id}:${sessionRevision}`}
                        trip={trip}
                        thread={currentThread}
                        initialMessages={bootstrap.messages}
                        contextRefs={contextRefs}
                        quota={bootstrap.quota}
                        actorId={bootstrap.actor.userId}
                        changeSetStatuses={changeSetStatuses}
                        onQuotaMayHaveChanged={() => void refresh(currentThread.id)}
                        onAdoptCommittedTripVersion={onAdoptCommittedTripVersion}
                        onPreviewTrip={onPreviewTrip}
                        onPreviewActiveChange={setIsPreviewActive}
                        onRevertAgentChange={onRevertAgentChange}
                        onReapplyAgentChange={onReapplyAgentChange}
                        onReady={handleSessionReady}
                    />
                </Suspense>
            ) : (
                <TripAgentChatSkeleton />
            )}
            </aside>
        </>
    );
};
