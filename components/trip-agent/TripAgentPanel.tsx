import { Archive, ArrowLeft, Check, ChevronDown, ChevronRight, Lock, MessageCirclePlus, RotateCcw, X } from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import {
    archiveTripAgentThread,
    createTripAgentThread,
    readTripAgentError,
    restoreTripAgentThread,
    type TripAgentBootstrap,
    type TripAgentThread,
} from '../../services/tripAgentService';
import { Button } from '../ui/button';
import { SearchInput } from '../ui/search-input';
import { Spinner } from '../ui/spinner';
import { TripAgentChatSkeleton } from './TripAgentChatSkeleton';
import {
    readTripAgentSessionThread,
    TRIP_AGENT_DRAFT_SESSION_VALUE,
    writeTripAgentSessionThread,
} from './tripAgentPanelState';
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

const RECENT_CHAT_LIMIT = 3;

const PANEL_FRAME_CLASS = 'trip-agent-panel-enter fixed inset-x-0 bottom-0 z-[1650] flex flex-col overflow-hidden rounded-t-[1.5rem] border border-border bg-card shadow-[0_-24px_80px_rgba(15,23,42,0.18)] transition-[height] duration-200 sm:inset-x-auto sm:bottom-4 sm:end-4 sm:h-[min(720px,calc(100dvh-2rem))] sm:w-[420px] sm:rounded-[1.5rem] sm:shadow-2xl';

/**
 * The panel's frame without any text, shown for the moment the chat's own
 * translations are still loading, so the click still opens something at once.
 */
export const TripAgentPanelFallback: React.FC = () => (
    <div
        aria-busy="true"
        className={`${PANEL_FRAME_CLASS} h-[min(82dvh,720px)]`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3.5">
            <span className="h-3.5 w-32 rounded-full bg-secondary motion-safe:animate-pulse" />
        </div>
        <div className="flex-1" />
    </div>
);

/** Enough to tell whether a remembered chat is still the one on the server. */
const bootstrapSignature = (bootstrap: TripAgentBootstrap): string => (
    `${bootstrap.currentThreadId || ''}:${bootstrap.messages.length}:${bootstrap.messages.at(-1)?.id || ''}`
);

const newThreadId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    // RFC 4122 v4 shape, for the rare browser without randomUUID.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        return (char === 'x' ? random : (random % 4) + 8).toString(16);
    });
};

/**
 * A chat that exists only in this browser until its first message. Opening a
 * new chat therefore never waits for the server, and unused ones leave no
 * empty entries behind in the history.
 */
const createDraftThread = (tripId: string): TripAgentThread => {
    const now = new Date().toISOString();
    return {
        id: newThreadId(),
        tripId,
        title: '',
        status: 'active',
        createdBy: '',
        createdAt: now,
        updatedAt: now,
    };
};

const EMPTY_QUOTA = { enabled: false, limit: null, used: 0, remaining: null, resetsAt: new Date(0).toISOString() };

