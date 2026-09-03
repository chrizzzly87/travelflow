import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
    AlertCircle,
    Archive,
    AtSign,
    BedDouble,
    Bot,
    Check,
    CircleDot,
    History,
    Lock,
    MapPin,
    MessageCirclePlus,
    Route,
    RotateCcw,
    Slash,
    Sparkles,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ITrip } from '../../types';
import {
    buildTripAgentSelectableContextRefs,
    type TripAgentContextRef,
    type TripAgentMessage,
    type TripAgentQuotaState,
} from '../../shared/tripAgent';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    archiveTripAgentThread,
    buildTripAgentChatRequest,
    createTripAgentThread,
    loadTripAgentBootstrap,
    readTripAgentError,
    tripAgentFetch,
    type TripAgentBootstrap,
    type TripAgentThread,
} from '../../services/tripAgentService';
import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
} from '../ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '../ai-elements/message';
import {
    PromptInput,
    PromptInputBody,
    PromptInputCommand,
    PromptInputCommandEmpty,
    PromptInputCommandGroup,
    PromptInputCommandInput,
    PromptInputCommandItem,
    PromptInputCommandList,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
} from '../ai-elements/prompt-input';
import { Suggestion, Suggestions } from '../ai-elements/suggestion';
import { Source } from '../ai-elements/sources';
import { TripAgentActivityGroup } from './TripAgentActivityGroup';
import { TripAgentCapabilities } from './TripAgentCapabilities';
import { buildTripAgentMessageBlocks } from './tripAgentMessageBlocks';
import { TripAgentProposalCard } from './TripAgentProposalCard';
import { formatTripAgentTimestamp, groupTripAgentThreads } from './tripAgentTime';
import { useMinuteTick } from './useMinuteTick';
import { Button } from '../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface TripAgentPanelProps {
    trip: ITrip;
    contextRefs: TripAgentContextRef[];
    isOpen: boolean;
    onClose: () => void;
    onAdoptCommittedTripVersion: (input: { trip: ITrip; versionId: string; label: string }) => void;
}

const contextRefKey = (contextRef: TripAgentContextRef): string => (
    `${contextRef.kind}:${contextRef.id}:${contextRef.cityId || ''}`
);

const CONTEXT_KIND_ORDER: TripAgentContextRef['kind'][] = ['trip', 'city', 'stay', 'activity', 'travel'];

const ContextKindIcon: React.FC<{ kind: TripAgentContextRef['kind']; className?: string }> = ({ kind, className = 'size-3.5' }) => {
    if (kind === 'trip') return <Sparkles className={className} />;
    if (kind === 'city') return <MapPin className={className} />;
    if (kind === 'stay') return <BedDouble className={className} />;
    if (kind === 'travel') return <Route className={className} />;
    return <CircleDot className={className} />;
};

