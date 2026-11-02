// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { configurePageTransitions } from '../../app/routing/pageTransitions';

describe('native page-transition policy', () => {
    it('checks live motion preference per navigation and excludes initial/query-only work', () => {
        let reduced = false;
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
        let listener!: (event: any) => void;
        const update = vi.fn();
        const unsubscribe = vi.fn();
        const router = { subscribe: vi.fn((_name, callback) => { listener = callback; return unsubscribe; }), update };
        expect(configurePageTransitions(router as any)).toBe(unsubscribe);
        listener({ pathChanged: true });
        expect(update).toHaveBeenLastCalledWith({ defaultViewTransition: false });
        listener({ fromLocation: { pathname: '/' }, pathChanged: true });
        expect(update).toHaveBeenLastCalledWith({ defaultViewTransition: true });
        reduced = true;
        listener({ fromLocation: { pathname: '/' }, pathChanged: true });
        expect(update).toHaveBeenLastCalledWith({ defaultViewTransition: false });
        reduced = false;
        listener({ fromLocation: { pathname: '/' }, pathChanged: false });
        expect(update).toHaveBeenLastCalledWith({ defaultViewTransition: false });
    });
});
