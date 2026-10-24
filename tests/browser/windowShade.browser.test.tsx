// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaneWindow } from '../../components/marketing/PlaneWindow/PlaneWindow';
import { FRAME_REST_FILTER, SHADE_REST_TRANSFORM, useWindowShade } from '../../components/marketing/PlaneWindow/useWindowShade';
import { __resetThemeStoreForTests, setPreference } from '../../contexts/theme/themeStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

beforeEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.className = '';
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    __resetThemeStoreForTests();
});

describe('window shade theme ownership', () => {
    it('renders the static decoration on the server with CSS-controlled resting colors', () => {
        const html = renderToString(<PlaneWindow />);
        expect(html).toContain('plane-window-shade');
        expect(html).toContain(SHADE_REST_TRANSFORM);
        expect(html).toContain(FRAME_REST_FILTER);
        expect(html).not.toContain('<canvas');
    });

    it('delivers native desktop image selection without a mobile network fallback', () => {
        const container = document.createElement('div');
        container.innerHTML = renderToString(<PlaneWindow />);
        const source = container.querySelector('picture source');
        const image = container.querySelector('picture img');
        expect(source?.getAttribute('media')).toBe('(min-width: 64rem)');
        expect(source?.getAttribute('srcset')).toContain('plane-window');
        expect(image?.getAttribute('src')).toMatch(/^data:image\//);
        expect(image?.getAttribute('fetchPriority')).toBe('high');
    });

    it('retries a failed desktop CDN frame with the original inside the same media gate', () => {
        vi.stubEnv('PROD', true);
        const { container } = render(<PlaneWindow />);
        const source = container.querySelector('picture source')!;
        const image = container.querySelector('picture img')!;
        expect(source.getAttribute('srcset')).toContain('/.netlify/images?');
        fireEvent.error(image);
        expect(source).toHaveAttribute('srcset', '/images/plane-window.png');
        expect(source).toHaveAttribute('media', '(min-width: 64rem)');
        const originalAttempt = container.querySelector('picture img')!;
        expect(originalAttempt.getAttribute('src')).toMatch(/^data:image\//);
        expect(originalAttempt).toHaveAttribute('width', '640');
        expect(originalAttempt).toHaveAttribute('height', '938');
        fireEvent.error(originalAttempt);
        expect(container.querySelector('picture img')).toBe(originalAttempt);
        expect(source).toHaveAttribute('srcset', '/images/plane-window.png');
        act(() => setPreference('dark'));
        expect(originalAttempt).toHaveStyle({ filter: FRAME_REST_FILTER });
    });

    it('recovers a desktop frame that failed before hydration attached its event handler', () => {
        vi.stubEnv('PROD', true);
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
        vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
        vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get').mockReturnValue('https://preview.invalid/.netlify/images?url=%2Fimages%2Fplane-window.png');
        const { container, rerender } = render(<PlaneWindow />);
        expect(container.querySelector('picture source')).toHaveAttribute('srcset', '/images/plane-window.png');
        const originalAttempt = container.querySelector('picture img');
        rerender(<PlaneWindow />);
        expect(container.querySelector('picture img')).toBe(originalAttempt);
        expect(originalAttempt?.getAttribute('src')).toMatch(/^data:image\//);
    });

    it('derives its state from the same store as the header instead of observing document mutations', () => {
        const { result } = renderHook(() => useWindowShade());
        expect(result.current.shade).toBe(0);
        act(() => setPreference('dark'));
        expect(result.current.shade).toBe(1);
        expect(result.current.isDark).toBe(true);
        act(() => setPreference('light'));
        expect(result.current.shade).toBe(0);
    });

    it('restores CSS ownership after keyboard commits so later external toggles still work', () => {
        const { result } = renderHook(() => useWindowShade());
        const shade = document.createElement('div');
        const frame = document.createElement('img');
        result.current.shadeElRef.current = shade;
        result.current.frameElRef.current = frame;
        shade.style.transform = 'translate3d(0, -30%, 0)';
        frame.style.filter = 'brightness(0.8)';
        const preventDefault = vi.fn();
        act(() => result.current.handlers.onKeyDown({ key: 'ArrowDown', preventDefault } as unknown as React.KeyboardEvent<HTMLElement>));
        expect(result.current.shade).toBe(1);
        expect(shade.style.transform).toBe(SHADE_REST_TRANSFORM);
        expect(frame.style.filter).toBe(FRAME_REST_FILTER);
        expect(preventDefault).toHaveBeenCalledOnce();
        act(() => setPreference('light'));
        expect(result.current.shade).toBe(0);
        expect(shade.style.transform).toBe(SHADE_REST_TRANSFORM);
    });
});
