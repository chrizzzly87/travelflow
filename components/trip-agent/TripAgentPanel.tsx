import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import {
    Archive,
    Bot,
    Check,
    ChevronDown,
    History,
    Lock,
    MessageCirclePlus,
    Sparkles,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import type { ITrip } from '../../types';
import {
    tripAgentChangeSetV1Schema,
    type TripAgentChangeSetV1,
    type TripAgentContextRef,
    type TripAgentMessage,
    type TripAgentQuotaState,
} from '../../shared/tripAgent';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    applyTripAgentProposal,
    archiveTripAgentThread,
    buildTripAgentChatRequest,
    createTripAgentThread,
    loadTripAgentBootstrap,
    rejectTripAgentProposal,
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
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
} from '../ai-elements/prompt-input';
import { Suggestion, Suggestions } from '../ai-elements/suggestion';
import { Plan, PlanDescription, PlanHeader, PlanTitle } from '../ai-elements/plan';
import { Source, Sources, SourcesContent, SourcesTrigger } from '../ai-elements/sources';
import { Tool, ToolContent, ToolHeader, type ToolPart } from '../ai-elements/tool';
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

const formatOperationValue = (operation: TripAgentChangeSetV1['operations'][number]): string => {
    if (operation.kind === 'update_trip' || operation.kind === 'update_item' || operation.kind === 'update_stay') {
        return Object.entries(operation.changes)
            .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join(' · ');
    }
    if (operation.kind === 'add_item') return `Add ${operation.item.title}`;
    if (operation.kind === 'remove_item') return `Remove ${operation.targetLabel}`;
    if (operation.kind === 'move_item') return `Move to day ${operation.startDateOffset + 1}`;
    if (operation.kind === 'add_stay') return `Add ${operation.stay.name}`;
    if (operation.kind === 'remove_stay') return `Remove ${operation.targetLabel}`;
    if (operation.kind === 'replace_itinerary') return `Replace itinerary with ${operation.items.length} items`;
    return `Replace days ${operation.startOffset + 1}–${operation.endOffset}`;
};

const formatComparisonValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
};

const describeOperationComparison = (
    trip: ITrip,
    operation: TripAgentChangeSetV1['operations'][number],
    t: TFunction,
): { before: string; after: string } => {
    if (operation.kind === 'update_trip') {
        const before = Object.fromEntries(Object.keys(operation.changes).map((key) => [key, trip[key as keyof ITrip]]));
        return { before: formatComparisonValue(before), after: formatComparisonValue(operation.changes) };
    }
    if (operation.kind === 'update_item') {
        const item = trip.items.find((candidate) => candidate.id === operation.itemId);
        const before = Object.fromEntries(Object.keys(operation.changes).map((key) => [key, item?.[key as keyof typeof item]]));
        return { before: formatComparisonValue(before), after: formatComparisonValue(operation.changes) };
    }
    if (operation.kind === 'update_stay') {
        const stay = trip.items.find((candidate) => candidate.id === operation.cityId)?.hotels?.find((candidate) => candidate.id === operation.stayId);
        const before = Object.fromEntries(Object.keys(operation.changes).map((key) => [key, stay?.[key as keyof typeof stay]]));
        return { before: formatComparisonValue(before), after: formatComparisonValue(operation.changes) };
    }
    if (operation.kind === 'move_item') {
        const item = trip.items.find((candidate) => candidate.id === operation.itemId);
        return {
            before: t('tripAgent.dayValue', { day: (item?.startDateOffset ?? 0) + 1 }),
            after: t('tripAgent.dayValue', { day: operation.startDateOffset + 1 }),
        };
    }
    if (operation.kind === 'remove_item' || operation.kind === 'remove_stay') {
        return { before: operation.targetLabel, after: t('tripAgent.removed') };
    }
    if (operation.kind === 'add_item') return { before: '—', after: operation.item.title };
    if (operation.kind === 'add_stay') return { before: '—', after: operation.stay.name };
    if (operation.kind === 'replace_itinerary') {
        return {
            before: t('tripAgent.itemCount', { count: trip.items.length }),
            after: t('tripAgent.itemCount', { count: operation.items.length }),
        };
    }
    const currentCount = trip.items.filter((item) => (
        item.startDateOffset < operation.endOffset
        && item.startDateOffset + item.duration > operation.startOffset
    )).length;
    return {
        before: t('tripAgent.itemCount', { count: currentCount }),
        after: t('tripAgent.itemCount', { count: operation.items.length }),
    };
};

