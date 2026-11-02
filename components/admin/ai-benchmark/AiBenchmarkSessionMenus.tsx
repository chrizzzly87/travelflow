import React from 'react';
import { DotsThree, DownloadSimple, Plus, Trash } from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { Button } from '../../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

/** The runs card's Export menu and its session menu (new session, delete data). */
export const AiBenchmarkSessionMenus: React.FC<{
    hasSession: boolean;
    exportDisabled: boolean;
    sessionActionsDisabled: boolean;
    onExport: (includeLogs: boolean) => void;
    onStartNewSession: () => void;
    onDeleteSession: () => void;
}> = ({ hasSession, exportDisabled, sessionActionsDisabled, onExport, onStartNewSession, onDeleteSession }) => (
    <>
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={exportDisabled}>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={exportDisabled}
                >
                    <DownloadSimple />
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem
                    onSelect={() => {
                        trackEvent('admin__ai_benchmark--export', { include_logs: false });
                        onExport(false);
                    }}
                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--export', { include_logs: false })}
                >
                    All runs (ZIP)
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => {
                        trackEvent('admin__ai_benchmark--export', { include_logs: true });
                        onExport(true);
                    }}
                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--export', { include_logs: true })}
                >
                    All runs with logs (ZIP)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!hasSession}>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!hasSession}
                    aria-label="Session actions"
                    data-tooltip="Session actions"
                >
                    <DotsThree weight="bold" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem
                    disabled={sessionActionsDisabled}
                    onSelect={onStartNewSession}
                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--new_session')}
                >
                    <Plus />
                    Start a new session
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    variant="destructive"
                    disabled={sessionActionsDisabled}
                    onSelect={onDeleteSession}
                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--delete_session')}
                >
                    <Trash />
                    Delete session data…
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </>
);
