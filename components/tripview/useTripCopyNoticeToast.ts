import { useEffect } from 'react';

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
        let raw: string | null = null;
        try {
            raw = window.sessionStorage.getItem('tf_trip_copy_notice');
        } catch {
            raw = null;
        }
        if (!raw) return;
        try {
            const payload = JSON.parse(raw);
            if (payload?.tripId !== tripId) return;
            window.sessionStorage.removeItem('tf_trip_copy_notice');
            const sourceTitle = typeof payload.sourceTitle === 'string' && payload.sourceTitle.trim().length > 0
                ? payload.sourceTitle.trim()
                : null;
            const message = sourceTitle ? `Copied "${sourceTitle}"` : 'Trip copied successfully';
            showToast(message, { tone: 'add', title: 'Copied' });
        } catch {
            try {
                window.sessionStorage.removeItem('tf_trip_copy_notice');
            } catch {
                // ignore
            }
        }
    }, [tripId, showToast]);
};