const ProposalCard: React.FC<{
    trip: ITrip;
    changeSet: TripAgentChangeSetV1;
    onApplied: (trip: ITrip, versionId: string, label: string) => void;
}> = ({ trip, changeSet, onApplied }) => {
    const { t } = useTranslation('common');
    const [selected, setSelected] = useState(() => new Set(changeSet.operations.map((operation) => operation.id)));
    const [state, setState] = useState<'pending' | 'applying' | 'applied' | 'rejected' | 'error'>('pending');
    const [error, setError] = useState<string | null>(null);

    const toggleOperation = (operationId: string) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(operationId)) next.delete(operationId);
            else next.add(operationId);
            return next;
        });
    };

    const apply = async () => {
        if (selected.size === 0 || state !== 'pending') return;
        setState('applying');
        setError(null);
        try {
            const result = await applyTripAgentProposal(changeSet.tripId, changeSet.id, Array.from(selected));
            onApplied(result.trip, result.versionId, changeSet.summary);
            setState('applied');
            trackEvent('trip_agent__proposal--apply', {
                trip_id: changeSet.tripId,
                change_set_id: changeSet.id,
                operation_count: result.appliedOperationIds.length,
            });
        } catch (nextError) {
            setState('error');
            setError(nextError instanceof Error ? nextError.message : 'Could not apply this proposal.');
        }
    };

    const reject = async () => {
        if (state !== 'pending') return;
        await rejectTripAgentProposal(changeSet.tripId, changeSet.id);
        setState('rejected');
        trackEvent('trip_agent__proposal--reject', { trip_id: changeSet.tripId, change_set_id: changeSet.id });
    };

    return (
        <section className="overflow-hidden rounded-2xl border border-accent-200 bg-white shadow-sm" aria-label={t('tripAgent.review')}>
            <div className="border-b border-accent-100 bg-accent-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent-700">
                    <Sparkles className="size-3.5" />
                    {t('tripAgent.review')}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-950">{changeSet.summary}</h3>
            </div>
            <div className="divide-y divide-slate-100">
                {changeSet.operations.map((operation) => {
                    const comparison = describeOperationComparison(trip, operation, t);
                    return <label key={operation.id} className="flex cursor-pointer gap-3 p-4 transition-colors hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={selected.has(operation.id)}
                            disabled={state !== 'pending'}
                            onChange={() => toggleOperation(operation.id)}
                            className="mt-0.5 size-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">{operation.targetLabel}</span>
                            <span className="mt-1 block text-xs text-slate-600">{formatOperationValue(operation)}</span>
                            <span className="mt-1 block text-xs text-slate-500">{operation.rationale}</span>
                            <span className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><strong className="block font-semibold text-slate-800">{t('tripAgent.before')}</strong>{comparison.before}</span>
                                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-800"><strong className="block font-semibold text-emerald-900">{t('tripAgent.after')}</strong>{comparison.after}</span>
                            </span>
                        </span>
                    </label>;
                })}
            </div>
            {changeSet.sources.length > 0 && (
                <Sources className="mx-4 mt-3">
                    <SourcesTrigger count={changeSet.sources.length} />
                    <SourcesContent>
                        {changeSet.sources.map((source) => (
                            <Source key={source.id} href={source.url} title={source.title} />
                        ))}
                    </SourcesContent>
                </Sources>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3">
                {state === 'applied' ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check className="size-4" />{t('tripAgent.applied')}</span>
                ) : state === 'rejected' ? (
                    <span className="text-sm text-slate-500">{t('tripAgent.keep')}</span>
                ) : (
                    <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => void reject()} disabled={state === 'applying'}>
                            {t('tripAgent.keep')}
                        </Button>
                        <Button type="button" size="sm" onClick={() => void apply()} disabled={selected.size === 0 || state === 'applying'}>
                            {t('tripAgent.apply', { count: selected.size })}
                        </Button>
                    </>
                )}
            </div>
            {error && <p className="px-4 pb-3 text-xs text-rose-600" role="alert">{error}</p>}
        </section>
    );
};

