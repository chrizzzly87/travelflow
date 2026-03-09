import { useEffect } from 'react';
import { readSessionStorageItem, removeSessionStorageItem } from '../../services/browserStorageService';

type CopyNoticeToastTone = 'add' | 'info' | 'neutral' | 'remove';

interface UseTripCopyNoticeToastParams {
    tripId: string;
    showToast: (message: string, options?: { tone?: CopyNoticeToastTone; title?: string }) => void;
}

export const useTripCopyNoticeToast = ({
    tripId,
    showToast,
}: UseTripCopyNoticeToastParams) => {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = readSessionStorageItem('tf_trip_copy_notice');
        if (!raw) return;
        try {
            const payload = JSON.parse(raw);
            if (payload?.tripId !== tripId) return;
            removeSessionStorageItem('tf_trip_copy_notice');
            const sourceTitle = typeof payload.sourceTitle === 'string' && payload.sourceTitle.trim().length > 0
                ? payload.sourceTitle.trim()
                : null;
            const message = sourceTitle ? `Copied "${sourceTitle}"` : 'Trip copied successfully';
            showToast(message, { tone: 'add', title: 'Copied' });
        } catch {
            removeSessionStorageItem('tf_trip_copy_notice');
        }
    }, [tripId, showToast]);
};
