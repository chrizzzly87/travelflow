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
    Sparkles,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    type TripAgentChangeSetStatus,
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
} from '../ai-elements/prompt-input';
import { Suggestion, Suggestions } from '../ai-elements/suggestion';
import { Source } from '../ai-elements/sources';
import { TripAgentActivityGroup } from './TripAgentActivityGroup';
import { TripAgentCapabilities } from './TripAgentCapabilities';
import { TripAgentMentionMenu, type TripAgentMentionItem } from './TripAgentMentionMenu';
import { buildTripAgentMessageBlocks } from './tripAgentMessageBlocks';
import { TripAgentProposalCard } from './TripAgentProposalCard';
import { TripAgentProposalSkeleton } from './TripAgentProposalSkeleton';
import { TripAgentQuestionCard } from './TripAgentQuestionCard';
import { TripAgentHotelCards, TripAgentRouteCards } from './TripAgentSpecialistCards';
import { TripAgentWorkingIndicator } from './TripAgentWorkingIndicator';
import { TripAgentPromptField } from './TripAgentPromptField';
import { ambiguousMentionLabels, insertMention, mentionedContextRefs } from './tripAgentMentions';
import {
    Questionnaire,
    QuestionnaireChoice,
    QuestionnaireChoiceDescription,
    QuestionnaireChoices,
    QuestionnaireItem,
    QuestionnaireTitle,
} from '../ui/questionnaire';
import { formatTripAgentTimestamp, groupTripAgentThreads } from './tripAgentTime';
import { useMinuteTick } from './useMinuteTick';
import { Button } from '../ui/button';


interface TripAgentPanelProps {
    trip: ITrip;
    contextRefs: TripAgentContextRef[];
    isOpen: boolean;
    onClose: () => void;
    onAdoptCommittedTripVersion: (input: { trip: ITrip; versionId: string; label: string }) => void;
    /** Shows a proposed trip in the planner while the reviewer previews it. */
    onPreviewTrip?: (trip: ITrip | null) => void;
    /** Restores a trip snapshot from before an applied change set. */
    onRevertAgentChange?: (input: {
        trip: ITrip;
        redoTrip: ITrip;
        label: string;
        redoLabel: string;
        changeSetId: string;
    }) => void;
    /** Applies a reviewed set again after it was applied once. */
    onReapplyAgentChange?: (input: { trip: ITrip; label: string; changeSetId: string }) => void;
}

const contextRefKey = (contextRef: TripAgentContextRef): string => (
    `${contextRef.kind}:${contextRef.id}:${contextRef.cityId || ''}`
);

// The chat only exists inside one trip, so the trip itself is always implied.
const CONTEXT_KIND_ORDER: TripAgentContextRef['kind'][] = ['city', 'stay', 'activity', 'travel'];

/** Upright slash, where lucide's Slash icon reads as a 45° stroke. */
const SlashGlyph: React.FC<{ className?: string }> = ({ className = '' }) => (
    <span aria-hidden="true" className={`font-mono text-[15px] font-semibold leading-none ${className}`}>/</span>
);

const ContextKindIcon: React.FC<{ kind: TripAgentContextRef['kind']; className?: string }> = ({ kind, className = 'size-3.5' }) => {
    if (kind === 'trip') return <Sparkles className={className} />;
    if (kind === 'city') return <MapPin className={className} />;
    if (kind === 'stay') return <BedDouble className={className} />;
    if (kind === 'travel') return <Route className={className} />;
    return <CircleDot className={className} />;
};

