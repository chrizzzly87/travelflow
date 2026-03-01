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
                <div className="p-5 text-sm text-slate-600">
                    This example trip is a playground. History snapshots are intentionally disabled so no local or database state is created while exploring.
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                        <button
                            type="button"
                            onClick={onUndo}
                            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                            Undo
                        </button>
                        <button
                            type="button"
                            onClick={onRedo}
                            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                            Redo
                        </button>
                        <button
                            type="button"
                            onClick={onToggleShowAllHistory}
                            className="ml-auto rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                            {showAllHistory ? 'Show Recent' : 'Show All'}
                        </button>
                    </div>
                    {hasUnsyncedChanges && (
                        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {failedSyncCount > 0 ? failedSyncLabel : pendingSyncLabel}
                        </div>
                    )}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="p-6 text-sm text-gray-500">No history entries yet.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {items.map((item, index) => {
                                    const Icon = item.meta.Icon;
                                    const showUnsyncedBadge = hasUnsyncedChanges && index === 0;
                                    return (
                                        <li key={item.id} className={`flex items-start gap-3 p-4 ${item.isCurrent ? 'bg-accent-50/70' : 'hover:bg-gray-50/80'}`}>
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.meta.iconClass}`}>
                                                <Icon size={15} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.meta.badgeClass}`}>
                                                        {item.meta.label}
                                                    </span>
                                                    <span className="text-xs text-gray-500">{formatHistoryTime(item.ts)}</span>
                                                    {item.isCurrent && (
                                                        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-600">
                                                            Current
                                                        </span>
                                                    )}
                                                    {showUnsyncedBadge && (
                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                                            Not synced
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm font-semibold leading-snug text-gray-900">{item.details}</div>
                                            </div>
                                            <div className="shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onGo(item)}
                                                    className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                                >
                                                    Go
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
