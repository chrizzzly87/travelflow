import React from 'react';
import { AI_REASONING_EFFORTS } from '../../../shared/aiReasoning';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import type { BenchmarkSession } from './aiBenchmarkApi';
import {
    BENCHMARK_CONCURRENCY_MAX,
    BENCHMARK_TIMEOUT_MAX_SECONDS,
    BENCHMARK_TIMEOUT_MIN_SECONDS,
    REASONING_MODE_LABELS,
    parseTimeoutInput,
    type BenchmarkExecutionSettings,
    type BenchmarkReasoningMode,
} from './aiBenchmarkModel';

const CONCURRENCY_OPTIONS = Array.from({ length: BENCHMARK_CONCURRENCY_MAX }, (_, index) => index + 1);

/** Setup: session name, reasoning default, parallelism, time limit and output size of the next run. */
export const AiBenchmarkExecutionSection: React.FC<{
    execution: BenchmarkExecutionSettings;
    session: BenchmarkSession | null;
    reasoningTargetCount: number;
    runnableTargetCount: number;
    onChange: (patch: Partial<Omit<BenchmarkExecutionSettings, 'modelReasoningModes'>>) => void;
}> = ({ execution, session, reasoningTargetCount, runnableTargetCount, onChange }) => {
    const queuedBehindConcurrency = Math.max(0, runnableTargetCount - execution.concurrency);
    return (
        <section className="flex flex-col gap-3 p-4 md:p-6">
            <AdminSectionHeader
                title="Execution"
                description="Applies to the next run. A model's own reasoning setting wins over the run default."
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    New session name
                    <Input
                        aria-label="Session name"
                        value={execution.sessionName}
                        onChange={(event) => onChange({ sessionName: event.target.value })}
                        className="h-9"
                    />
                    <span className="font-normal text-muted-foreground">
                        {session
                            ? `Runs join “${session.name || 'Unnamed session'}”. Start a new session from the Runs menu to use this name.`
                            : 'Names the session your next run creates.'}
                    </span>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Run default reasoning
                    <Select value={execution.reasoningMode} onValueChange={(value) => onChange({ reasoningMode: value as BenchmarkReasoningMode })}>
                        <SelectTrigger aria-label="Run default reasoning" className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="provider-default">Model default</SelectItem>
                                {AI_REASONING_EFFORTS.map((effort) => (
                                    <SelectItem key={effort} value={effort}>{REASONING_MODE_LABELS[effort]}</SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <span className="font-normal text-muted-foreground">Used by {reasoningTargetCount} compatible model{reasoningTargetCount === 1 ? '' : 's'}.</span>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Parallel requests
                    <Select value={String(execution.concurrency)} onValueChange={(value) => onChange({ concurrency: Number(value) })}>
                        <SelectTrigger aria-label="Parallel requests" className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {CONCURRENCY_OPTIONS.map((count) => (
                                    <SelectItem key={count} value={String(count)}>{count} at a time</SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <span className="font-normal text-muted-foreground">
                        {queuedBehindConcurrency > 0
                            ? `${queuedBehindConcurrency} model${queuedBehindConcurrency === 1 ? '' : 's'} will wait in the queue. Lower reduces timeout risk.`
                            : 'Lower reduces provider contention and timeout risk.'}
                    </span>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Time limit
                    <Input
                        type="number"
                        aria-label="Timeout seconds"
                        min={BENCHMARK_TIMEOUT_MIN_SECONDS}
                        max={BENCHMARK_TIMEOUT_MAX_SECONDS}
                        step={5}
                        value={execution.timeoutSeconds}
                        className="h-9 tabular-nums"
                        onChange={(event) => onChange({ timeoutSeconds: parseTimeoutInput(event.target.value) })}
                    />
                    <span className="font-normal text-muted-foreground">Seconds per model; actual latency stays visible.</span>
                </label>

                <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-secondary p-3">
                    <div>
                        <div className="text-xs font-medium text-foreground">Compact output</div>
                        <p className="mt-1 text-xs text-muted-foreground">Shorter JSON, faster comparisons.</p>
                    </div>
                    <Switch aria-label="Compact output" checked={execution.compactOutput} onCheckedChange={(compactOutput) => onChange({ compactOutput })} />
                </div>
            </div>
        </section>
    );
};