const ChatMessage: React.FC<{
    trip: ITrip;
    message: TripAgentMessage;
    isStreaming: boolean;
    isOwnMessage: boolean;
    hasFailed: boolean;
    locale: string;
    now: number;
    onRetry?: () => void;
    onApplied: (trip: ITrip, versionId: string, label: string) => void;
}> = ({ trip, message, isStreaming, isOwnMessage, hasFailed, locale, now, onRetry, onApplied }) => {
    const { t } = useTranslation('common');
    const blocks = useMemo(() => buildTripAgentMessageBlocks(message, isStreaming), [message, isStreaming]);
    const timestamp = formatTripAgentTimestamp(message.metadata?.createdAt as string | undefined, locale, now);
    const authorLabel = message.role === 'assistant'
        ? t('tripAgent.agentName')
        : isOwnMessage ? null : (message.metadata?.authorLabel as string | undefined) || null;

    return (
        <Message from={message.role}>
            {(authorLabel || timestamp) && (
                <div className={`flex items-center gap-1.5 text-[11px] text-slate-400 ${isOwnMessage ? 'justify-end' : ''}`}>
                    {authorLabel && <span className="font-medium text-slate-500">{authorLabel}</span>}
                    {authorLabel && timestamp && <span aria-hidden="true">·</span>}
                    {timestamp && <time dateTime={String(message.metadata?.createdAt || '')}>{timestamp}</time>}
                </div>
            )}
            <MessageContent className={hasFailed ? 'group-[.is-user]:border group-[.is-user]:border-rose-200 group-[.is-user]:bg-rose-50' : undefined}>
                {blocks.map((block) => {
                    if (block.kind === 'text') {
                        return <MessageResponse key={block.key} isAnimating={isStreaming}>{block.text}</MessageResponse>;
                    }
                    if (block.kind === 'activity') {
                        return (
                            <TripAgentActivityGroup
                                key={block.key}
                                reasoningText={block.reasoningText}
                                steps={block.steps}
                                isStreaming={block.isStreaming}
                            />
                        );
                    }
                    if (block.kind === 'proposal') {
                        return <TripAgentProposalCard key={block.key} trip={trip} changeSet={block.changeSet} onApplied={onApplied} />;
                    }
                    return <Source key={block.key} href={block.url} title={block.title} />;
                })}
                {hasFailed && onRetry && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <span className="me-auto text-[11px] font-medium text-rose-700">{t('tripAgent.messageFailed')}</span>
                        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                            <RotateCcw className="size-3.5" />{t('tripAgent.retryMessage')}
                        </Button>
                    </div>
                )}
            </MessageContent>
        </Message>
    );
};

