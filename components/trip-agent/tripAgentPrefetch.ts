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
 * once while a fresh one loads. Nothing here ever creates a chat.
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
}

const pendingByTrip = new Map<string, PendingBootstrap>();
const lastByTrip = new Map<string, TripAgentBootstrap>();

/** Starts loading a trip's chats and its most recent one, unless already on the way. */
export const prefetchTripAgentBootstrap = (tripId: string): void => {
    const pending = pendingByTrip.get(tripId);
    if (pending && Date.now() - pending.startedAt < PREFETCH_FRESH_MS) return;
    const promise = loadTripAgentBootstrap(tripId, null);
    const entry: PendingBootstrap = { promise, startedAt: Date.now() };
    pendingByTrip.set(tripId, entry);
    promise.then(
        (bootstrap) => {
            lastByTrip.set(tripId, bootstrap);
        },
        () => {
            if (pendingByTrip.get(tripId) === entry) pendingByTrip.delete(tripId);
        },
    );
};

/** Warms both the chat chunk and the trip's chats. */
export const prefetchTripAgent = (tripId: string): void => {
    void loadTripAgentChatSessionModule().catch(() => undefined);
    prefetchTripAgentBootstrap(tripId);
};

/**
 * Loads a bootstrap for the panel. A prefetch that is still fresh is used
 * once, when it holds the thread asked for (or any, for `null`); anything
 * else asks the server.
 */
export const loadTripAgentBootstrapForPanel = async (
    tripId: string,
    threadId: string | null,
): Promise<TripAgentBootstrap> => {
    const pending = pendingByTrip.get(tripId);
    if (pending) {
        pendingByTrip.delete(tripId);
        if (Date.now() - pending.startedAt < PREFETCH_FRESH_MS) {
            const prefetched = await pending.promise.catch(() => null);
            if (prefetched && (!threadId || prefetched.currentThreadId === threadId)) return prefetched;
        }
    }
    const bootstrap = await loadTripAgentBootstrap(tripId, threadId);
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
