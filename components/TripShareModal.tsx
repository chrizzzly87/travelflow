import React from 'react';
import { ShareMode } from '../types';

export interface TripShareModalProps {
    isOpen: boolean;
    shareMode: ShareMode;
    onShareModeChange: (mode: ShareMode) => void;
    activeShareUrl: string | null;
    onClose: () => void;
    onCopyShareLink: () => void;
    onGenerateShare: () => void;
    isGeneratingShare: boolean;
}

export const TripShareModal: React.FC<TripShareModalProps> = ({
    isOpen,
    shareMode,
    onShareModeChange,
    activeShareUrl,
    onClose,
    onCopyShareLink,
    onGenerateShare,
    isGeneratingShare,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1600] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
            <div className="bg-white rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Share trip</h3>
                        <p className="text-xs text-gray-500">Choose view-only or collaboration editing.</p>
                    </div>
                    <button onClick={onClose} className="px-2 py-1 rounded text-xs font-semibold text-gray-500 hover:bg-gray-100">
                        Close
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <label className="flex items-start gap-3 text-sm cursor-pointer">
                        <input
                            type="radio"
                            name="share-mode"
                            className="mt-1"
                            checked={shareMode === 'view'}
                            onChange={() => onShareModeChange('view')}
                        />
                        <span>
                            <span className="font-semibold text-gray-900">View only</span>
                            <span className="block text-xs text-gray-500">People can see the trip but can’t edit.</span>
                        </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm cursor-pointer">
                        <input
                            type="radio"
                            name="share-mode"
                            className="mt-1"
                            checked={shareMode === 'edit'}
                            onChange={() => onShareModeChange('edit')}
                        />
                        <span>
                            <span className="font-semibold text-gray-900">Allow editing</span>
                            <span className="block text-xs text-gray-500">Anyone with the link can make changes.</span>
                        </span>
                    </label>
                    {activeShareUrl && (
                        <div className="mt-2">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Share link</div>
                            <div className="flex items-center gap-2">
                                <input
                                    value={activeShareUrl}
                                    readOnly
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                                />
                                <button
                                    type="button"
                                    onClick={onCopyShareLink}
                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onGenerateShare}
                        disabled={isGeneratingShare}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${isGeneratingShare ? 'bg-accent-300' : 'bg-accent-600 hover:bg-accent-700'}`}
                    >
                        {isGeneratingShare ? 'Creating…' : (activeShareUrl ? 'Create new link' : 'Generate link')}
                    </button>
                </div>
            </div>
        </div>
    );
};
