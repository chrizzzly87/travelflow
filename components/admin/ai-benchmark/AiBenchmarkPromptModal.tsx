import React from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { formatTimestamp } from '../aiBenchmarkRuns';
import { AppModal } from '../../ui/app-modal';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import type { PromptPreview } from './aiBenchmarkWorkspaceState';

/** The prompt the classic flow would send for the current setup. */
export const AiBenchmarkPromptModal: React.FC<{
    preview: PromptPreview | null;
    onClose: () => void;
    onCopy: () => void;
    onDownload: () => void;
}> = ({ preview, onClose, onCopy, onDownload }) => (
    <AppModal
        isOpen={Boolean(preview)}
        onClose={onClose}
        title="Generated benchmark prompt"
        description={preview ? formatTimestamp(preview.generatedAt) : undefined}
        closeLabel="Close generated benchmark prompt"
        size="xl"
        mobileSheet={false}
        footer={(
            <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCopy}>
                    Copy
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onDownload}>
                    <DownloadSimple />
                    Download .txt
                </Button>
                <Button type="button" size="sm" onClick={onClose}>
                    Close
                </Button>
            </div>
        )}
    >
        {preview && (
            <Textarea
                aria-label="Prompt"
                value={preview.prompt}
                readOnly
                rows={18}
                className="bg-secondary font-mono text-xs md:text-xs"
            />
        )}
    </AppModal>
);
