'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Location, NavigateOptions, RouterAdapter, RouterAdapterContext } from './context';

const parseEntry = (entry: string | Partial<Location>, state: unknown = null): Location => {
    if (typeof entry !== 'string') {
        return {
            pathname: entry.pathname ?? '/',
            search: entry.search ?? '',
            hash: entry.hash ?? '',
            state: entry.state ?? state,
            key: `${Math.random().toString(36).slice(2, 10)}`,
        };
    }
    const url = new URL(entry, 'http://localhost');
    return {
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        state,
        key: `${Math.random().toString(36).slice(2, 10)}`,
    };
};

export interface MemoryRouterProps {
    children?: React.ReactNode;
    initialEntries?: Array<string | Partial<Location>>;
    initialIndex?: number;
}

/**
 * In-memory router provider for tests (drop-in for react-router-dom's
 * MemoryRouter). Provides the compat adapter context with a full location
 * override, so useLocation/useNavigate/useSearchParams/Link work without
 * Next.js runtime.
 */
export const MemoryRouter: React.FC<MemoryRouterProps> = ({
    children,
    initialEntries = ['/'],
    initialIndex,
}) => {
    const [stack, setStack] = useState<Location[]>(() => initialEntries.map((entry) => parseEntry(entry)));
    const [index, setIndex] = useState(() => {
        const fallback = initialEntries.length - 1;
        return initialIndex === undefined ? fallback : Math.min(Math.max(initialIndex, 0), fallback);
    });
    const stackRef = useRef(stack);
    stackRef.current = stack;
    const indexRef = useRef(index);
    indexRef.current = index;

    const navigate = useCallback((href: string, options?: NavigateOptions) => {
        const next = parseEntry(href, options?.state ?? null);
        if (options?.replace) {
            setStack((current) => {
                const copy = [...current];
                copy[indexRef.current] = next;
                return copy;
            });
        } else {
            setStack((current) => [...current.slice(0, indexRef.current + 1), next]);
            setIndex((current) => current + 1);
        }
    }, []);

    const go = useCallback((delta: number) => {
        setIndex((current) => {
            const next = current + delta;
            return Math.min(Math.max(next, 0), stackRef.current.length - 1);
        });
    }, []);

    const location = stack[Math.min(index, stack.length - 1)];

    const adapter = useMemo<RouterAdapter>(() => ({
        pathname: location.pathname,
        params: {},
        navigate,
        go,
        locationOverride: location,
    }), [go, location, navigate]);

    return (
        <RouterAdapterContext.Provider value={adapter}>
            {children}
        </RouterAdapterContext.Provider>
    );
};
