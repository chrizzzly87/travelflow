import { AlertTriangle, Brain, Check, ChevronDown, Loader2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Shimmer } from '../ai-elements/shimmer';
import { MessageResponse } from '../ai-elements/message';

export type TripAgentActivityState =
    | 'input-streaming'
    | 'input-available'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-available'
    | 'output-error'
    | 'output-denied';

export interface TripAgentActivityStep {
    key: string;
    name: string;
    state: TripAgentActivityState;
    detail?: string;
}

const isFailedState = (state: TripAgentActivityState): boolean => (
    state === 'output-error' || state === 'output-denied'
);

const StepIcon: React.FC<{ state: TripAgentActivityState }> = ({ state }) => {
    if (isFailedState(state)) return <AlertTriangle className="size-3 text-rose-600" />;
    if (state === 'output-available') return <Check className="size-3 text-emerald-600" />;
    return <Loader2 className="size-3 animate-spin text-slate-500" />;
};

/**
 * One collapsed block per contiguous run of thinking and tool activity, so a
 * long run reads as a single "Thought for 8s · 3 steps" line instead of one
 * card per event.
 */
/** Ticks once a second while a run is in flight so the header shows progress. */
const useElapsedSeconds = (isRunning: boolean): number => {
    const startedAtRef = useRef<number | null>(null);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!isRunning) {
            startedAtRef.current = null;
            return;
        }
        startedAtRef.current = Date.now();
        setElapsed(0);
        const timer = window.setInterval(() => {
            if (startedAtRef.current === null) return;
            setElapsed(Math.round((Date.now() - startedAtRef.current) / 1_000));
        }, 1_000);
        return () => window.clearInterval(timer);
    }, [isRunning]);

    return elapsed;
};

export const TripAgentActivityGroup: React.FC<{
    reasoningText: string;
    steps: TripAgentActivityStep[];
    isStreaming: boolean;
    durationSeconds?: number;
}> = ({ reasoningText, steps, isStreaming, durationSeconds }) => {
    const { t } = useTranslation('common');
    const [isOpen, setIsOpen] = useState(false);
    const [openStepKey, setOpenStepKey] = useState<string | null>(null);
    const hasFailure = steps.some((step) => isFailedState(step.state));
    const elapsedSeconds = useElapsedSeconds(isStreaming);
    const runningStep = [...steps].reverse().find((step) => !isFailedState(step.state) && step.state !== 'output-available');

    const label = isStreaming
        ? [
            runningStep ? t('tripAgent.activityRunningStep', { step: runningStep.name }) : t('tripAgent.activityWorking'),
            elapsedSeconds > 0 ? t('tripAgent.activityElapsed', { seconds: elapsedSeconds }) : null,
        ].filter(Boolean).join(' · ')
        : [
            durationSeconds !== undefined
                ? t('tripAgent.activityDone', { seconds: durationSeconds })
                : t('tripAgent.activityDoneUnknown'),
            steps.length > 0 ? t('tripAgent.activitySteps', { count: steps.length }) : null,
        ].filter(Boolean).join(' · ');

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70"
        >
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-2 text-start text-xs text-slate-600 transition-colors hover:text-slate-900">
                {isStreaming
                    ? <Loader2 className="size-3.5 shrink-0 animate-spin text-slate-500" />
                    : hasFailure
                        ? <AlertTriangle className="size-3.5 shrink-0 text-rose-600" />
                        : <Brain className="size-3.5 shrink-0 text-slate-500" />}
                <span className="min-w-0 flex-1 truncate">
                    {isStreaming ? <Shimmer duration={1}>{label}</Shimmer> : label}
                </span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            {isStreaming && elapsedSeconds >= 20 && (
                <p className="px-2.5 pb-2 text-[11px] text-slate-500" role="status">{t('tripAgent.activityStillWorking')}</p>
            )}
            <CollapsibleContent>
                <div className="space-y-2 border-t border-slate-200/70 px-2.5 py-2">
                    {reasoningText.trim() && (
                        <div className="text-xs leading-5 text-slate-600">
                            <MessageResponse>{reasoningText}</MessageResponse>
                        </div>
                    )}
                    {steps.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5">
                            {steps.map((step) => (
                                <li key={step.key}>
                                    <button
                                        type="button"
                                        onClick={() => setOpenStepKey((current) => current === step.key ? null : step.key)}
                                        aria-expanded={openStepKey === step.key}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                            isFailedState(step.state)
                                                ? 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        <StepIcon state={step.state} />
                                        <span className="truncate">{step.name}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {steps.map((step) => (openStepKey === step.key && step.detail ? (
                        <p key={`${step.key}-detail`} className="break-words rounded-lg bg-white px-2 py-1.5 text-[11px] leading-5 text-slate-600">
                            {step.detail}
                        </p>
                    ) : null))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
