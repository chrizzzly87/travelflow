import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
    AlertCircle,
    ArrowRight,
    AtSign,
    BedDouble,
    Bot,
    CircleDot,
    MapPin,
    MessageSquare,
    Route,
    RotateCcw,
    Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
    buildTripAgentChatRequest,
    readTripAgentError,
    tripAgentFetch,
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
import { Suggestions } from '../ai-elements/suggestion';
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
import {
    ambiguousMentionLabels,
    findTripAgentMentions,
    insertMentionAt,
    mentionedContextRefs,
    type TripAgentMentionSpan,
} from './tripAgentMentions';
import {
    Questionnaire,
    QuestionnaireChoice,
    QuestionnaireChoiceDescription,
    QuestionnaireChoices,
    QuestionnaireItem,
    QuestionnaireTitle,
} from '../ui/questionnaire';
import { formatTripAgentTimestamp } from './tripAgentTime';
import { useMinuteTick } from './useMinuteTick';
import { Button } from '../ui/button';
import type { TripAgentPanelProps } from './tripAgentPanelTypes';
import { isDayTrip } from '../../shared/activityStay';
import { buildTripAgentDayTripPresets } from './tripAgentDayTripPresets';
import { buildTripAgentExamples, type TripAgentExample } from './tripAgentExamples';



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
            <mark key={`${match.index}-${match[0]}`} className="rounded-[5px] bg-mention px-0.5 py-px text-foreground ring-1 ring-mention-ring">
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
    const { t } = useTranslation('tripAgent');
    const blocks = useMemo(() => buildTripAgentMessageBlocks(message, isStreaming), [message, isStreaming]);
    const timestamp = formatTripAgentTimestamp(message.metadata?.createdAt as string | undefined, locale, now);
    const persistedStatus = message.metadata?.status as string | undefined;
    const wasInterrupted = message.role === 'assistant'
        && !isStreaming
        && (persistedStatus === 'streaming' || persistedStatus === 'cancelled' || persistedStatus === 'failed');
    const authorLabel = message.role === 'assistant'
        ? t('agentName')
        : isOwnMessage ? null : (message.metadata?.authorLabel as string | undefined) || null;

    return (
        <Message from={message.role}>
            {(authorLabel || timestamp) && (
                <div className={`flex items-center gap-1.5 text-[11px] text-muted-foreground ${isOwnMessage ? 'justify-end' : ''}`}>
                    {authorLabel && <span className="font-medium text-muted-foreground">{authorLabel}</span>}
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
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:bg-rose-400/12 dark:border-rose-400/30"
                            >
                                <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">{t('proposalFailed')}</p>
                                {block.detail && (
                                    <p className="mt-1 break-words text-[11px] leading-4 text-rose-800 dark:text-rose-200">{block.detail}</p>
                                )}
                                {onRetry && (
                                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                                        <RotateCcw className="size-3.5" />{t('retryMessage')}
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
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 dark:bg-amber-400/12 dark:border-amber-400/30">
                        <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200">{t('runInterrupted')}</span>
                        {onRetry && (
                            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                                <RotateCcw className="size-3.5" />{t('continueRun')}
                            </Button>
                        )}
                    </div>
                )}
                {hasFailed && onRetry && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <span className="me-auto text-[11px] font-medium text-rose-700 dark:text-rose-200">{t('messageFailed')}</span>
                        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                            <RotateCcw className="size-3.5" />{t('retryMessage')}
                        </Button>
                    </div>
                )}
            </MessageContent>
        </Message>
    );
};

export interface TripAgentChatSessionProps {
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
    /** Called once the prompt field exists, so the panel can move focus to it. */
    onReady?: () => void;
    /**
     * Resolves once the thread exists on the server. A draft chat is only
     * saved when its first message goes out, so sending waits on this.
     */
    onBeforeSend?: (threadId: string) => Promise<void>;
    /** Other chats to continue, offered while this one is still empty. */
    recentChats?: TripAgentThread[];
    onOpenChat?: (threadId: string) => void;
    onShowAllChats?: () => void;
    /** True before the trip has any chats: the empty chat introduces the agent. */
    showOnboarding?: boolean;
}

/**
 * The chat itself: streaming, the prompt field and every card a run can
 * produce. It is its own chunk so the panel around it can open at once.
 */
