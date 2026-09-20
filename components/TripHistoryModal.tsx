import React, { type ComponentType } from 'react';
import { AppModal } from './ui/app-modal';

type HistoryItemTone = 'add' | 'remove' | 'update' | 'neutral' | 'info';

interface HistoryItemMeta {
    label: string;
    iconClass: string;
    badgeClass: string;
    Icon: ComponentType<{ size?: number }>;
}

export interface TripHistoryModalItem {
    id: string;
    url: string;
    ts: number;
    isCurrent: boolean;
    details: string;
    tone: HistoryItemTone;
    meta: HistoryItemMeta;
}

export interface TripHistoryModalProps {
    isOpen: boolean;
    isExamplePreview: boolean;
    showAllHistory: boolean;
    items: TripHistoryModalItem[];
    pendingSyncCount: number;
    failedSyncCount: number;
    onClose: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onToggleShowAllHistory: () => void;
    onGo: (item: TripHistoryModalItem) => void;
    formatHistoryTime: (timestamp: number) => string;
}

export const TripHistoryModal: React.FC<TripHistoryModalProps> = ({
    isOpen,
    isExamplePreview,
    showAllHistory,
    items,
    pendingSyncCount,
    failedSyncCount,
    onClose,
    onUndo,
    onRedo,
    onToggleShowAllHistory,
    onGo,
    formatHistoryTime,
}) => {
    const hasUnsyncedChanges = pendingSyncCount > 0;
    const failedSyncLabel = failedSyncCount === 1
        ? '1 queued change still failed to sync. Retry sync to publish it.'
        : `${failedSyncCount} queued changes still failed to sync. Retry sync to publish them.`;
    const pendingSyncLabel = pendingSyncCount === 1
        ? '1 latest change is saved locally and not synced yet.'
        : `${pendingSyncCount} latest changes are saved locally and not synced yet.`;

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title="Change History"
            description={
                isExamplePreview
                    ? 'Example trips are editable for exploration, but changes are not saved.'
                    : 'Undo/redo works with browser history and Cmd+Z / Cmd+Y.'
            }
            closeLabel="Close change history dialog"
            size="sm"
            mobileSheet={false}
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
            contentClassName="sm:w-[min(92vw,560px)]"
        >
            {isExamplePreview ? (
                <div className="p-5 text-sm text-muted-foreground">
                    This example trip is a playground. History snapshots are intentionally disabled so no local or database state is created while exploring.
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 border-b border-border p-3">
                        <button
                            type="button"
                            onClick={onUndo}
                            className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gray-200"
                        >
                            Undo
                        </button>
                        <button
                            type="button"
                            onClick={onRedo}
                            className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gray-200"
                        >
                            Redo
                        </button>
                        <button
                            type="button"
                            onClick={onToggleShowAllHistory}
                            className="ml-auto rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-gray-200"
                        >
                            {showAllHistory ? 'Show Recent' : 'Show All'}
                        </button>
                    </div>
                    {hasUnsyncedChanges && (
                        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30">
                            {failedSyncCount > 0 ? failedSyncLabel : pendingSyncLabel}
                        </div>
                    )}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="p-6 text-sm text-muted-foreground">No history entries yet.</div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {items.map((item, index) => {
                                    const Icon = item.meta.Icon;
                                    const showUnsyncedBadge = hasUnsyncedChanges && index === 0;
                                    return (
                                        <li key={item.id} className={`flex items-start gap-3 p-4 ${item.isCurrent ? 'bg-accent-50/70 dark:bg-accent-400/12' : 'hover:bg-secondary/80'}`}>
                                            <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${item.meta.iconClass}`}>
                                                <Icon size={15} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.meta.badgeClass}`}>
                                                        {item.meta.label}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{formatHistoryTime(item.ts)}</span>
                                                    {item.isCurrent && (
                                                        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-600 dark:bg-accent-400/12 dark:text-accent-300">
                                                            Current
                                                        </span>
                                                    )}
                                                    {showUnsyncedBadge && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-400/12 dark:text-amber-200">
                                                            Not synced
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm font-semibold leading-snug text-foreground">{item.details}</div>
                                            </div>
                                            <div className="shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onGo(item)}
                                                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary dark:text-foreground"
                                                >
                                                    Open trip
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </AppModal>
    );
};