type HistoryView = 'closed' | 'chats' | 'archived';

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
    const { t, i18n } = useTranslation('tripAgent');
    const now = useMinuteTick();
    // A new tab session starts with a fresh chat; within a session the panel
    // returns to the chat that was open.
    const [initial] = useState(() => {
        const sessionThreadId = readTripAgentSessionThread(trip.id);
        const resumeThreadId = sessionThreadId && sessionThreadId !== TRIP_AGENT_DRAFT_SESSION_VALUE
            ? sessionThreadId
            : null;
        return {
            resumeThreadId,
            draft: resumeThreadId ? null : createDraftThread(trip.id),
            // A reopen paints the chats this page last saw, then checks them.
            cachedBootstrap: readCachedTripAgentBootstrap(trip.id),
        };
    });
    const { cachedBootstrap } = initial;
    const [bootstrap, setBootstrap] = useState<TripAgentBootstrap | null>(cachedBootstrap);
    const [draft, setDraft] = useState<TripAgentThread | null>(initial.draft);
    const [currentThreadId, setCurrentThreadId] = useState<string>(
        () => initial.draft?.id ?? initial.resumeThreadId ?? '',
    );
    const [isRevalidating, setIsRevalidating] = useState(Boolean(cachedBootstrap));
    const [sessionRevision, setSessionRevision] = useState(0);
    const [loadError, setLoadError] = useState<{ code: string } | null>(null);
    const [historyView, setHistoryView] = useState<HistoryView>('closed');
    const [historyQuery, setHistoryQuery] = useState('');
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    // Drafts whose first message has gone out; they count as used chats.
    const [sentDraftIds, setSentDraftIds] = useState<ReadonlySet<string>>(() => new Set());
    const panelRef = useRef<HTMLElement | null>(null);
    const switcherRef = useRef<HTMLButtonElement | null>(null);
    const launcherRef = useRef<Element | null>(null);
    const initialFocusRef = useRef<HTMLElement | null>(null);
    const requestSeqRef = useRef(0);
    const isShowingCacheRef = useRef(Boolean(cachedBootstrap && initial.resumeThreadId));
    // Drafts this panel made, and the save each one started when first used.
    const draftIdsRef = useRef(new Set<string>(initial.draft ? [initial.draft.id] : []));
    const draftSavesRef = useRef(new Map<string, Promise<void>>());

    const isHistoryOpen = historyView !== 'closed';
    const savedThread = bootstrap?.threads.find((thread) => thread.id === currentThreadId) || null;
    const currentThread = savedThread || (draft && draft.id === currentThreadId ? draft : null);
    const isUntouchedDraft = Boolean(currentThread && !savedThread && !sentDraftIds.has(currentThread.id));
    // Messages only belong to the chat they were loaded for; a draft that was
    // never saved has none, and a sent draft keeps its own in the session.
    const currentMessages = currentThread && !savedThread
        ? []
        : bootstrap && bootstrap.currentThreadId === currentThreadId ? bootstrap.messages : null;

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

    const focusPrompt = useCallback(() => {
        panelRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }, []);

    const handleSessionReady = useCallback(() => {
        const initialFocus = initialFocusRef.current;
        if (!initialFocus || document.activeElement !== initialFocus) return;
        initialFocusRef.current = null;
        focusPrompt();
    }, [focusPrompt]);

    const closeHistory = useCallback(() => {
        setHistoryView('closed');
        setHistoryQuery('');
        // Back on the chat, the reader continues where the switcher was.
        requestAnimationFrame(() => switcherRef.current?.focus());
    }, []);

    const handlePanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            // An open list inside the chat handles its own Escape first.
            if (event.defaultPrevented) return;
            event.stopPropagation();
            // Escape steps back one level: out of history first, then the panel.
            if (isHistoryOpen) closeHistory();
            else onClose();
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
    }, [closeHistory, isHistoryOpen, onClose]);

    const startDraft = useCallback(() => {
        const next = createDraftThread(trip.id);
        draftIdsRef.current.add(next.id);
        setDraft(next);
        setCurrentThreadId(next.id);
        writeTripAgentSessionThread(trip.id, TRIP_AGENT_DRAFT_SESSION_VALUE);
    }, [trip.id]);

    /**
     * Loads the trip's chats. With `adopt`, the answer also decides which chat
     * is open (the one asked for, or the most recent for `null`); without it,
     * a draft stays open while the list and quota arrive behind it. Only the
     * latest request may write state, so a slow answer never wins.
     */
    const refresh = useCallback(async (threadId: string | null, adopt: boolean) => {
        const seq = ++requestSeqRef.current;
        try {
            const next = await loadTripAgentBootstrapForPanel(trip.id, threadId);
            if (seq !== requestSeqRef.current) return;
            if (adopt) {
                if (isShowingCacheRef.current && cachedBootstrap
                    && bootstrapSignature(cachedBootstrap) !== bootstrapSignature(next)) {
                    // The remembered chat is out of date; restart it on the real one.
                    setSessionRevision((revision) => revision + 1);
                }
                if (next.currentThreadId) {
                    setCurrentThreadId(next.currentThreadId);
                    writeTripAgentSessionThread(trip.id, next.currentThreadId);
                } else {
                    // The chat this tab remembered is gone (archived elsewhere).
                    startDraft();
                }
            }
            isShowingCacheRef.current = false;
            setBootstrap(next);
            setLoadError(null);
        } catch (error) {
            if (seq !== requestSeqRef.current) return;
            // The code is localized here; server text is never shown verbatim.
            setLoadError({ code: readTripAgentError(error).code });
        } finally {
            if (seq === requestSeqRef.current) setIsRevalidating(false);
        }
    }, [cachedBootstrap, startDraft, trip.id]);

    // One load per open. Closing, or switching trips, orphans the request.
    useEffect(() => {
        if (!isOpen) return;
        void refresh(initial.resumeThreadId, Boolean(initial.resumeThreadId));
        return () => {
            requestSeqRef.current += 1;
        };
    }, [initial.resumeThreadId, isOpen, refresh]);

    /** Saves a draft the first time something is sent from it. */
    const ensureThreadSaved = useCallback((threadId: string): Promise<void> => {
        if (!draftIdsRef.current.has(threadId)) return Promise.resolve();
        const pending = draftSavesRef.current.get(threadId);
        if (pending) return pending;
        setSentDraftIds((current) => new Set(current).add(threadId));
        const save = createTripAgentThread(trip.id, threadId).then(() => {
            trackEvent('trip_agent__thread--create', { trip_id: trip.id });
            writeTripAgentSessionThread(trip.id, threadId);
        });
        // A failed save may be tried again by resending the message.
        save.catch(() => draftSavesRef.current.delete(threadId));
        draftSavesRef.current.set(threadId, save);
        return save;
    }, [trip.id]);

    const openChat = useCallback((threadId: string) => {
        setHistoryView('closed');
        setHistoryQuery('');
        if (threadId === currentThreadId) return;
        setCurrentThreadId(threadId);
        writeTripAgentSessionThread(trip.id, threadId);
        void refresh(threadId, true);
    }, [currentThreadId, refresh, trip.id]);

    const handleNewChat = () => {
        setHistoryView('closed');
        setHistoryQuery('');
        trackEvent('trip_agent__thread--new', { trip_id: trip.id });
        // An untouched draft is already a new chat.
        if (!isUntouchedDraft) startDraft();
        requestAnimationFrame(focusPrompt);
    };

    const setThreadStatus = (threadId: string, status: TripAgentThread['status']) => {
        setBootstrap((current) => current && ({
            ...current,
            threads: current.threads.map((thread) => (thread.id === threadId ? { ...thread, status } : thread)),
        }));
    };

    const archiveThread = async (threadId: string) => {
        setThreadStatus(threadId, 'archived');
        if (threadId === currentThreadId) startDraft();
        trackEvent('trip_agent__thread--archive', { trip_id: trip.id, thread_id: threadId });
        try {
            await archiveTripAgentThread(trip.id, threadId);
        } catch {
            setThreadStatus(threadId, 'active');
        }
    };

    const restoreThread = async (threadId: string) => {
        setThreadStatus(threadId, 'active');
        trackEvent('trip_agent__thread--restore', { trip_id: trip.id, thread_id: threadId });
        try {
            await restoreTripAgentThread(trip.id, threadId);
        } catch {
            setThreadStatus(threadId, 'archived');
        }
    };

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
    const threads = bootstrap?.threads;
    const activeThreads = useMemo(
        () => (threads || []).filter((thread) => thread.status === 'active'),
        [threads],
    );
    const archivedThreads = useMemo(
        () => (threads || []).filter((thread) => thread.status === 'archived'),
        [threads],
    );
    const recentChats = useMemo(
        () => activeThreads.filter((thread) => thread.id !== currentThreadId).slice(0, RECENT_CHAT_LIMIT),
        [activeThreads, currentThreadId],
    );
    const normalizedQuery = historyQuery.trim().toLocaleLowerCase(i18n.language);
    const visibleThreads = useMemo(() => {
        const pool = historyView === 'archived' ? archivedThreads : activeThreads;
        if (!normalizedQuery) return pool;
        return pool.filter((thread) => thread.title.toLocaleLowerCase(i18n.language).includes(normalizedQuery));
    }, [activeThreads, archivedThreads, historyView, i18n.language, normalizedQuery]);
    const threadSections = useMemo(
        () => groupTripAgentThreads(visibleThreads, now),
        [now, visibleThreads],
    );
    const threadTitle = (thread: TripAgentThread): string => thread.title || t('newChat');

    const renderThreadRow = (thread: TripAgentThread) => {
        const isArchived = thread.status === 'archived';
        const isCurrent = thread.id === currentThreadId;
        return (
            <li key={thread.id} className="group relative">
                {isArchived ? (
                    <div className="flex items-center gap-2 rounded-lg py-2 ps-2.5 pe-28">
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{threadTitle(thread)}</span>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => openChat(thread.id)}
                        aria-current={isCurrent ? 'true' : undefined}
                        className={`flex w-full items-center gap-2 rounded-lg py-2 ps-2.5 pe-20 text-start outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                            isCurrent
                                ? 'bg-accent-50 dark:bg-accent-400/12'
                                : 'hover:bg-secondary'
                        }`}
                    >
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{threadTitle(thread)}</span>
                        {isCurrent && <Check aria-hidden="true" className="size-3.5 shrink-0 text-accent-600 dark:text-accent-300" />}
                    </button>
                )}
                {/* Actions sit inside the row. With a mouse they show on hover
                    or keyboard focus; on touch there is no hover, so they stay. */}
                <div className="pointer-events-none absolute inset-y-0 end-1.5 flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground [@media(hover:hover)]:group-hover:hidden [@media(hover:hover)]:group-focus-within:hidden">
                        {formatTripAgentTimestamp(thread.updatedAt, i18n.language, now)}
                    </span>
                    {isArchived ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => void restoreThread(thread.id)}
                            className="pointer-events-auto text-[11px] font-normal opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                            {...getAnalyticsDebugAttributes('trip_agent__thread--restore', { trip_id: trip.id })}
                        >
                            <RotateCcw aria-hidden="true" className="size-3" />
                            {t('restoreChat')}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void archiveThread(thread.id)}
                            aria-label={t('archive')}
                            title={t('archive')}
                            className="pointer-events-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                            {...getAnalyticsDebugAttributes('trip_agent__thread--archive', { trip_id: trip.id })}
                        >
                            <Archive aria-hidden="true" className="size-3.5" />
                        </Button>
                    )}
                </div>
            </li>
        );
    };

    const renderLoadError = (code: string) => (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Lock className="size-6 text-amber-600" />
            <p className="text-sm text-foreground">
                {t([`errors.${code}`, 'errors.TRIP_AGENT_REQUEST_FAILED'])}
            </p>
            <Button
                size="sm"
                variant="outline"
                onClick={() => void refresh(savedThread || !currentThread ? currentThreadId || null : null, Boolean(savedThread || !currentThread))}
            >
                {t('retry')}
            </Button>
        </div>
    );

    const renderHistory = () => {
        if (!bootstrap) return loadError ? renderLoadError(loadError.code) : <TripAgentChatSkeleton />;
        return (
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 px-3 pt-3">
                    <SearchInput
                        value={historyQuery}
                        onChange={(event) => setHistoryQuery(event.currentTarget.value)}
                        onClear={() => setHistoryQuery('')}
                        placeholder={t('searchChats')}
                        aria-label={t('searchChats')}
                        containerClassName="h-9"
                        autoFocus
                    />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                    {visibleThreads.length === 0 && (
                        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                            {normalizedQuery
                                ? t('noSearchResults', { query: historyQuery.trim() })
                                : t('historyEmpty')}
                        </p>
                    )}
                    {threadSections.map((section) => (
                        <section key={section.key} className="mb-2">
                            {historyView === 'chats' && (
                                <h3 className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">
                                    {t(`historySections.${section.key}`)}
                                </h3>
                            )}
                            <ul className="space-y-0.5">{section.threads.map(renderThreadRow)}</ul>
                            {section.hiddenCount > 0 && (
                                <p className="px-2.5 pt-1 text-[11px] text-muted-foreground">
                                    {t('historyHidden', { count: section.hiddenCount })}
                                </p>
                            )}
                        </section>
                    ))}
                </div>
                {historyView === 'chats' && archivedThreads.length > 0 && (
                    <div className="shrink-0 border-t border-border p-2">
                        <button
                            type="button"
                            onClick={() => {
                                setHistoryView('archived');
                                setHistoryQuery('');
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            <Archive aria-hidden="true" className="size-3.5" />
                            <span className="flex-1">{t('archivedChats', { count: archivedThreads.length })}</span>
                            <ChevronRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderChat = () => {
        if (loadError && !currentMessages) return renderLoadError(loadError.code);
        if (!currentThread || !currentMessages) return <TripAgentChatSkeleton />;
        return (
            <Suspense fallback={<TripAgentChatSkeleton />}>
                <TripAgentChatSession
                    key={`${currentThread.id}:${sessionRevision}`}
                    trip={trip}
                    thread={currentThread}
                    initialMessages={currentMessages}
                    contextRefs={contextRefs}
                    // A draft can be typed into before the quota has arrived.
                    quota={bootstrap?.quota ?? EMPTY_QUOTA}
                    actorId={bootstrap?.actor.userId ?? ''}
                    changeSetStatuses={changeSetStatuses}
                    onQuotaMayHaveChanged={() => void refresh(currentThread.id, true)}
                    onAdoptCommittedTripVersion={onAdoptCommittedTripVersion}
                    onPreviewTrip={onPreviewTrip}
                    onPreviewActiveChange={setIsPreviewActive}
                    onRevertAgentChange={onRevertAgentChange}
                    onReapplyAgentChange={onReapplyAgentChange}
                    onReady={handleSessionReady}
                    onBeforeSend={ensureThreadSaved}
                    recentChats={recentChats}
                    onOpenChat={openChat}
                    onShowAllChats={() => setHistoryView('chats')}
                    // Only a trip's very first chat introduces the agent.
                    showOnboarding={Boolean(bootstrap && bootstrap.threads.length === 0)}
                />
            </Suspense>
        );
    };

    return (
        <>
            {/* Above the trip header (1600) so a tall panel is never cut off
                by it, below app dialogs (1700) such as sign-in and sharing.
                Mobile renders as a sheet over the planner, so it is a dialog:
                it takes focus, keeps it, closes on Escape, and hands focus back.
                While a preview is showing, the planner behind it must stay
                visible and usable to look at. */}
            {!isPreviewActive && (
                <div
                    className="fixed inset-0 z-[1640] bg-slate-950/20 sm:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={t('title')}
                className={`${PANEL_FRAME_CLASS} ${
                    isPreviewActive ? 'h-[min(42dvh,340px)]' : 'h-[min(82dvh,720px)]'
                }`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                onKeyDown={handlePanelKeyDown}
            >
            <header className="flex shrink-0 items-center gap-1 border-b border-border py-2.5 ps-2.5 pe-2">
                {isHistoryOpen ? (
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={historyView === 'archived' ? () => setHistoryView('chats') : closeHistory}
                            aria-label={historyView === 'archived' ? t('historyTitle') : t('backToChat')}
                            title={historyView === 'archived' ? t('historyTitle') : t('backToChat')}
                        >
                            <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
                        </Button>
                        <h2 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-foreground">
                            {historyView === 'archived'
                                ? t('archivedChats', { count: archivedThreads.length })
                                : t('historyTitle')}
                        </h2>
                    </>
                ) : (
                    <h2 className="flex min-w-0 flex-1">
                        {/* Named "<title> Chat history", so a draft's switcher is
                            not a second button called "New chat". */}
                        <button
                            ref={switcherRef}
                            type="button"
                            onClick={() => setHistoryView('chats')}
                            aria-expanded={false}
                            aria-labelledby="trip-agent-switcher-title trip-agent-switcher-hint"
                            title={t('history')}
                            className="flex min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-1.5 text-start text-sm font-semibold text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            {...getAnalyticsDebugAttributes('trip_agent__history--open', { trip_id: trip.id })}
                        >
                            <span id="trip-agent-switcher-title" className="truncate">{currentThread ? threadTitle(currentThread) : t('title')}</span>
                            <span id="trip-agent-switcher-hint" className="sr-only">{t('history')}</span>
                            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                        </button>
                    </h2>
                )}
                {isRevalidating && (
                    <Spinner className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleNewChat}
                    aria-label={t('newChat')}
                    title={t('newChat')}
                    {...getAnalyticsDebugAttributes('trip_agent__thread--new', { trip_id: trip.id })}
                >
                    <MessageCirclePlus className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    aria-label={t('close')}
                    {...getAnalyticsDebugAttributes('trip_agent__panel--close', { trip_id: trip.id })}
                >
                    <X className="size-4" />
                </Button>
            </header>
            {isHistoryOpen ? renderHistory() : renderChat()}
            </aside>
        </>
    );
};
