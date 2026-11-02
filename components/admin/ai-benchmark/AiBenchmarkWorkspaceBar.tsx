import React from 'react';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { TabsList, TabsTrigger } from '../../ui/tabs';

/** The sticky tab strip with connection, queue and active-model status. */
export const AiBenchmarkWorkspaceBar: React.FC<{
    runCount: number;
    hasAccessToken: boolean;
    isAuthenticated: boolean;
    hasPendingRuns: boolean;
    runningCount: number;
    queuedCount: number;
    runnableCount: number;
    selectedCount: number;
}> = ({ runCount, hasAccessToken, isAuthenticated, hasPendingRuns, runningCount, queuedCount, runnableCount, selectedCount }) => (
    // top-16 clears the shell's sticky 56px top bar; top-2 slid under it.
    <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/95 p-2 backdrop-blur">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="results">Runs · <span className="tabular-nums">{runCount}</span></TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {!hasAccessToken && (
                <AdminStatusBadge tone={isAuthenticated ? 'neutral' : 'danger'}>
                    {isAuthenticated ? 'Connecting…' : 'Sign in again to run'}
                </AdminStatusBadge>
            )}
            {hasPendingRuns && (
                <span role="status">
                    <AdminStatusBadge tone="info">
                        <span className="tabular-nums">{runningCount} running · {queuedCount} queued</span>
                    </AdminStatusBadge>
                </span>
            )}
            <span className="tabular-nums">{runnableCount} of {selectedCount} models active</span>
        </div>
    </div>
);
