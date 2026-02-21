import React from 'react';
import { ShareMode } from '../types';
import { AppModal } from './ui/app-modal';

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
    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title="Share trip"
            description="Choose view-only or collaboration editing."
            closeLabel="Close share trip dialog"
            size="sm"
            mobileSheet
            bodyClassName="p-4 space-y-3"
            footer={
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onGenerateShare}
                        disabled={isGeneratingShare}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${isGeneratingShare ? 'bg-accent-300' : 'bg-accent-600 hover:bg-accent-700'}`}
                    >
                        {isGeneratingShare ? 'Creating…' : (activeShareUrl ? 'Create new link' : 'Generate link')}
                    </button>
                </div>
            }
        >
            <div className="flex items-start gap-3 text-sm">
                <input
                    id="trip-share-mode-view"
                    type="radio"
                    name="share-mode"
                    className="mt-1"
                    checked={shareMode === 'view'}
                    onChange={() => onShareModeChange('view')}
                />
                <label htmlFor="trip-share-mode-view" className="cursor-pointer">
                    <span className="font-semibold text-gray-900">View only</span>
                    <span className="block text-xs text-gray-500">People can see the trip but can’t edit.</span>
                </label>
            </div>
            <div className="flex items-start gap-3 text-sm">
                <input
                    id="trip-share-mode-edit"
                    type="radio"
                    name="share-mode"
                    className="mt-1"
                    checked={shareMode === 'edit'}
                    onChange={() => onShareModeChange('edit')}
                />
                <label htmlFor="trip-share-mode-edit" className="cursor-pointer">
                    <span className="font-semibold text-gray-900">Allow editing</span>
                    <span className="block text-xs text-gray-500">Anyone with the link can make changes.</span>
                </label>
            </div>
            {activeShareUrl && (
                <div className="mt-2">
                    <div className="mb-1 text-xs font-semibold text-gray-600">Share link</div>
                    <div className="flex items-center gap-2">
                        <input
                            value={activeShareUrl}
                            readOnly
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                        />
                        <button
                            type="button"
                            onClick={onCopyShareLink}
                            className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        >
                            Copy
                        </button>
                    </div>
                </div>
            )}
        </AppModal>
    );
};
