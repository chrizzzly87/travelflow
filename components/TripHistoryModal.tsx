import React, { useRef, type ComponentType } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

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
    onClose,
    onUndo,
    onRedo,
    onToggleShowAllHistory,
    onGo,
    formatHistoryTime,
}) => {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useFocusTrap({
        isActive: isOpen,
        containerRef: dialogRef,
        initialFocusRef: closeButtonRef,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close change history dialog"
            />
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="trip-history-title" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 id="trip-history-title" className="text-lg font-bold text-gray-900">Change History</h3>
                        <p className="text-xs text-gray-500">
                            {isExamplePreview
                                ? 'Example trips are editable for exploration, but changes are not saved.'
                                : 'Undo/redo works with browser history and Cmd+Z / Cmd+Y.'}
                        </p>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={onClose} className="px-2 py-1 rounded text-xs font-semibold text-gray-500 hover:bg-gray-100">
                        Close
                    </button>
                </div>
                {isExamplePreview ? (
                    <div className="p-5 text-sm text-slate-600">
                        This example trip is a playground. History snapshots are intentionally disabled so no local or database state is created while exploring.
                    </div>
                ) : (
                    <>
                        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onUndo}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                            >
                                Undo
                            </button>
                            <button
                                type="button"
                                onClick={onRedo}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                            >
                                Redo
                            </button>
                            <button
                                type="button"
                                onClick={onToggleShowAllHistory}
                                className="ml-auto px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                            >
                                {showAllHistory ? 'Show Recent' : 'Show All'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {items.length === 0 ? (
                                <div className="p-6 text-sm text-gray-500">No history entries yet.</div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {items.map((item) => {
                                        const Icon = item.meta.Icon;
                                        return (
                                            <li key={item.id} className={`p-4 flex items-start gap-3 ${item.isCurrent ? 'bg-accent-50/70' : 'hover:bg-gray-50/80'}`}>
                                                <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${item.meta.iconClass}`}>
                                                    <Icon size={15} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${item.meta.badgeClass}`}>
                                                            {item.meta.label}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{formatHistoryTime(item.ts)}</span>
                                                        {item.isCurrent && (
                                                            <span className="text-[10px] font-semibold text-accent-600 bg-accent-100 px-2 py-0.5 rounded-full">
                                                                Current
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-sm font-semibold text-gray-900 leading-snug">{item.details}</div>
                                                </div>
                                                <div className="shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => onGo(item)}
                                                        className="px-2 py-1 rounded-md border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
            </div>
        </div>
    );
};
