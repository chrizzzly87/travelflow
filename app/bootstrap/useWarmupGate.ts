import { useEffect, useState } from 'react';

export const useWarmupGate = (): boolean => {
    const [isWarmupEnabled, setIsWarmupEnabled] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let resolved = false;
        let timeoutId: number | null = null;
        let idleId: number | null = null;

        const removeInteractionListeners = () => {
            window.removeEventListener('pointerdown', onFirstInteraction, true);
            window.removeEventListener('keydown', onFirstInteraction, true);
            window.removeEventListener('touchstart', onFirstInteraction, true);
            window.removeEventListener('scroll', onFirstInteraction, true);
        };

        const clearTimers = () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (idleId !== null && 'cancelIdleCallback' in window) {
                (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
                idleId = null;
            }
        };

        const enableWarmup = () => {
            if (resolved) return;
            resolved = true;
            setIsWarmupEnabled(true);
            removeInteractionListeners();
            clearTimers();
        };

        const onFirstInteraction = () => {
            enableWarmup();
        };

        window.addEventListener('pointerdown', onFirstInteraction, true);
        window.addEventListener('keydown', onFirstInteraction, true);
        window.addEventListener('touchstart', onFirstInteraction, true);
        window.addEventListener('scroll', onFirstInteraction, true);

        timeoutId = window.setTimeout(enableWarmup, 3200);

        if ('requestIdleCallback' in window) {
            idleId = (window as Window & {
                requestIdleCallback: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
            }).requestIdleCallback(() => {
                enableWarmup();
            }, { timeout: 2600 });
        }

        return () => {
            resolved = true;
            removeInteractionListeners();
            clearTimers();
        };
    }, []);

    return isWarmupEnabled;
};