const TripAgentChatSession: React.FC<{
    trip: ITrip;
    thread: TripAgentThread;
    initialMessages: TripAgentMessage[];
    contextRefs: TripAgentContextRef[];
    quota: TripAgentQuotaState;
    actorId: string;
    onQuotaMayHaveChanged: () => void;
    onAdoptCommittedTripVersion: TripAgentPanelProps['onAdoptCommittedTripVersion'];
}> = ({ trip, thread, initialMessages, contextRefs, quota, actorId, onQuotaMayHaveChanged, onAdoptCommittedTripVersion }) => {
    const { t, i18n } = useTranslation('common');
    const now = useMinuteTick();
    const [draftText, setDraftText] = useState('');
    const [commandMenu, setCommandMenu] = useState<'context' | 'commands' | null>(null);
    const [manualContextRefs, setManualContextRefs] = useState<TripAgentContextRef[]>([]);
    const [removedContextKeys, setRemovedContextKeys] = useState<Set<string>>(() => new Set());
    const selectableContextRefs = useMemo(() => buildTripAgentSelectableContextRefs(trip), [trip]);
    const activeContextRefs = useMemo(
        () => {
            const unique = new Map<string, TripAgentContextRef>();
            [...contextRefs, ...manualContextRefs].forEach((contextRef) => {
                const key = contextRefKey(contextRef);
                if (!removedContextKeys.has(key)) unique.set(key, contextRef);
            });
            return Array.from(unique.values()).slice(0, 12);
        },
        [contextRefs, manualContextRefs, removedContextKeys],
    );
    const transport = useMemo(() => new DefaultChatTransport<TripAgentMessage>({
        api: '/api/trip-agent',
        fetch: tripAgentFetch,
        prepareSendMessagesRequest: ({ messages }) => buildTripAgentChatRequest({
            tripId: trip.id,
            threadId: thread.id,
            messages,
            contextRefs: activeContextRefs,
        }),
    }), [activeContextRefs, thread.id, trip.id]);
    const { messages, sendMessage, status, stop, error, clearError } = useChat<TripAgentMessage>({
        id: thread.id,
        messages: initialMessages,
        transport,
        throttle: 40,
        onError: onQuotaMayHaveChanged,
        onFinish: onQuotaMayHaveChanged,
    });
    const selectedCity = contextRefs.find((contextRef) => contextRef.kind === 'city');
    const suggestions = [
        t('tripAgent.suggestRelaxed'),
        t('tripAgent.suggestEastCoast'),
        t('tripAgent.suggestStays'),
        ...(selectedCity ? [t('tripAgent.suggestCity', { city: selectedCity.label })] : []),
    ];
    const isGenerating = status === 'submitted' || status === 'streaming';
    const isQuotaReached = quota.remaining === 0;
    const resetTime = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(quota.resetsAt));
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    const latestUserText = latestUserMessage?.parts.find((part) => part.type === 'text')?.text || '';
    const errorInfo = useMemo(() => (error ? readTripAgentError(error) : null), [error]);

    const submitText = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isGenerating || isQuotaReached) return;
        trackEvent('trip_agent__prompt--submit', {
            trip_id: trip.id,
            thread_id: thread.id,
            context_count: activeContextRefs.length,
        });
        setDraftText('');
        setCommandMenu(null);
        await sendMessage({ text: trimmed });
    }, [activeContextRefs.length, isGenerating, isQuotaReached, sendMessage, thread.id, trip.id]);

    const retryLastMessage = useCallback(async () => {
        if (!latestUserMessage || !latestUserText || isGenerating || isQuotaReached) return;
        clearError();
        trackEvent('trip_agent__message--retry', {
            trip_id: trip.id,
            thread_id: thread.id,
            context_count: activeContextRefs.length,
        });
        await sendMessage({ text: latestUserText, messageId: latestUserMessage.id });
    }, [activeContextRefs.length, clearError, isGenerating, isQuotaReached, latestUserMessage, latestUserText, sendMessage, thread.id, trip.id]);

    const updateDraft = (value: string) => {
        setDraftText(value);
        if (/(^|\s)@[^\s]*$/.test(value)) setCommandMenu('context');
        else if (/^\s*\/[^\s]*$/.test(value)) setCommandMenu('commands');
        else setCommandMenu(null);
    };

    const selectContext = (contextRef: TripAgentContextRef) => {
        const key = contextRefKey(contextRef);
        setRemovedContextKeys((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
        });
        setManualContextRefs((current) => (
            current.some((candidate) => contextRefKey(candidate) === key) ? current : [...current, contextRef]
        ));
        setDraftText((current) => current.replace(/(^|\s)@[^\s]*$/, '$1'));
        setCommandMenu(null);
        trackEvent('trip_agent__context--add', {
            trip_id: trip.id,
            context_kind: contextRef.kind,
        });
    };

    const removeContext = (contextRef: TripAgentContextRef) => {
        const key = contextRefKey(contextRef);
        setRemovedContextKeys((current) => new Set(current).add(key));
        setManualContextRefs((current) => current.filter((candidate) => contextRefKey(candidate) !== key));
    };

    const contextMeta = (contextRef: TripAgentContextRef): string => {
        const item = trip.items.find((candidate) => candidate.id === contextRef.id);
        const city = contextRef.cityId ? trip.items.find((candidate) => candidate.id === contextRef.cityId) : undefined;
        const day = item ? t('tripAgent.dayValue', { day: Math.floor(item.startDateOffset) + 1 }) : null;
        return [t(`tripAgent.contextKinds.${contextRef.kind}`), city?.title, day].filter(Boolean).join(' · ');
    };

    return (
        <>
            <Conversation className="min-h-0">
                <ConversationContent className="gap-5 px-4 py-5">
                    {messages.length === 0 ? (
                        <div className="space-y-3">
                            <ConversationEmptyState
                                icon={<Bot className="size-6" />}
                                title={t('tripAgent.noMessages')}
                                description={t('tripAgent.subtitle')}
                            />
                            <TripAgentCapabilities />
                        </div>
                    ) : messages.map((message, index) => (
                        <ChatMessage
                            key={message.id}
                            trip={trip}
                            message={message}
                            isStreaming={isGenerating && index === messages.length - 1 && message.role === 'assistant'}
                            isOwnMessage={message.role === 'user' && (message.metadata?.authorId || actorId) === actorId}
                            hasFailed={Boolean(errorInfo) && message.id === latestUserMessage?.id}
                            locale={i18n.language}
                            now={now}
                            onRetry={message.id === latestUserMessage?.id ? () => void retryLastMessage() : undefined}
                            onApplied={(nextTrip, versionId, label) => onAdoptCommittedTripVersion({ trip: nextTrip, versionId, label: `Trip Agent: ${label}` })}
                        />
                    ))}
                    {status === 'submitted' && (
                        <TripAgentActivityGroup reasoningText="" steps={[]} isStreaming />
                    )}
                    {errorInfo && (
                        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-rose-950" role="alert">
                            <div className="flex items-start gap-2.5">
                                <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold leading-5">
                                        {t([`tripAgent.errors.${errorInfo.code}`, 'tripAgent.errors.TRIP_AGENT_REQUEST_FAILED'])}
                                    </h3>
                                    <p className="mt-1 break-words text-xs leading-5 text-rose-800">{errorInfo.detail || errorInfo.message}</p>
                                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-rose-600">
                                        {[errorInfo.code, errorInfo.status ? `HTTP ${errorInfo.status}` : null, errorInfo.requestId ? `#${errorInfo.requestId.slice(0, 8)}` : null].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <div className="border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
                {messages.length === 0 && (
                    <Suggestions className="mb-2">
                        {suggestions.map((suggestion) => (
                            <Suggestion key={suggestion} suggestion={suggestion} onClick={(value) => void submitText(value)} />
                        ))}
                    </Suggestions>
                )}
                <div className="relative">
                    {commandMenu && (
                        <>
                        <button
                            type="button"
                            aria-label={t('tripAgent.closeMenu')}
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setCommandMenu(null)}
                        />
                        <div className="absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                            <PromptInputCommand>
                                <PromptInputCommandInput
                                    placeholder={commandMenu === 'context' ? t('tripAgent.searchContext') : t('tripAgent.searchCommand')}
                                    autoFocus
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            setCommandMenu(null);
                                        }
                                    }}
                                />
                                <PromptInputCommandList className="max-h-64">
                                    <PromptInputCommandEmpty>{t('tripAgent.noContext')}</PromptInputCommandEmpty>
                                    {commandMenu === 'context' ? (
                                        CONTEXT_KIND_ORDER
                                            .map((kind) => ({ kind, refs: selectableContextRefs.filter((contextRef) => contextRef.kind === kind) }))
                                            .filter((entry) => entry.refs.length > 0)
                                            .map(({ kind, refs }) => (
                                                <PromptInputCommandGroup key={kind} heading={t(`tripAgent.contextGroups.${kind}`)}>
                                                    {refs.map((contextRef) => {
                                                        const isActive = activeContextRefs.some((candidate) => contextRefKey(candidate) === contextRefKey(contextRef));
                                                        return (
                                                            <PromptInputCommandItem
                                                                key={contextRefKey(contextRef)}
                                                                value={`${contextRef.label} ${contextMeta(contextRef)}`}
                                                                onSelect={() => selectContext(contextRef)}
                                                                disabled={!isActive && activeContextRefs.length >= 12}
                                                            >
                                                                <ContextKindIcon kind={contextRef.kind} className="size-4" />
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block truncate text-sm">{contextRef.label}</span>
                                                                    <span className="block truncate text-[11px] text-slate-500">{contextMeta(contextRef)}</span>
                                                                </span>
                                                                {isActive && <Check className="size-3.5 text-accent-600" />}
                                                            </PromptInputCommandItem>
                                                        );
                                                    })}
                                                </PromptInputCommandGroup>
                                            ))
                                    ) : (
                                        <PromptInputCommandGroup heading={t('tripAgent.commandMenu')}>
                                            {suggestions.map((suggestion) => (
                                                <PromptInputCommandItem
                                                    key={suggestion}
                                                    value={suggestion}
                                                    onSelect={() => {
                                                        setDraftText(suggestion);
                                                        setCommandMenu(null);
                                                        trackEvent('trip_agent__preset--select', { trip_id: trip.id });
                                                    }}
                                                >
                                                    <Slash className="size-4" />
                                                    <span className="text-sm">{suggestion}</span>
                                                </PromptInputCommandItem>
                                            ))}
                                        </PromptInputCommandGroup>
                                    )}
                                </PromptInputCommandList>
                            </PromptInputCommand>
                        </div>
                        </>
                    )}
                    <PromptInput onSubmit={({ text }) => submitText(text)}>
                        <PromptInputBody>
                            {activeContextRefs.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 px-3 pt-3" aria-label={t('tripAgent.selectedContext')}>
                                    {activeContextRefs.map((contextRef) => (
                                        <button
                                            key={contextRefKey(contextRef)}
                                            type="button"
                                            onClick={() => removeContext(contextRef)}
                                            aria-label={t('tripAgent.removeContext', { label: contextRef.label })}
                                            title={contextMeta(contextRef)}
                                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-xs font-medium text-accent-800 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                                        >
                                            <ContextKindIcon kind={contextRef.kind} />
                                            <span className="truncate">{contextRef.label}</span>
                                            <X className="size-3 opacity-60" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            <PromptInputTextarea
                                name="message"
                                placeholder={t('tripAgent.placeholder')}
                                disabled={isQuotaReached}
                                value={draftText}
                                onChange={(event) => updateDraft(event.currentTarget.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape' && commandMenu) {
                                        event.preventDefault();
                                        setCommandMenu(null);
                                    }
                                }}
                            />
                        </PromptInputBody>
                        <PromptInputFooter className="justify-between">
                            <div className="flex min-w-0 items-center gap-1">
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCommandMenu((current) => current === 'context' ? null : 'context')} aria-label={t('tripAgent.contextMenu')}>
                                    <AtSign className="size-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setCommandMenu((current) => current === 'commands' ? null : 'commands')} aria-label={t('tripAgent.commandMenu')}>
                                    <Slash className="size-4" />
                                </Button>
                                {quota.remaining !== null && (
                                    <span className="truncate px-1 text-[11px] text-slate-500">
                                        {t('tripAgent.quota', { remaining: quota.remaining })}
                                    </span>
                                )}
                            </div>
                            <PromptInputSubmit status={status} onStop={stop} disabled={isQuotaReached || !draftText.trim()} />
                        </PromptInputFooter>
                    </PromptInput>
                </div>
                {isQuotaReached && <p className="mt-2 text-xs text-amber-700" role="status">{t('tripAgent.quotaReached', { resetTime })}</p>}
            </div>
        </>
    );
};

