// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
const originalConnectionDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'connection');

const setNavigatorOnlineState = (isOnline: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => isOnline,
    });
};

describe('hooks/useNetworkStatus', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setNavigatorOnlineState(true);
        Object.defineProperty(window.navigator, 'connection', {
            configurable: true,
            value: undefined,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        if (originalOnLineDescriptor) {
            Object.defineProperty(window.navigator, 'onLine', originalOnLineDescriptor);
        } else {
            delete (window.navigator as Navigator & { onLine?: unknown }).onLine;
        }
        if (originalConnectionDescriptor) {
            Object.defineProperty(window.navigator, 'connection', originalConnectionDescriptor);
        } else {
            delete (window.navigator as Navigator & { connection?: unknown }).connection;
        }
    });

    it('probes periodically while offline and recovers online state when connectivity returns', async () => {
        setNavigatorOnlineState(false);
        const fetchMock = vi.fn().mockResolvedValue({});
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useNetworkStatus({
            probeWhileOffline: true,
            probeIntervalMs: 1000,
            probePath: '/healthz',
        }));

        expect(result.current.isOnline).toBe(false);

        await act(async () => {
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.current.isOnline).toBe(true);

        await act(async () => {
            vi.advanceTimersByTime(3000);
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('marks constrained connections as slow and reacts to online/offline events', () => {
        setNavigatorOnlineState(true);
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        Object.defineProperty(window.navigator, 'connection', {
            configurable: true,
            value: {
                effectiveType: '2g',
                saveData: false,
                rtt: 1200,
                downlink: 0.3,
                addEventListener,
                removeEventListener,
            },
        });

        const { result, unmount } = renderHook(() => useNetworkStatus({ probeWhileOffline: false }));

        expect(result.current.isSlowConnection).toBe(true);
        expect(result.current.isOnline).toBe(true);

        act(() => {
            window.dispatchEvent(new Event('offline'));
        });
        expect(result.current.isOnline).toBe(false);

        act(() => {
            window.dispatchEvent(new Event('online'));
        });
        expect(result.current.isOnline).toBe(true);

        unmount();
        expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
});
