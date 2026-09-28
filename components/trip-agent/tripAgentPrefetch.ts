import {
    loadTripAgentBootstrap,
    type TripAgentBootstrap,
} from '../../services/tripAgentService';

/**
 * Warms the Trip Agent before the panel asks for it, so opening it does not
 * wait for a chunk download and then for a network round trip in turn.
 *
 * The chat chunk is fetched once per page. A bootstrap started on hover or
 * focus is handed to the panel that opens right after, instead of the panel
 * asking again. The last bootstrap per trip is kept so a reopen can render at
 * once while a fresh one loads.
 */

type ChatSessionModule = typeof import('./TripAgentChatSession');

let chatSessionModulePromise: Promise<ChatSessionModule> | null = null;

export const loadTripAgentChatSessionModule = (): Promise<ChatSessionModule> => {
    if (!chatSessionModulePromise) {
        chatSessionModulePromise = import('./TripAgentChatSession').catch((error) => {
            // A failed download must not poison every later attempt.
            chatSessionModulePromise = null;
            throw error;
        });
    }
    return chatSessionModulePromise;
};

/** A prefetch older than this is not handed to a panel; it asks afresh. */
const PREFETCH_FRESH_MS = 30_000;

interface PendingBootstrap {
    promise: Promise<TripAgentBootstrap>;
    startedAt: number;
    ensureThread: boolean;
}

const pendingByTrip = new Map<string, PendingBootstrap>();
const lastByTrip = new Map<string, TripAgentBootstrap>();

const startBootstrap = (tripId: string, ensureThread: boolean): Promise<TripAgentBootstrap> => {
    const promise = loadTripAgentBootstrap(tripId, null, { ensureThread });
    const entry: PendingBootstrap = { promise, startedAt: Date.now(), ensureThread };
    pendingByTrip.set(tripId, entry);
    promise.then(
        (bootstrap) => {
            lastByTrip.set(tripId, bootstrap);
        },
        () => {
            if (pendingByTrip.get(tripId) === entry) pendingByTrip.delete(tripId);
        },
    );
    return promise;
};

/**
 * Starts loading the default thread for a trip. Hover and focus never create a
 * thread: only an open does, so passing over the launcher leaves no trace.
 */
export const prefetchTripAgentBootstrap = (tripId: string, options: { ensureThread?: boolean } = {}): void => {
    const pending = pendingByTrip.get(tripId);
    if (pending && Date.now() - pending.startedAt < PREFETCH_FRESH_MS) return;
    void startBootstrap(tripId, Boolean(options.ensureThread)).catch(() => undefined);
};

/** Warms both the chat chunk and the trip's default thread. */
export const prefetchTripAgent = (tripId: string, options: { ensureThread?: boolean } = {}): void => {
    void loadTripAgentChatSessionModule().catch(() => undefined);
    prefetchTripAgentBootstrap(tripId, options);
};

/**
 * Loads a bootstrap for the panel. The default thread reuses a prefetch that
 * is still fresh, once; a named thread always asks the server.
 */
export const loadTripAgentBootstrapForPanel = async (
    tripId: string,
    threadId: string | null,
): Promise<TripAgentBootstrap> => {
    if (!threadId) {
        const pending = pendingByTrip.get(tripId);
        if (pending && Date.now() - pending.startedAt < PREFETCH_FRESH_MS) {
            pendingByTrip.delete(tripId);
            const prefetched = await pending.promise;
            // A hover prefetch does not create a thread, so a trip without one
            // still needs the call that does.
            if (prefetched.currentThreadId || pending.ensureThread) return prefetched;
        } else if (pending) {
            pendingByTrip.delete(tripId);
        }
    }
    const bootstrap = await loadTripAgentBootstrap(tripId, threadId, { ensureThread: true });
    lastByTrip.set(tripId, bootstrap);
    return bootstrap;
};

/** The last bootstrap this page saw for a trip, to paint a reopen at once. */
export const readCachedTripAgentBootstrap = (tripId: string): TripAgentBootstrap | null => (
    lastByTrip.get(tripId) ?? null
);

/** Test seam: forget every prefetch and cached bootstrap. */
export const resetTripAgentPrefetchForTests = (): void => {
    chatSessionModulePromise = null;
    pendingByTrip.clear();
    lastByTrip.clear();
};
