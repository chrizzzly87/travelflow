// @vitest-environment jsdom
import React, { StrictMode, useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useTripActionLifetime } from '../../../features/trips/useTripActionLifetime';

afterEach(cleanup);

const heldImport = () => {
    const execute = vi.fn();
    let release!: () => void;
    const module = new Promise<{ execute: typeof execute }>((resolve) => {
        release = () => resolve({ execute });
    });
    const start = async (capture: () => () => boolean) => {
        const isCurrent = capture();
        const loaded = await module;
        if (isCurrent()) loaded.execute();
    };
    return { execute, release, start };
};

describe('trip action lifetime', () => {
    it('prevents a held optional action from executing after leaving the workspace', async () => {
        const { result, unmount } = renderHook(() => useTripActionLifetime('trip-a:member-a'));
        const action = heldImport();
        const pending = action.start(result.current);
        unmount();
        action.release();
        await pending;
        expect(action.execute).not.toHaveBeenCalled();
    });

    it.each(['trip-b:member-a', 'trip-a:member-b', 'trip-a:anonymous'])(
        'discards a held action when committed ownership changes to %s',
        async (identity) => {
            const { result, rerender } = renderHook(({ current }) => useTripActionLifetime(current), {
                initialProps: { current: 'trip-a:member-a' },
            });
            const action = heldImport();
            const pending = action.start(result.current);
            rerender({ current: identity });
            action.release();
            await pending;
            expect(action.execute).not.toHaveBeenCalled();
            expect(result.current()()).toBe(true);
        },
    );

    it('keeps the capture function and pending action valid through an unrelated rerender', async () => {
        const { result, rerender } = renderHook(({ current, revision: _revision }) => useTripActionLifetime(current), {
            initialProps: { current: 'trip-a:member-a', revision: 0 },
        });
        const capture = result.current;
        const action = heldImport();
        const pending = action.start(capture);
        rerender({ current: 'trip-a:member-a', revision: 1 });
        expect(result.current).toBe(capture);
        action.release();
        await pending;
        expect(action.execute).toHaveBeenCalledOnce();
    });

    it('never revalidates an old capture when ownership returns to the same identity', () => {
        const { result, rerender } = renderHook(({ identity }) => useTripActionLifetime(identity), {
            initialProps: { identity: 'trip-a:member-a' },
        });
        const old = result.current();
        rerender({ identity: 'trip-a:anonymous' });
        rerender({ identity: 'trip-a:member-a' });
        expect(old()).toBe(false);
        expect(result.current()()).toBe(true);
    });

    it('invalidates the first StrictMode setup capture permanently when effects remount', async () => {
        const captures: Array<() => boolean> = [];
        const action = heldImport();
        const pending: Array<Promise<void>> = [];
        const { unmount } = renderHook(() => {
            const capture = useTripActionLifetime('trip-a:member-a');
            useLayoutEffect(() => {
                captures.push(capture());
                pending.push(action.start(capture));
            }, [capture]);
        }, { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> });
        expect(captures).toHaveLength(2);
        expect(captures[0]()).toBe(false);
        expect(captures[1]()).toBe(true);
        await act(async () => {
            action.release();
            await Promise.all(pending);
        });
        expect(action.execute).toHaveBeenCalledOnce();
        unmount();
        expect(captures.every((isCurrent) => !isCurrent())).toBe(true);
    });
});