export const TripAgentChatSession: React.FC<TripAgentChatSessionProps> = ({
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
    onReady,
    onBeforeSend,
    recentChats = [],
    onOpenChat,
    onShowAllChats,
    showOnboarding = false,
}) => {
    const { t, i18n } = useTranslation('tripAgent');
    const now = useMinuteTick();
    useEffect(() => {
        onReady?.();
    }, [onReady]);
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
    const sendFetch = useCallback<typeof tripAgentFetch>(async (input, init) => {
        if (onBeforeSend) await onBeforeSend(thread.id);
        return tripAgentFetch(input, init);
    }, [onBeforeSend, thread.id]);
    const transport = useMemo(() => new DefaultChatTransport<TripAgentMessage>({
        api: '/api/trip-agent',
        fetch: sendFetch,
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
    }), [activeContextRefs, sendFetch, thread.id, trip.id]);
    const { messages, sendMessage, status, stop, error, clearError } = useChat<TripAgentMessage>({
        id: thread.id,
        messages: initialMessages,
        transport,
        throttle: 40,
        onError: onQuotaMayHaveChanged,
        onFinish: onQuotaMayHaveChanged,
    });
    const examples = useMemo(() => buildTripAgentExamples({ t, trip, contextRefs }), [contextRefs, t, trip]);
    // The "/" menu offers the examples plus day-trip prompts for the current selection.
    const commandPresets = useMemo(() => [
        ...buildTripAgentDayTripPresets({ t, trip, contextRefs }),
        ...examples.map((example) => example.prompt),
    ], [contextRefs, examples, t, trip]);
    // An example is written into the field to be adapted, not sent; until it
    // is, a hint says how to change it.
    const [isExampleDraft, setIsExampleDraft] = useState(false);
    // The mention whose swap list is open; only meaningful while the list is.
    // Where the caret was at the last edit, so a picked stop lands there.
    const draftCaretRef = useRef<number | null>(null);
    // A caret to place once a programmatic edit is in the field. Setting a
    // controlled value moves the caret to the end, so it is restored in a
    // layout effect, after the new value is committed and before paint.
    const pendingCaretRef = useRef<number | null>(null);
    useLayoutEffect(() => {
        const caret = pendingCaretRef.current;
        if (caret === null) return;
        pendingCaretRef.current = null;
        textareaRef.current?.setSelectionRange(caret, caret);
    }, [draftText]);
    const [swapTarget, setSwapTarget] = useState<{ start: number; end: number; label: string } | null>(null);
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
        setIsExampleDraft(false);
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

    const openSwap = (span: TripAgentMentionSpan, source: 'click' | 'keyboard' | 'example') => {
        setSwapTarget({ start: span.start, end: span.end, label: span.label });
        setCommandMenu('context');
        setMenuQuery('');
        setMenuIndex(0);
        if (source !== 'example') trackEvent('trip_agent__mention--swap_open', { trip_id: trip.id, source });
    };

    const applyExample = (example: TripAgentExample) => {
        setDraftText(example.prompt);
        draftCaretRef.current = example.prompt.length;
        setIsExampleDraft(true);
        trackEvent('trip_agent__example--insert', { trip_id: trip.id, example: example.key });
        // The example's stop is the part most worth changing, so its list
        // opens straight away; Escape or typing puts it away.
        const firstMention = findTripAgentMentions(example.prompt, selectableContextRefs)
            .find((span) => span.contextRef);
        if (firstMention) openSwap(firstMention, 'example');
        else setCommandMenu(null);
        pendingCaretRef.current = firstMention ? firstMention.end : example.prompt.length;
        textareaRef.current?.focus();
    };

    const updateDraft = (value: string, caret = value.length) => {
        setDraftText(value);
        draftCaretRef.current = caret;
        // Any edit moves the text under a swap target, so the swap ends.
        setSwapTarget(null);
        if (!value.trim()) setIsExampleDraft(false);
        // Only what is typed right before the caret opens the @ list, so it
        // also works in the middle of a sentence.
        const mention = /(?:^|\s)@([^\s]*)$/.exec(value.slice(0, caret));
        const command = /^\s*\/([^\s]*)$/.exec(value);
        if (mention) openMenu('context', mention[1]);
        else if (command) openMenu('commands', command[1]);
        else setCommandMenu(null);
    };

    const openMenu = (mode: 'context' | 'commands', query = '') => {
        setSwapTarget(null);
        setCommandMenu(mode);
        setMenuQuery(query);
        setMenuIndex(0);
    };

    const toggleMenu = (mode: 'context' | 'commands') => {
        if (commandMenu === mode) {
            setCommandMenu(null);
            return;
        }
        // The @ button adds at the caret the field had, not at the end.
        draftCaretRef.current = textareaRef.current?.selectionStart ?? draftText.length;
        openMenu(mode);
        focusPrompt();
    };

    const selectContext = (contextRef: TripAgentContextRef) => {
        const target = commandMenu === 'context' ? swapTarget : null;
        if (target) {
            // Swap the mention in place and leave the caret right after it.
            const replacement = `@${contextRef.label}`;
            setDraftText((current) => `${current.slice(0, target.start)}${replacement}${current.slice(target.end)}`);
            pendingCaretRef.current = target.start + replacement.length;
            trackEvent('trip_agent__mention--swap', { trip_id: trip.id, context_kind: contextRef.kind });
        } else {
            const next = insertMentionAt(draftText, draftCaretRef.current ?? draftText.length, contextRef.label);
            pendingCaretRef.current = next.caret;
            setDraftText(next.value);
            draftCaretRef.current = next.caret;
        }
        setSwapTarget(null);
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
        const day = item ? t('dayValue', { day: Math.floor(item.startDateOffset) + 1 }) : null;
        const kindLabel = item && isDayTrip(item)
            ? t('common:tripView.activityPlan.kindDayTrip')
            : t(`contextKinds.${contextRef.kind}`);
        return [kindLabel, city?.title, day].filter(Boolean).join(' · ');
    };

    const menuItems = useMemo((): TripAgentMentionItem[] => {
        const query = menuQuery.trim().toLowerCase();
        if (commandMenu === 'commands') {
            return commandPresets
                .filter((suggestion) => !query || suggestion.toLowerCase().includes(query))
                .map((suggestion) => ({
                    key: `preset:${suggestion}`,
                    group: t('commandMenu'),
                    label: suggestion,
                    icon: <SlashGlyph className="w-4 shrink-0 text-center text-muted-foreground" />,
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
                group: t(`contextGroups.${kind}`),
                label: contextRef.label,
                meta: contextMeta(contextRef),
                isSelected: activeContextRefs.some((candidate) => contextRefKey(candidate) === contextRefKey(contextRef)),
                icon: <ContextKindIcon kind={contextRef.kind} className="size-4 shrink-0 text-muted-foreground" />,
            })));
    }, [activeContextRefs, commandMenu, commandPresets, menuQuery, selectableContextRefs, t, trip.items]);

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
            // Close only the list; the panel must not take this Escape too.
            event.preventDefault();
            event.stopPropagation();
            setCommandMenu(null);
            setSwapTarget(null);
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
                                title={t('noMessages')}
                                description={t('subtitle')}
                            />
                            {recentChats.length > 0 && onOpenChat && (
                                <nav aria-labelledby="trip-agent-recent-chats" className="space-y-1">
                                    <h3 id="trip-agent-recent-chats" className="px-1 text-[11px] font-medium text-muted-foreground">
                                        {t('recentChats')}
                                    </h3>
                                    <ul className="space-y-0.5">
                                        {recentChats.map((chat) => (
                                            <li key={chat.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenChat(chat.id)}
                                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                                    {...getAnalyticsDebugAttributes('trip_agent__recent_chat--open', { trip_id: trip.id })}
                                                >
                                                    <MessageSquare aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 flex-1 truncate text-foreground">{chat.title}</span>
                                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                                        {formatTripAgentTimestamp(chat.updatedAt, i18n.language, now)}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    {onShowAllChats && (
                                        <button
                                            type="button"
                                            onClick={onShowAllChats}
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        >
                                            <span className="flex-1">{t('allChats')}</span>
                                            <ArrowRight aria-hidden="true" className="size-3.5 rtl:rotate-180" />
                                        </button>
                                    )}
                                </nav>
                            )}
                            {showOnboarding && <TripAgentCapabilities />}
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
                                <div className="text-[11px] text-muted-foreground">
                                    <span className="font-medium text-muted-foreground">{t('agentName')}</span>
                                    <span aria-hidden="true"> · </span>
                                    <span>{formatTripAgentTimestamp(Date.now(), i18n.language, now)}</span>
                                </div>
                            )}
                            {isProposalPending
                                ? <TripAgentProposalSkeleton />
                                : (
                                    <TripAgentWorkingIndicator
                                        label={t('activityWorking')}
                                        hint={t('activityStillWorking')}
                                    />
                                )}
                        </div>
                    )}
                    {errorInfo && (
                        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-rose-950 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30" role="alert">
                            <div className="flex items-start gap-2.5">
                                <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold leading-5">
                                        {t([`errors.${errorInfo.code}`, 'errors.TRIP_AGENT_REQUEST_FAILED'])}
                                    </h3>
                                    <p className="mt-1 break-words text-xs leading-5 text-rose-800 dark:text-rose-200">{errorInfo.detail || errorInfo.message}</p>
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

            <div className="border-t border-border bg-card/95 p-3 backdrop-blur">
                {isExampleDraft && draftText.trim() ? (
                    <p id="trip-agent-example-hint" className="mb-1.5 px-1 text-[11px] text-muted-foreground" role="status">
                        {t('exampleHint')}
                    </p>
                ) : messages.length === 0 && (
                    <Suggestions className="mb-2 gap-1.5" aria-label={t('examplesLabel')}>
                        {examples.map((example) => (
                            // The app-wide tooltip layer reads data-tooltip. Radix
                            // Tooltip never opens under preact/compat.
                            <Button
                                key={example.key}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyExample(example)}
                                data-tooltip={t('exampleTooltip', { prompt: example.prompt })}
                                className="h-7 cursor-pointer rounded-full px-3 text-xs font-normal text-muted-foreground hover:text-foreground"
                                {...getAnalyticsDebugAttributes('trip_agent__example--insert', { trip_id: trip.id, example: example.key })}
                            >
                                {example.label}
                            </Button>
                        ))}
                    </Suggestions>
                )}
                {selectionOnlyRefs.length > 0 && (
                    <p className="mb-1.5 truncate px-1 text-[11px] text-muted-foreground">
                        {t('alsoUsingSelection', {
                            labels: selectionOnlyRefs.map((contextRef) => contextRef.label).join(', '),
                        })}
                    </p>
                )}
                {pendingChoice && (
                    <div className="mb-2 rounded-xl border border-border bg-card p-3">
                        <Questionnaire>
                            <QuestionnaireItem>
                                <QuestionnaireTitle>
                                    {t('whichOne', { label: pendingChoice.label })}
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
                                            <span className="text-sm text-foreground">{option.label}</span>
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
                                aria-label={t('closeMenu')}
                                className="fixed inset-0 z-10 cursor-default"
                                onClick={() => setCommandMenu(null)}
                            />
                            <div className="absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-border bg-card shadow-xl dark:shadow-none">
                                <TripAgentMentionMenu
                                    items={menuItems}
                                    activeIndex={menuIndex}
                                    listId="trip-agent-mention-menu"
                                    emptyLabel={commandMenu === 'context' ? t('noContext') : t('noCommand')}
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
                                placeholder={t('placeholder')}
                                disabled={isQuotaReached}
                                textareaRef={textareaRef}
                                ariaExpanded={Boolean(commandMenu)}
                                ariaControls={commandMenu ? 'trip-agent-mention-menu' : undefined}
                                ariaActiveDescendant={commandMenu && menuItems.length > 0
                                    ? `trip-agent-mention-menu-option-${menuIndex}`
                                    : undefined}
                                activeMention={commandMenu === 'context' ? swapTarget : null}
                                onMentionActivate={(span) => openSwap(span, 'click')}
                                ariaDescribedBy={isExampleDraft && draftText.trim() ? 'trip-agent-example-hint' : undefined}
                            />
                        </PromptInputBody>
                        <PromptInputFooter className="justify-between">
                            <div className="flex min-w-0 items-center gap-1">
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleMenu('context')} aria-label={t('contextMenu')}>
                                    <AtSign className="size-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleMenu('commands')} aria-label={t('commandMenu')}>
                                    <SlashGlyph />
                                </Button>
                                {quota.remaining !== null && (
                                    <span className="truncate px-1 text-[11px] text-muted-foreground">
                                        {t('quota', { remaining: quota.remaining })}
                                    </span>
                                )}
                            </div>
                            <PromptInputSubmit
                                status={status}
                                onStop={stop}
                                disabled={isQuotaReached || !draftText.trim()}
                                aria-label={status === 'submitted' || status === 'streaming' ? t('stop') : t('send')}
                                title={status === 'submitted' || status === 'streaming' ? t('stop') : t('send')}
                            />
                        </PromptInputFooter>
                    </PromptInput>
                </div>
                {isQuotaReached && <p className="mt-2 text-xs text-amber-700 dark:text-amber-200" role="status">{t('quotaReached', { resetTime })}</p>}
            </div>
        </>
    );
};
