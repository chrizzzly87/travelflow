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
        let mountTimeoutId: number | null = null;
        let idleId: number | null = null;

        const removeListeners = () => {
            window.removeEventListener('pointerup', onTrigger, true);
            window.removeEventListener('keyup', onTrigger, true);
        };

        const clearPendingTimers = () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (idleId !== null && 'cancelIdleCallback' in window) {
                (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
                idleId = null;
            }
        };

        function onTrigger() {
            if (resolved) return;
            resolved = true;
            removeListeners();
            clearPendingTimers();

            // Mount on the next macrotask, never inside the interaction that armed
            // this. The notice is a `fixed inset-0` modal: flipping the flag while
            // the visitor's pointer was still down dropped a full-screen backdrop
            // under the cursor, so their click resolved against the backdrop
            // instead of the control they pressed and appeared to do nothing.
            mountTimeoutId = window.setTimeout(() => {
                mountTimeoutId = null;
                setIsReleaseNoticeReady(true);
            }, 0);
        }

        // Interaction triggers fire on release, not on press, so the notice can
        // never appear between a visitor's pointerdown and their click.
        window.addEventListener('pointerup', onTrigger, true);
        window.addEventListener('keyup', onTrigger, true);

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
            removeListeners();
            clearPendingTimers();
            if (mountTimeoutId !== null) {
                window.clearTimeout(mountTimeoutId);
                mountTimeoutId = null;
            }
        };
    }, [suppressReleaseNotice]);

    return isReleaseNoticeReady;
};
