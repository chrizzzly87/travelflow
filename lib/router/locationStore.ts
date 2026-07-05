// Client-side location store backing the router compat layer.
//
// Pathname always comes from Next's usePathname (SSR-correct, avoids the
// active-nav hydration class from the 2026-07 postmortem). Search, hash and
// navigation state are request-time values that static HTML cannot know, so
// they hydrate as empty and update synchronously once the store attaches on
// the client (and on every history mutation afterwards).

export interface RouterLocationSnapshot {
    search: string;
    hash: string;
    state: unknown;
    key: string;
}

const SERVER_SNAPSHOT: RouterLocationSnapshot = {
    search: '',
    hash: '',
    state: null,
    key: 'default',
};

const HISTORY_STATE_KEY = '__tfRouterState';

let clientSnapshot: RouterLocationSnapshot = SERVER_SNAPSHOT;
let pendingNavigationState: unknown = undefined;
let isAttached = false;
const listeners = new Set<() => void>();

const readHistoryRouterState = (): unknown => {
    if (typeof window === 'undefined') return null;
    const historyState = window.history.state as Record<string, unknown> | null;
    if (historyState && typeof historyState === 'object' && HISTORY_STATE_KEY in historyState) {
        return historyState[HISTORY_STATE_KEY] ?? null;
    }
    return null;
};

const buildSnapshot = (state: unknown): RouterLocationSnapshot => ({
    search: window.location.search || '',
    hash: window.location.hash || '',
    state,
    key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
});

const snapshotsEqual = (a: RouterLocationSnapshot, b: RouterLocationSnapshot): boolean => (
    a.search === b.search && a.hash === b.hash && a.state === b.state
);

const refreshSnapshot = () => {
    let nextState: unknown;
    if (pendingNavigationState !== undefined) {
        nextState = pendingNavigationState;
        pendingNavigationState = undefined;
        try {
            const historyState = window.history.state;
            const base = historyState && typeof historyState === 'object' ? historyState : {};
            window.history.replaceState({ ...base, [HISTORY_STATE_KEY]: nextState }, '');
        } catch {
            // history.replaceState can throw in sandboxed contexts — state then
            // lives only in memory for this document lifetime, which is fine.
        }
    } else {
        nextState = readHistoryRouterState();
    }

    const next = buildSnapshot(nextState);
    if (snapshotsEqual(clientSnapshot, next)) return;
    clientSnapshot = next;
    for (const listener of [...listeners]) listener();
};

/**
 * Stash navigation state for the history entry created by the very next
 * push/replace. Mirrors react-router's `navigate(to, { state })` semantics
 * closely enough for the app's usages (login return paths, contact context,
 * example-trip transitions).
 */
export const setPendingNavigationState = (state: unknown): void => {
    pendingNavigationState = state;
};

const attach = () => {
    if (isAttached || typeof window === 'undefined') return;
    isAttached = true;

    const notifyAfterHistoryMutation = () => {
        // Next.js mutates history first, then commits the React render. Defer a
        // microtask so subscribers re-read a settled URL.
        queueMicrotask(refreshSnapshot);
        refreshSnapshot();
    };

    const { pushState, replaceState } = window.history;
    window.history.pushState = function patchedPushState(...args) {
        pushState.apply(this, args as Parameters<History['pushState']>);
        notifyAfterHistoryMutation();
    };
    window.history.replaceState = function patchedReplaceState(...args) {
        replaceState.apply(this, args as Parameters<History['replaceState']>);
        notifyAfterHistoryMutation();
    };
    window.addEventListener('popstate', refreshSnapshot);
    window.addEventListener('hashchange', refreshSnapshot);

    clientSnapshot = buildSnapshot(readHistoryRouterState());
};

export const subscribeToRouterLocation = (listener: () => void): (() => void) => {
    attach();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const getRouterLocationSnapshot = (): RouterLocationSnapshot => {
    if (typeof window === 'undefined') return SERVER_SNAPSHOT;
    attach();
    return clientSnapshot;
};

export const getServerRouterLocationSnapshot = (): RouterLocationSnapshot => SERVER_SNAPSHOT;
