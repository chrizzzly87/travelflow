import React from 'react';
import { Play, StopCircle } from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes } from '../../../services/analyticsService';
import { Button } from '../../ui/button';

/** The page header's "Stop runs" (while runs are pending) and "Run N models". */
export const AiBenchmarkHeaderActions: React.FC<{
    hasPendingRuns: boolean;
    hasSession: boolean;
    cancelling: boolean;
    runDisabled: boolean;
    runnableCount: number;
    onStop: () => void;
    onRun: () => void;
}> = ({ hasPendingRuns, hasSession, cancelling, runDisabled, runnableCount, onStop, onRun }) => (
    <>
        {hasPendingRuns && (
            <Button
                type="button"
                variant="outline"
                onClick={onStop}
                disabled={cancelling || !hasSession}
                {...getAnalyticsDebugAttributes('admin__ai_benchmark--stop')}
            >
                <StopCircle />
                {cancelling ? 'Stopping…' : 'Stop runs'}
            </Button>
        )}
        <Button
            type="button"
            onClick={onRun}
            disabled={runDisabled}
            {...getAnalyticsDebugAttributes('admin__ai_benchmark--run', { source: 'header' })}
        >
            <Play weight="fill" />
            {`Run ${runnableCount} model${runnableCount === 1 ? '' : 's'}`}
        </Button>
    </>
);