const resolveToolName = (part: ToolPart): string => (
    part.type === 'dynamic-tool' ? part.toolName : part.type.slice('tool-'.length)
);

const asProposal = (part: ToolPart): TripAgentChangeSetV1 | null => {
    if (resolveToolName(part) !== 'create_trip_proposal' || part.state !== 'output-available') return null;
    const output = part.output as { kind?: unknown; changeSet?: unknown } | undefined;
    if (output?.kind !== 'trip-agent-proposal') return null;
    const result = tripAgentChangeSetV1Schema.safeParse(output.changeSet);
    return result.success ? result.data : null;
};

const ChatMessage: React.FC<{
    trip: ITrip;
    message: TripAgentMessage;
    isStreaming: boolean;
    onApplied: (trip: ITrip, versionId: string, label: string) => void;
}> = ({ trip, message, isStreaming, onApplied }) => {
    const { t } = useTranslation('common');
    return (
    <Message from={message.role}>
        <div className="text-[11px] font-medium text-slate-500">
            {message.metadata?.authorLabel || (message.role === 'assistant' ? 'Trip Agent' : 'Trip editor')}
        </div>
        <MessageContent>
            {message.parts.map((part, index) => {
                if (part.type === 'text') {
                    return <MessageResponse key={`${message.id}-text-${index}`} isAnimating={isStreaming}>{part.text}</MessageResponse>;
                }
                if (isToolUIPart(part)) {
                    const proposal = asProposal(part);
                    if (proposal) return <ProposalCard key={`${message.id}-proposal-${index}`} trip={trip} changeSet={proposal} onApplied={onApplied} />;
                    return (
                        <Tool key={`${message.id}-tool-${index}`} defaultOpen={false}>
                            {part.type === 'dynamic-tool' ? (
                                <ToolHeader type={part.type} toolName={part.toolName} state={part.state} title={resolveToolName(part).replaceAll('_', ' ')} />
                            ) : (
                                <ToolHeader type={part.type} state={part.state} title={resolveToolName(part).replaceAll('_', ' ')} />
                            )}
                            <ToolContent>
                                <p className="text-xs text-slate-600">
                                    {part.state === 'output-error' ? part.errorText : part.state === 'output-available' ? t('tripAgent.completed') : t('tripAgent.working')}
                                </p>
                            </ToolContent>
                        </Tool>
                    );
                }
                if (part.type === 'source-url') {
                    return <Source key={`${message.id}-source-${index}`} href={part.url} title={part.title || part.url} />;
                }
                return null;
            })}
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
    onQuotaMayHaveChanged: () => void;
    onAdoptCommittedTripVersion: TripAgentPanelProps['onAdoptCommittedTripVersion'];
}> = ({ trip, thread, initialMessages, contextRefs, quota, onQuotaMayHaveChanged, onAdoptCommittedTripVersion }) => {
    const { t, i18n } = useTranslation('common');
    const [removedContextIds, setRemovedContextIds] = useState<Set<string>>(() => new Set());
    const activeContextRefs = useMemo(
        () => contextRefs.filter((contextRef) => !removedContextIds.has(contextRef.id)),
        [contextRefs, removedContextIds],
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
    const { messages, sendMessage, status, stop, error } = useChat<TripAgentMessage>({
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

    const submitText = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isGenerating || isQuotaReached) return;
        trackEvent('trip_agent__prompt--submit', {
            trip_id: trip.id,
            thread_id: thread.id,
            context_count: activeContextRefs.length,
        });
        await sendMessage({ text: trimmed });
    }, [activeContextRefs.length, isGenerating, isQuotaReached, sendMessage, thread.id, trip.id]);

    return (
        <>
            <Conversation className="min-h-0">
                <ConversationContent className="gap-5 px-4 py-5">
                    {messages.length === 0 ? (
                        <ConversationEmptyState
                            icon={<Bot className="size-6" />}
                            title={t('tripAgent.noMessages')}
                            description={t('tripAgent.safety')}
                        />
                    ) : messages.map((message, index) => (
                        <ChatMessage
                            key={message.id}
                            trip={trip}
                            message={message}
                            isStreaming={isGenerating && index === messages.length - 1 && message.role === 'assistant'}
                            onApplied={(nextTrip, versionId, label) => onAdoptCommittedTripVersion({ trip: nextTrip, versionId, label: `Trip Agent: ${label}` })}
                        />
                    ))}
                    {status === 'submitted' && (
                        <Plan isStreaming className="border-accent-100 bg-accent-50/50">
                            <PlanHeader>
                                <div>
                                    <PlanTitle>{t('tripAgent.planning')}</PlanTitle>
                                    <PlanDescription>{t('tripAgent.safety')}</PlanDescription>
                                </div>
                            </PlanHeader>
                        </Plan>
                    )}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <div className="border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
                {activeContextRefs.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5" aria-label={t('tripAgent.selectedContext')}>
                        {activeContextRefs.map((contextRef) => (
                            <button
                                key={contextRef.id}
                                type="button"
                                onClick={() => setRemovedContextIds((current) => new Set(current).add(contextRef.id))}
                                aria-label={t('tripAgent.removeContext', { label: contextRef.label })}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs font-medium text-accent-800 hover:bg-accent-100"
                            >
                                <span className="truncate">{contextRef.label}</span><X className="size-3" />
                            </button>
                        ))}
                    </div>
                )}
                {messages.length === 0 && (
                    <Suggestions className="mb-2">
                        {suggestions.map((suggestion) => (
                            <Suggestion key={suggestion} suggestion={suggestion} onClick={(value) => void submitText(value)} />
                        ))}
                    </Suggestions>
                )}
                <PromptInput onSubmit={({ text }) => submitText(text)}>
                    <PromptInputBody>
                        <PromptInputTextarea name="message" placeholder={t('tripAgent.placeholder')} disabled={isQuotaReached} />
                    </PromptInputBody>
                    <PromptInputFooter className="justify-between">
                        <span className="px-2 text-[11px] text-slate-500">
                            {quota.remaining === null ? t('tripAgent.safety') : t('tripAgent.quota', { remaining: quota.remaining })}
                        </span>
                        <PromptInputSubmit status={status} onStop={stop} disabled={isQuotaReached} />
                    </PromptInputFooter>
                </PromptInput>
                {isQuotaReached && <p className="mt-2 text-xs text-amber-700" role="status">{t('tripAgent.quotaReached', { resetTime })}</p>}
                {error && <p className="mt-2 text-xs text-rose-600" role="alert">{error.message}</p>}
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
    const { t } = useTranslation('common');
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
                    <p className="truncate text-xs text-slate-500">{t('tripAgent.subtitle')}</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t('tripAgent.history')}>
                            <History className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>{t('tripAgent.history')}</DropdownMenuLabel>
                        {bootstrap?.threads.map((thread) => (
                            <DropdownMenuItem key={thread.id} onSelect={() => void selectThread(thread.id)}>
                                <span className="truncate">{thread.title}</span>
                                {thread.id === currentThreadId && <Check className="ms-auto size-3.5" />}
                                {thread.status === 'archived' && <Archive className="ms-auto size-3.5 text-slate-400" />}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => void createThread()}><MessageCirclePlus className="size-4" />{t('tripAgent.newChat')}</DropdownMenuItem>
                        {currentThread?.status === 'active' && <DropdownMenuItem onSelect={() => void archiveCurrent()}><Archive className="size-4" />{t('tripAgent.archive')}</DropdownMenuItem>}
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
                    onQuotaMayHaveChanged={() => void refresh(currentThread.id)}
                    onAdoptCommittedTripVersion={onAdoptCommittedTripVersion}
                />
            ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-500">{t('tripAgent.loading')}</div>
            )}
        </aside>
    );
};