export const TripAgentPanel: React.FC<TripAgentPanelProps> = ({
    trip,
    contextRefs,
    isOpen,
    onClose,
    onAdoptCommittedTripVersion,
}) => {
    const { t, i18n } = useTranslation('common');
    const now = useMinuteTick();
    const [bootstrap, setBootstrap] = useState<TripAgentBootstrap | null>(null);
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const refresh = useCallback(async (preferredThreadId?: string | null) => {
        try {
            const next = await loadTripAgentBootstrap(trip.id, preferredThreadId ?? currentThreadId);
            if (!next.currentThreadId) {
                const created = await createTripAgentThread(trip.id);
                const withThread = await loadTripAgentBootstrap(trip.id, created.id);
                setBootstrap(withThread);
                setCurrentThreadId(created.id);
            } else {
                setBootstrap(next);
                setCurrentThreadId(next.currentThreadId);
            }
            setLoadError(null);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Could not load Trip Agent.');
        }
    }, [currentThreadId, trip.id]);

    useEffect(() => {
        if (!isOpen) return;
        void refresh();
    }, [isOpen, refresh]);

    const selectThread = async (threadId: string) => {
        setCurrentThreadId(threadId);
        await refresh(threadId);
    };

    const createThread = async () => {
        const thread = await createTripAgentThread(trip.id);
        trackEvent('trip_agent__thread--create', { trip_id: trip.id });
        await selectThread(thread.id);
    };

    const archiveCurrent = async () => {
        if (!currentThreadId) return;
        await archiveTripAgentThread(trip.id, currentThreadId);
        trackEvent('trip_agent__thread--archive', { trip_id: trip.id, thread_id: currentThreadId });
        setCurrentThreadId(null);
        await refresh(null);
    };

    const currentThread = bootstrap?.threads.find((thread) => thread.id === currentThreadId) || null;
    const threadSections = useMemo(() => groupTripAgentThreads(bootstrap?.threads || [], now), [bootstrap?.threads, now]);

    return (
        <aside
            className="fixed inset-x-0 bottom-0 z-[1500] flex h-[min(82dvh,720px)] flex-col overflow-hidden rounded-t-[1.5rem] border border-slate-200 bg-white shadow-[0_-24px_80px_rgba(15,23,42,0.18)] sm:inset-x-auto sm:bottom-4 sm:end-4 sm:h-[min(720px,calc(100dvh-2rem))] sm:w-[420px] sm:rounded-[1.5rem] sm:shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            aria-label={t('tripAgent.title')}
        >
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white"><Sparkles className="size-4" /></div>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-slate-950">{t('tripAgent.title')}</h2>
                    <p className="truncate text-xs text-slate-500">
                        {currentThread ? currentThread.title : t('tripAgent.subtitle')}
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t('tripAgent.history')}>
                            <History className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[70dvh] w-72 overflow-y-auto">
                        <DropdownMenuItem onSelect={() => void createThread()}>
                            <MessageCirclePlus className="size-4" />{t('tripAgent.newChat')}
                        </DropdownMenuItem>
                        {threadSections.length === 0 && (
                            <p className="px-2 py-3 text-xs text-slate-500">{t('tripAgent.historyEmpty')}</p>
                        )}
                        {threadSections.map((section) => (
                            <React.Fragment key={section.key}>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    {t(`tripAgent.historySections.${section.key}`)}
                                </DropdownMenuLabel>
                                {section.threads.map((thread) => (
                                    <DropdownMenuItem key={thread.id} onSelect={() => void selectThread(thread.id)} className="items-start gap-2">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm">{thread.title}</span>
                                            <span className="block text-[11px] text-slate-500">
                                                {formatTripAgentTimestamp(thread.updatedAt, i18n.language, now)}
                                            </span>
                                        </span>
                                        {thread.id === currentThreadId
                                            ? <Check className="mt-0.5 size-3.5 text-accent-600" />
                                            : thread.status === 'archived'
                                                ? <Archive className="mt-0.5 size-3.5 text-slate-400" />
                                                : null}
                                    </DropdownMenuItem>
                                ))}
                                {section.hiddenCount > 0 && (
                                    <p className="px-2 pb-1 text-[11px] text-slate-400">
                                        {t('tripAgent.historyHidden', { count: section.hiddenCount })}
                                    </p>
                                )}
                            </React.Fragment>
                        ))}
                        {currentThread?.status === 'active' && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => void archiveCurrent()}>
                                    <Archive className="size-4" />{t('tripAgent.archive')}
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
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
            {loadError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <Lock className="size-6 text-amber-600" />
                    <p className="text-sm text-slate-700">{loadError}</p>
                    <Button size="sm" variant="outline" onClick={() => void refresh()}>{t('tripAgent.retry')}</Button>
                </div>
            ) : currentThread && bootstrap ? (
                <TripAgentChatSession
                    key={currentThread.id}
                    trip={trip}
                    thread={currentThread}
                    initialMessages={bootstrap.messages}
                    contextRefs={contextRefs}
                    quota={bootstrap.quota}
                    actorId={bootstrap.actor.userId}
                    onQuotaMayHaveChanged={() => void refresh(currentThread.id)}
                    onAdoptCommittedTripVersion={onAdoptCommittedTripVersion}
                />
            ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-500">{t('tripAgent.loading')}</div>
            )}
        </aside>
    );
};
