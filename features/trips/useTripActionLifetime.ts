import { useCallback, useLayoutEffect, useRef } from 'react';

/** Own continuations by the committed trip/session, including StrictMode remounts. */
export function useTripActionLifetime(identity: string): () => () => boolean {
    const lifetime = useRef({ epoch: 0, mounted: false });

    // Optional imports and network promises are external work. Invalidate their
    // continuations during commit, before a queued microtask can perform writes.
    useLayoutEffect(() => {
        lifetime.current.epoch += 1;
        lifetime.current.mounted = true;
        return () => {
            lifetime.current.mounted = false;
            lifetime.current.epoch += 1;
        };
    }, [identity]);

    return useCallback(() => {
        const epoch = lifetime.current.epoch;
        return () => lifetime.current.mounted && lifetime.current.epoch === epoch;
    }, []);
}
