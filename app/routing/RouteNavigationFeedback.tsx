import React, { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useHydrated } from '../../hooks/useHydrated';
import { isToolRoute } from '../../config/routes';

/** One visual pass per foreground navigation. Intermediate progress is a visual
 * estimate, never an announced percentage; only route completion fills 100%. */
export function RouteNavigationFeedback({ authPending = false }: { authPending?: boolean }) {
    const hydrated = useHydrated();
    const routePending = useRouterState({ select: state => state.status === 'pending'
        || (authPending && isToolRoute(state.matches.at(-1)?.pathname ?? state.location.pathname)) });
    // The neutral SSR shell is idle; reconcile actual browser navigation only
    // after its first hydration render, without mismatching the cached document.
    const pending = hydrated && routePending;
    const [progress, setProgress] = useState({ pending, visible: pending, value: 0, run: 0 });
    // A new native navigation is a new animation lifetime. Reconcile before
    // painting, so completion can never leave a half-filled bar on screen.
    if (progress.pending !== pending) {
        setProgress(current => ({ pending, visible: pending || current.visible,
            value: pending ? 0 : 100, run: pending ? current.run + 1 : current.run }));
    }
    useEffect(() => {
        if (pending) {
            const advance = () => setProgress(current => current.pending ? {
                ...current, value: Math.min(94, current.value + Math.max(0.2, (94 - current.value) * 0.12)),
            } : current);
            const first = window.setTimeout(advance, 16);
            const timer = window.setInterval(advance, 250);
            return () => { window.clearTimeout(first); window.clearInterval(timer); };
        }
        // Keep the completed bar visible through its fill, then fade it out.
        const timer = window.setTimeout(() => setProgress(current => current.visible
            ? { ...current, visible: false } : current), 300);
        return () => window.clearTimeout(timer);
    }, [pending]);
    const phase = pending ? 'loading' : progress.visible ? 'complete' : 'idle';
    return <div aria-hidden="true" data-testid="route-navigation-progress" data-pending={pending || undefined}
        data-visible={progress.visible || undefined} data-phase={phase} className="tf-navigation-progress">
        <span key={progress.run} data-progress={progress.value} style={{ transform: `scaleX(${progress.value / 100})` }} />
    </div>;
}
