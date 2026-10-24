import React, { createContext, useContext, useMemo } from 'react';
import { useHydrated } from './useHydrated';

/**
 * "Today" for date-dependent public content (upcoming festivals, the current
 * month, next weekend, the footer year).
 *
 * The server cannot know the visitor's date, and prerendered or CDN-cached
 * documents can be days old. So the server render and the hydration render
 * both use the timestamp the document was rendered at, read in UTC so that
 * the server's and the browser's time zones cannot disagree; once hydration
 * has finished, the browser's own local date takes over. Content therefore
 * only changes after hydration, and only when the date really differs.
 */
const RenderClockContext = createContext<number | undefined>(undefined);

export function RenderClockProvider({ renderedAt, children }: { renderedAt: number | undefined; children: React.ReactNode }) {
    return <RenderClockContext.Provider value={renderedAt}>{children}</RenderClockContext.Provider>;
}

/** A Date whose local fields equal the UTC fields of `timestamp`, in any time zone. */
export const utcFieldsAsLocalDate = (timestamp: number): Date => {
    const utc = new Date(timestamp);
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds());
};

export function useRenderNow(): Date {
    const hydrated = useHydrated();
    const renderedAt = useContext(RenderClockContext);
    return useMemo(
        () => (!hydrated && renderedAt !== undefined ? utcFieldsAsLocalDate(renderedAt) : new Date()),
        [hydrated, renderedAt],
    );
}
