// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentScrollLock } from '../../hooks/useDocumentScrollLock';

beforeEach(() => {
    cleanup();
    document.body.removeAttribute('style');
    document.body.style.margin = '0';
    document.documentElement.removeAttribute('style');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1270);
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(0);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(600);
});

describe('shared document scroll lock', () => {
    it('pins background content while retaining the existing Safari scrollbar gutter', () => {
        const { unmount } = renderHook(() => useDocumentScrollLock(true));
        expect(document.documentElement.style.overflowY).toBe('scroll');
        expect(document.body.style.position).toBe('fixed');
        expect(document.body.style.top).toBe('-600px');
        expect(document.body.style.inlineSize).toBe('100%');
        expect(document.body.style.overflow).toBe('');
        unmount();
        expect(document.body.style.position).toBe('');
        expect(document.documentElement.style.overflowY).toBe('');
        expect(window.scrollTo).toHaveBeenLastCalledWith(0, 600);
    });

    it('does not create scrollbar space on short or overlay-scrollbar pages', () => {
        vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1280);
        const { unmount } = renderHook(() => useDocumentScrollLock(true));
        expect(document.documentElement.style.overflowY).toBe('hidden');
        expect(document.body.style.inlineSize).toBe('100%');
        unmount();
    });

    it('uses responsive logical sizing and retains body margins across viewport changes', () => {
        document.body.style.marginInline = '20px';
        // jsdom does not resolve logical margin shorthands into physical computed values.
        document.body.style.marginLeft = '20px';
        document.body.style.marginRight = '20px';
        const { unmount } = renderHook(() => useDocumentScrollLock(true));
        expect(document.body.style.inlineSize).toBe('calc(100% - 40px)');
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
        vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(380);
        act(() => window.dispatchEvent(new Event('resize')));
        expect(document.body.style.inlineSize).toBe('calc(100% - 40px)');
        unmount();
        expect(document.body.style.marginInline).toBe('20px');
    });

    it('keeps the lock until the last overlapping owner closes in either order', () => {
        const first = renderHook(() => useDocumentScrollLock(true));
        const second = renderHook(() => useDocumentScrollLock(true));
        first.unmount();
        expect(document.body.style.position).toBe('fixed');
        expect(window.scrollTo).not.toHaveBeenCalled();
        second.unmount();
        expect(document.body.style.position).toBe('');
        expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith(0, 600);

        const third = renderHook(() => useDocumentScrollLock(true));
        const fourth = renderHook(() => useDocumentScrollLock(true));
        fourth.unmount();
        expect(document.body.style.position).toBe('fixed');
        third.unmount();
        expect(document.body.style.position).toBe('');
        expect(window.scrollTo).toHaveBeenCalledTimes(2);
    });

    it('does not acquire a lock for closed overlays and responds to open-state changes', () => {
        const hook = renderHook(({ active }) => useDocumentScrollLock(active), { initialProps: { active: false } });
        expect(document.body.style.position).toBe('');
        hook.rerender({ active: true });
        expect(document.body.style.position).toBe('fixed');
        hook.rerender({ active: false });
        expect(document.body.style.position).toBe('');
        expect(window.scrollTo).toHaveBeenCalledOnce();
        hook.unmount();
        expect(window.scrollTo).toHaveBeenCalledOnce();
    });

    it('restores owned inline values, priorities, RTL scroll coordinates and smooth-scroll policy', () => {
        document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
        document.documentElement.style.setProperty('scroll-behavior', 'smooth', 'important');
        document.body.style.setProperty('position', 'relative', 'important');
        document.body.style.setProperty('inline-size', '90%');
        document.body.style.setProperty('color', 'red');
        vi.spyOn(window, 'scrollX', 'get').mockReturnValue(-40);
        const { unmount } = renderHook(() => useDocumentScrollLock(true));
        expect(document.body.style.left).toBe('40px');
        document.body.style.backgroundColor = 'blue';
        unmount();
        expect(document.body.style.position).toBe('relative');
        expect(document.body.style.getPropertyPriority('position')).toBe('important');
        expect(document.body.style.inlineSize).toBe('90%');
        expect(document.body.style.color).toBe('red');
        expect(document.body.style.backgroundColor).toBe('blue');
        expect(document.documentElement.style.overflowY).toBe('auto');
        expect(document.documentElement.style.getPropertyPriority('overflow-y')).toBe('important');
        expect(document.documentElement.style.scrollBehavior).toBe('smooth');
        expect(window.scrollTo).toHaveBeenLastCalledWith(-40, 600);
    });

    it('survives StrictMode acquire-cleanup-acquire and repeated mounting without orphaning a lock', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => <React.StrictMode>{children}</React.StrictMode>;
        const first = renderHook(() => useDocumentScrollLock(true), { wrapper });
        expect(document.body.style.position).toBe('fixed');
        first.unmount();
        expect(document.body.style.position).toBe('');
        const second = renderHook(() => useDocumentScrollLock(true));
        act(() => second.unmount());
        expect(document.documentElement.style.overflowY).toBe('');
        expect(document.body.style.position).toBe('');
    });
});