const MENTION_PATTERN = /@[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

/** Keeps @mentions readable in a sent message, the way they looked while typing. */
const MentionText: React.FC<{ text: string }> = ({ text }) => {
    const pieces: React.ReactNode[] = [];
    let cursor = 0;
    let match = MENTION_PATTERN.exec(text);
    while (match) {
        if (match.index > cursor) pieces.push(text.slice(cursor, match.index));
        pieces.push(
            <mark key={`${match.index}-${match[0]}`} className="rounded-[5px] bg-accent-100 px-0.5 py-px text-accent-900">
                {match[0]}
            </mark>,
        );
        cursor = match.index + match[0].length;
        match = MENTION_PATTERN.exec(text);
    }
    MENTION_PATTERN.lastIndex = 0;
    pieces.push(text.slice(cursor));
    return <span className="whitespace-pre-wrap break-words">{pieces}</span>;
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
    onPreviewTrip?: (trip: ITrip | null) => void;
    onRevertAgentChange?: TripAgentPanelProps['onRevertAgentChange'];
    onReapplyAgentChange?: TripAgentPanelProps['onReapplyAgentChange'];
    shortcutChangeSetId?: string | null;
    changeSetStatuses?: Record<string, {
        status: TripAgentChangeSetStatus['status'];
        appliedOperationIds: string[];
        appliedVersionId?: string | null;
    }>;
    onAskAgain?: () => void;
    onAnswerQuestion?: (prompt: string) => void;
}> = ({
    trip,
    message,
    isStreaming,
    isOwnMessage,
    hasFailed,
    locale,
    now,
    onRetry,
    onApplied,
    onPreviewTrip,
    onRevertAgentChange,
    onReapplyAgentChange,
    shortcutChangeSetId,
    changeSetStatuses,
    onAskAgain,
    onAnswerQuestion,
}) => {
    const { t } = useTranslation('common');
    const blocks = useMemo(() => buildTripAgentMessageBlocks(message, isStreaming), [message, isStreaming]);
    const timestamp = formatTripAgentTimestamp(message.metadata?.createdAt as string | undefined, locale, now);
    const persistedStatus = message.metadata?.status as string | undefined;
    const wasInterrupted = message.role === 'assistant'
        && !isStreaming
        && (persistedStatus === 'streaming' || persistedStatus === 'cancelled' || persistedStatus === 'failed');
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
                        return message.role === 'user'
                            ? <MentionText key={block.key} text={block.text} />
                            : <MessageResponse key={block.key} isAnimating={isStreaming}>{block.text}</MessageResponse>;
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
                        return (
                            <TripAgentProposalCard
                                key={block.key}
                                trip={trip}
                                changeSet={block.changeSet}
                                onApplied={onApplied}
                                onPreviewTrip={onPreviewTrip}
                                onRevertAgentChange={onRevertAgentChange}
                                onReapplyAgentChange={onReapplyAgentChange}
                                shortcutEnabled={block.changeSet.id === shortcutChangeSetId}
                                isSuperseded={Boolean(shortcutChangeSetId) && block.changeSet.id !== shortcutChangeSetId}
                                serverStatus={changeSetStatuses?.[block.changeSet.id]?.status}
                                appliedOperationIds={changeSetStatuses?.[block.changeSet.id]?.appliedOperationIds}
                                appliedVersionId={changeSetStatuses?.[block.changeSet.id]?.appliedVersionId}
                                onAskAgain={onAskAgain}
                            />
                        );
                    }
                    if (block.kind === 'proposal-pending') {
                        return <TripAgentProposalSkeleton key={block.key} />;
                    }
                    if (block.kind === 'proposal-failed') {
                        return (
                            <div
                                key={block.key}
                                role="alert"
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5"
                            >
                                <p className="text-xs font-semibold text-rose-900">{t('tripAgent.proposalFailed')}</p>
                                {block.detail && (
                                    <p className="mt-1 break-words text-[11px] leading-4 text-rose-800">{block.detail}</p>
                                )}
                                {onRetry && (
                                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                                        <RotateCcw className="size-3.5" />{t('tripAgent.retryMessage')}
                                    </Button>
                                )}
                            </div>
                        );
                    }
                    if (block.kind === 'hotels') {
                        return <TripAgentHotelCards key={block.key} groups={block.groups} />;
                    }
                    if (block.kind === 'routes') {
                        return (
                            <TripAgentRouteCards
                                key={block.key}
                                alternatives={block.alternatives}
                                onAsk={onAnswerQuestion}
                            />
                        );
                    }
                    if (block.kind === 'question') {
                        return (
                            <TripAgentQuestionCard
                                key={block.key}
                                question={block.question}
                                options={block.options}
                                allowCustom={block.allowCustom}
                                disabled={!onAnswerQuestion}
                                onAnswer={(prompt) => onAnswerQuestion?.(prompt)}
                            />
                        );
                    }
                    return <Source key={block.key} href={block.url} title={block.title} />;
                })}
                {wasInterrupted && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2">
                        <span className="text-[11px] font-medium text-amber-800">{t('tripAgent.runInterrupted')}</span>
                        {onRetry && (
                            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                                <RotateCcw className="size-3.5" />{t('tripAgent.continueRun')}
                            </Button>
                        )}
                    </div>
                )}
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
    changeSetStatuses?: Record<string, {
        status: TripAgentChangeSetStatus['status'];
        appliedOperationIds: string[];
        appliedVersionId?: string | null;
    }>;
    onQuotaMayHaveChanged: () => void;
    onAdoptCommittedTripVersion: TripAgentPanelProps['onAdoptCommittedTripVersion'];
    onPreviewTrip?: TripAgentPanelProps['onPreviewTrip'];
    onPreviewActiveChange?: (isActive: boolean) => void;
    onRevertAgentChange?: TripAgentPanelProps['onRevertAgentChange'];
    onReapplyAgentChange?: TripAgentPanelProps['onReapplyAgentChange'];
}> = ({
    trip,
    thread,
    initialMessages,
    contextRefs,
    quota,
    actorId,
    changeSetStatuses,
    onQuotaMayHaveChanged,
    onAdoptCommittedTripVersion,
    onPreviewTrip,
    onPreviewActiveChange,
    onRevertAgentChange,
    onReapplyAgentChange,
}) => {
    const { t, i18n } = useTranslation('common');
    const now = useMinuteTick();
    // A preview replaces the planner behind the panel, so the panel has to get
    // out of the way on a phone, where the sheet covers what it is previewing.
    const publishPreview = useCallback((previewTrip: ITrip | null) => {
        onPreviewActiveChange?.(Boolean(previewTrip));
        onPreviewTrip?.(previewTrip);
    }, [onPreviewActiveChange, onPreviewTrip]);
    const [draftText, setDraftText] = useState(() => {
        const seed = contextRefs.find((contextRef) => contextRef.kind !== 'trip');
        return seed ? `@${seed.label} ` : '';
    });
    const [commandMenu, setCommandMenu] = useState<'context' | 'commands' | null>(null);
    const [menuQuery, setMenuQuery] = useState('');
    const [pendingChoice, setPendingChoice] = useState<{ label: string; options: TripAgentContextRef[] } | null>(null);
    const [chosenByLabel, setChosenByLabel] = useState<Record<string, TripAgentContextRef>>({});
    const [menuIndex, setMenuIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const focusPrompt = useCallback(() => {
        const element = textareaRef.current
            || (typeof document === 'undefined'
                ? null
                : document.querySelector<HTMLTextAreaElement>('textarea[name="message"]'));
        element?.focus();
    }, []);
    const selectableContextRefs = useMemo(
        () => buildTripAgentSelectableContextRefs(trip).filter((contextRef) => contextRef.kind !== 'trip'),
        [trip],
    );
    // A message carries what it mentions plus whatever is selected in the
    // planner at that moment, so a selection made after the chat opened is not
    // silently dropped.
    const mentionedRefs = useMemo(
        () => mentionedContextRefs(draftText, selectableContextRefs, chosenByLabel),
        [chosenByLabel, draftText, selectableContextRefs],
    );
    const activeContextRefs = useMemo(() => {
        const unique = new Map<string, TripAgentContextRef>();
        [...mentionedRefs, ...contextRefs].forEach((contextRef) => {
            unique.set(contextRefKey(contextRef), contextRef);
        });
        return Array.from(unique.values()).slice(0, 12);
    }, [contextRefs, mentionedRefs]);
    const selectionOnlyRefs = useMemo(
        () => contextRefs.filter((contextRef) => (
            contextRef.kind !== 'trip'
            && !mentionedRefs.some((candidate) => contextRefKey(candidate) === contextRefKey(contextRef))
        )),
        [contextRefs, mentionedRefs],
    );
    const ambiguousLabels = useMemo(() => ambiguousMentionLabels(selectableContextRefs), [selectableContextRefs]);
    const retryContextRef = useRef<TripAgentContextRef[] | null>(null);
    const transport = useMemo(() => new DefaultChatTransport<TripAgentMessage>({
        api: '/api/trip-agent',
        fetch: tripAgentFetch,
        prepareSendMessagesRequest: ({ messages }) => {
            // A retry repeats the message with the context it was sent with,
            // not with whatever the draft happens to mention now.
            const contextRefs = retryContextRef.current || activeContextRefs;
            retryContextRef.current = null;
            return buildTripAgentChatRequest({
                tripId: trip.id,
                threadId: thread.id,
                messages,
                contextRefs,
            });
        },
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
    const suggestions = useMemo(() => [
        t('tripAgent.suggestRelaxed'),
        t('tripAgent.suggestEastCoast'),
        t('tripAgent.suggestStays'),
        ...(selectedCity ? [t('tripAgent.suggestCity', { city: selectedCity.label })] : []),
    ], [selectedCity, t]);
    const isGenerating = status === 'submitted' || status === 'streaming';
    const lastMessage = messages.at(-1);
    const hasStreamingAssistantText = lastMessage?.role === 'assistant'
        && lastMessage.parts.some((part) => part.type === 'text' && part.text.trim().length > 0);
    // Tool calls can arrive fully formed, so a proposal is treated as pending
    // from the moment the run mentions it until its card exists.
    const isProposalPending = Boolean(lastMessage && lastMessage.role === 'assistant'
        && lastMessage.parts.some((part) => part.type.startsWith('tool-') && part.type.includes('create_trip_proposal'))
        && !buildTripAgentMessageBlocks(lastMessage, false).some((block) => block.kind === 'proposal'));
    const isQuotaReached = quota.remaining === 0;
    const resetTime = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(quota.resetsAt));
    const shortcutChangeSetId = useMemo(() => {
        for (const message of [...messages].reverse()) {
            const proposal = buildTripAgentMessageBlocks(message, false)
                .reverse()
                .find((block) => block.kind === 'proposal');
            if (proposal?.kind === 'proposal') return proposal.changeSet.id;
        }
        return null;
    }, [messages]);
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
        const persisted = latestUserMessage.metadata?.contextRefs as TripAgentContextRef[] | undefined;
        retryContextRef.current = Array.isArray(persisted) ? persisted : null;
        await sendMessage({ text: latestUserText, messageId: latestUserMessage.id });
    }, [activeContextRefs.length, clearError, isGenerating, isQuotaReached, latestUserMessage, latestUserText, sendMessage, thread.id, trip.id]);

    const updateDraft = (value: string) => {
        setDraftText(value);
        const mention = /(?:^|\s)@([^\s]*)$/.exec(value);
        const command = /^\s*\/([^\s]*)$/.exec(value);
        if (mention) openMenu('context', mention[1]);
        else if (command) openMenu('commands', command[1]);
        else setCommandMenu(null);
    };

    const openMenu = (mode: 'context' | 'commands', query = '') => {
        setCommandMenu(mode);
        setMenuQuery(query);
        setMenuIndex(0);
    };

    const toggleMenu = (mode: 'context' | 'commands') => {
        if (commandMenu === mode) {
            setCommandMenu(null);
            return;
        }
        openMenu(mode);
        focusPrompt();
    };

    const selectContext = (contextRef: TripAgentContextRef) => {
        setDraftText((current) => insertMention(current, contextRef.label));
        setCommandMenu(null);
        const label = contextRef.label.toLowerCase();
        if (ambiguousLabels.has(label) && !chosenByLabel[label]) {
            setPendingChoice({
                label: contextRef.label,
                options: selectableContextRefs.filter((candidate) => candidate.label.toLowerCase() === label),
            });
        }
        trackEvent('trip_agent__context--add', {
            trip_id: trip.id,
            context_kind: contextRef.kind,
        });
    };

    const contextMeta = (contextRef: TripAgentContextRef): string => {
        const item = trip.items.find((candidate) => candidate.id === contextRef.id);
        const city = contextRef.cityId ? trip.items.find((candidate) => candidate.id === contextRef.cityId) : undefined;
        const day = item ? t('tripAgent.dayValue', { day: Math.floor(item.startDateOffset) + 1 }) : null;
        return [t(`tripAgent.contextKinds.${contextRef.kind}`), city?.title, day].filter(Boolean).join(' · ');
    };

    const menuItems = useMemo((): TripAgentMentionItem[] => {
        const query = menuQuery.trim().toLowerCase();
        if (commandMenu === 'commands') {
            return suggestions
                .filter((suggestion) => !query || suggestion.toLowerCase().includes(query))
                .map((suggestion) => ({
                    key: `preset:${suggestion}`,
                    group: t('tripAgent.commandMenu'),
                    label: suggestion,
                    icon: <SlashGlyph className="w-4 shrink-0 text-center text-slate-400" />,
                }));
        }
        if (commandMenu !== 'context') return [];
        return CONTEXT_KIND_ORDER.flatMap((kind) => selectableContextRefs
            .filter((contextRef) => contextRef.kind === kind)
            .filter((contextRef) => {
                if (!query) return true;
                return `${contextRef.label} ${contextMeta(contextRef)}`.toLowerCase().includes(query);
            })
            .map((contextRef) => ({
                key: contextRefKey(contextRef),
                group: t(`tripAgent.contextGroups.${kind}`),
                label: contextRef.label,
                meta: contextMeta(contextRef),
                isSelected: activeContextRefs.some((candidate) => contextRefKey(candidate) === contextRefKey(contextRef)),
                icon: <ContextKindIcon kind={contextRef.kind} className="size-4 shrink-0 text-slate-400" />,
            })));
    }, [activeContextRefs, commandMenu, menuQuery, selectableContextRefs, suggestions, t, trip.items]);

    const selectMenuItem = (index: number) => {
        const item = menuItems[index];
        if (!item) return;
        if (commandMenu === 'commands') {
            setDraftText(item.label);
            setCommandMenu(null);
            trackEvent('trip_agent__preset--select', { trip_id: trip.id });
            focusPrompt();
            return;
        }
        const contextRef = selectableContextRefs.find((candidate) => contextRefKey(candidate) === item.key);
        if (contextRef) selectContext(contextRef);
        focusPrompt();
    };

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!commandMenu) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            setCommandMenu(null);
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (menuItems.length === 0) return;
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            setMenuIndex((current) => (current + delta + menuItems.length) % menuItems.length);
            return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
            if (menuItems.length === 0) return;
            event.preventDefault();
            selectMenuItem(menuIndex);
        }
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
                            onRetry={message.id === latestUserMessage?.id || index === messages.length - 1
                                ? () => void retryLastMessage()
                                : undefined}
                            onApplied={(nextTrip, versionId, label) => onAdoptCommittedTripVersion({ trip: nextTrip, versionId, label: `Trip Agent: ${label}` })}
                            onPreviewTrip={publishPreview}
                            onRevertAgentChange={onRevertAgentChange}
                            onReapplyAgentChange={onReapplyAgentChange}
                            shortcutChangeSetId={shortcutChangeSetId}
                            changeSetStatuses={changeSetStatuses}
                            onAskAgain={focusPrompt}
                            onAnswerQuestion={(prompt) => void submitText(prompt)}
                        />
                    ))}
                    {isGenerating && (
                        <div className="space-y-2">
                            {!hasStreamingAssistantText && (
                                <div className="text-[11px] text-slate-400">
                                    <span className="font-medium text-slate-500">{t('tripAgent.agentName')}</span>
                                    <span aria-hidden="true"> · </span>
                                    <span>{formatTripAgentTimestamp(Date.now(), i18n.language, now)}</span>
                                </div>
                            )}
                            {isProposalPending
                                ? <TripAgentProposalSkeleton />
                                : (
                                    <TripAgentWorkingIndicator
                                        label={t('tripAgent.activityWorking')}
                                        hint={t('tripAgent.activityStillWorking')}
                                    />
                                )}
                        </div>
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
                {selectionOnlyRefs.length > 0 && (
                    <p className="mb-1.5 truncate px-1 text-[11px] text-slate-500">
                        {t('tripAgent.alsoUsingSelection', {
                            labels: selectionOnlyRefs.map((contextRef) => contextRef.label).join(', '),
                        })}
                    </p>
                )}
                {pendingChoice && (
                    <div className="mb-2 rounded-xl border border-slate-200 bg-white p-3">
                        <Questionnaire>
                            <QuestionnaireItem>
                                <QuestionnaireTitle>
                                    {t('tripAgent.whichOne', { label: pendingChoice.label })}
                                </QuestionnaireTitle>
                                <QuestionnaireChoices
                                    type="single"
                                    value={[]}
                                    onValueChange={(value) => {
                                        const chosen = pendingChoice.options.find(
                                            (option) => contextRefKey(option) === value[0],
                                        );
                                        if (chosen) {
                                            setChosenByLabel((current) => ({
                                                ...current,
                                                [chosen.label.toLowerCase()]: chosen,
                                            }));
                                        }
                                        setPendingChoice(null);
                                        focusPrompt();
                                    }}
                                >
                                    {pendingChoice.options.map((option) => (
                                        <QuestionnaireChoice key={contextRefKey(option)} value={contextRefKey(option)}>
                                            <span className="text-sm text-slate-900">{option.label}</span>
                                            <QuestionnaireChoiceDescription>{contextMeta(option)}</QuestionnaireChoiceDescription>
                                        </QuestionnaireChoice>
                                    ))}
                                </QuestionnaireChoices>
                            </QuestionnaireItem>
                        </Questionnaire>
                    </div>
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
                                <TripAgentMentionMenu
                                    items={menuItems}
                                    activeIndex={menuIndex}
                                    listId="trip-agent-mention-menu"
                                    emptyLabel={commandMenu === 'context' ? t('tripAgent.noContext') : t('tripAgent.noCommand')}
                                    onSelect={selectMenuItem}
                                    onHover={setMenuIndex}
                                />
                            </div>
                        </>
                    )}
                    <PromptInput onSubmit={({ text }) => submitText(text)}>
                        <PromptInputBody>
                            <TripAgentPromptField
                                value={draftText}
                                onValueChange={updateDraft}
                                onKeyDown={handleMenuKeyDown}
                                contextRefs={selectableContextRefs}
                                placeholder={t('tripAgent.placeholder')}
                                disabled={isQuotaReached}
                                textareaRef={textareaRef}
                                ariaExpanded={Boolean(commandMenu)}
                                ariaControls={commandMenu ? 'trip-agent-mention-menu' : undefined}
                                ariaActiveDescendant={commandMenu && menuItems.length > 0
                                    ? `trip-agent-mention-menu-option-${menuIndex}`
                                    : undefined}
                            />
                        </PromptInputBody>
                        <PromptInputFooter className="justify-between">
                            <div className="flex min-w-0 items-center gap-1">
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleMenu('context')} aria-label={t('tripAgent.contextMenu')}>
                                    <AtSign className="size-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleMenu('commands')} aria-label={t('tripAgent.commandMenu')}>
                                    <SlashGlyph />
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
    onPreviewTrip,
    onRevertAgentChange,
    onReapplyAgentChange,
}) => {
    const { t, i18n } = useTranslation('common');
    const now = useMinuteTick();
    const [bootstrap, setBootstrap] = useState<TripAgentBootstrap | null>(null);
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<{ code: string } | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    const panelRef = useRef<HTMLElement | null>(null);
    const launcherRef = useRef<Element | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        launcherRef.current = document.activeElement;
        const firstField = panelRef.current?.querySelector<HTMLElement>('textarea, button');
        firstField?.focus();
        return () => {
            // Send focus back where it came from, so closing does not drop the
            // reader at the top of the document.
            const launcher = launcherRef.current as HTMLElement | null;
            if (launcher?.isConnected) launcher.focus();
        };
    }, [isOpen]);

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
            // The code is localized here; server text is never shown verbatim.
            setLoadError({ code: readTripAgentError(error).code });
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
                className={`trip-agent-panel-enter fixed inset-x-0 bottom-0 z-[1500] flex flex-col overflow-hidden rounded-t-[1.5rem] border border-slate-200 bg-white shadow-[0_-24px_80px_rgba(15,23,42,0.18)] transition-[height] duration-200 sm:inset-x-auto sm:bottom-4 sm:end-4 sm:h-[min(720px,calc(100dvh-2rem))] sm:w-[420px] sm:rounded-[1.5rem] sm:shadow-2xl ${
                    isPreviewActive ? 'h-[min(42dvh,340px)]' : 'h-[min(82dvh,720px)]'
                }`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                onKeyDown={handlePanelKeyDown}
            >
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white"><Sparkles className="size-4" /></div>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-slate-950">{t('tripAgent.title')}</h2>
                    <p className="truncate text-xs text-slate-500">
                        {currentThread ? currentThread.title : t('tripAgent.subtitle')}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
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
                        <p className="px-1 py-4 text-center text-xs text-slate-500">{t('tripAgent.historyEmpty')}</p>
                    )}
                    {threadSections.map((section) => (
                        <section key={section.key} className="mb-3">
                            <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                                            className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-start transition-colors ${
                                                thread.id === currentThreadId
                                                    ? 'border-accent-200 bg-accent-50'
                                                    : 'border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm text-slate-900">{thread.title}</span>
                                                <span className="block text-[11px] text-slate-500">
                                                    {formatTripAgentTimestamp(thread.updatedAt, i18n.language, now)}
                                                </span>
                                            </span>
                                            {thread.id === currentThreadId && <Check className="mt-0.5 size-3.5 text-accent-600" />}
                                            {thread.status === 'archived' && <Archive className="mt-0.5 size-3.5 text-slate-400" />}
                                        </button>
                                        {thread.status === 'active' && (
                                            <button
                                                type="button"
                                                onClick={() => void archiveThread(thread.id)}
                                                className="mt-0.5 w-full rounded-lg px-2.5 py-1 text-start text-[11px] text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                            >
                                                {t('tripAgent.archive')}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {section.hiddenCount > 0 && (
                                <p className="px-1 pt-1 text-[11px] text-slate-400">
                                    {t('tripAgent.historyHidden', { count: section.hiddenCount })}
                                </p>
                            )}
                        </section>
                    ))}
                </div>
            ) : loadError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                    <Lock className="size-6 text-amber-600" />
                    <p className="text-sm text-slate-700">
                        {t([`tripAgent.errors.${loadError.code}`, 'tripAgent.errors.TRIP_AGENT_REQUEST_FAILED'])}
                    </p>
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
                    changeSetStatuses={changeSetStatuses}
                    onQuotaMayHaveChanged={() => void refresh(currentThread.id)}
                    onAdoptCommittedTripVersion={onAdoptCommittedTripVersion}
                    onPreviewTrip={onPreviewTrip}
                    onPreviewActiveChange={setIsPreviewActive}
                    onRevertAgentChange={onRevertAgentChange}
                    onReapplyAgentChange={onReapplyAgentChange}
                />
            ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-500">{t('tripAgent.loading')}</div>
            )}
            </aside>
        </>
    );
};
