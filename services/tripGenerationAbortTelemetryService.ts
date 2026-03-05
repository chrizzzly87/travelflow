export interface TripGenerationAbortTelemetryPayload {
    tripId: string;
    attemptId: string;
    requestId: string;
    flow: string;
    source: string;
    provider?: string | null;
    model?: string | null;
    providerModel?: string | null;
    startedAt?: string | null;
}

export interface TripGenerationAbortTelemetrySession {
    cancel: () => void;
}

const NOOP_SESSION: TripGenerationAbortTelemetrySession = {
    cancel: () => {},
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

export const beginTripGenerationAbortTelemetry = (
    payload: TripGenerationAbortTelemetryPayload,
): TripGenerationAbortTelemetrySession => {
    if (!isBrowser()) return NOOP_SESSION;
    if (typeof navigator.sendBeacon !== 'function') return NOOP_SESSION;

    let cancelled = false;
    const sendAbortEvent = () => {
        if (cancelled) return;
        cancelled = true;
        const body = {
            ...payload,
            sentAt: new Date().toISOString(),
            reason: 'page_unload',
        };
        const blob = new Blob([JSON.stringify(body)], {
            type: 'application/json; charset=utf-8',
        });
        navigator.sendBeacon('/api/ai/generate/abort', blob);
    };

    window.addEventListener('pagehide', sendAbortEvent);
    window.addEventListener('beforeunload', sendAbortEvent);

    return {
        cancel: () => {
            if (cancelled) return;
            cancelled = true;
            window.removeEventListener('pagehide', sendAbortEvent);
            window.removeEventListener('beforeunload', sendAbortEvent);
        },
    };
};
