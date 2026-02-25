import { useEffect, useState } from 'react';

interface UseReleaseNoticeReadyOptions {
    suppressReleaseNotice: boolean;
}

export const useReleaseNoticeReady = ({
    suppressReleaseNotice,
}: UseReleaseNoticeReadyOptions): boolean => {
    const [isReleaseNoticeReady, setIsReleaseNoticeReady] = useState(false);

    useEffect(() => {
        if (suppressReleaseNotice) return;
        if (typeof window === 'undefined') return;

        let resolved = false;
        let timeoutId: number | null = null;
        let idleId: number | null = null;

        const onTrigger = () => {
            if (resolved) return;
            resolved = true;
            setIsReleaseNoticeReady(true);
            window.removeEventListener('pointerdown', onTrigger, true);
            window.removeEventListener('keydown', onTrigger, true);
            window.removeEventListener('touchstart', onTrigger, true);
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (idleId !== null && 'cancelIdleCallback' in window) {
                (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
                idleId = null;
            }
        };

        window.addEventListener('pointerdown', onTrigger, true);
        window.addEventListener('keydown', onTrigger, true);
        window.addEventListener('touchstart', onTrigger, true);

        timeoutId = window.setTimeout(onTrigger, 5000);

        if ('requestIdleCallback' in window) {
            idleId = (window as Window & {
                requestIdleCallback: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
            }).requestIdleCallback(() => {
                onTrigger();
            }, { timeout: 4500 });
        }

        return () => {
            resolved = true;
            window.removeEventListener('pointerdown', onTrigger, true);
            window.removeEventListener('keydown', onTrigger, true);
            window.removeEventListener('touchstart', onTrigger, true);
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (idleId !== null && 'cancelIdleCallback' in window) {
                (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
                idleId = null;
            }
        };
    }, [suppressReleaseNotice]);

    return isReleaseNoticeReady;
};
