/**
 * The window shade: drag it down to bring on dark mode.
 *
 * `shade` runs 0 (fully open, bright cabin) to 1 (fully down, dark cabin). The
 * theme is NOT changed continuously while dragging — during the drag a veil
 * tracks the shade so the page dims with your finger, and the real theme only
 * commits once the shade reaches an end. Committing mid-drag would repaint the
 * whole page on every pointermove, and would leave the site in dark mode after
 * a drag the user abandoned halfway.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { setResolvedTheme, getResolvedTheme } from '../../../contexts/theme/themeStore';

/** Past this speed (shade units per second) a flick wins over position. */
const FLICK_VELOCITY = 1.6;
/** How far the veil is allowed to darken before the theme actually commits. */
const VEIL_MAX = 0.92;
const COMMIT_EPSILON = 0.001;
/** Matches the .is-recolouring transition in index.css. */
const RECOLOUR_MS = 520;

export interface WindowShadeResult {
    shade: number;
    dragging: boolean;
    isDark: boolean;
    handlers: {
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
        onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
        onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
        onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
        onClick: () => void;
    };
}

let veilElement: HTMLDivElement | null = null;

const getVeil = (): HTMLDivElement | null => {
    if (typeof document === 'undefined') return null;
    if (veilElement?.isConnected) return veilElement;
    veilElement = document.createElement('div');
    veilElement.setAttribute('aria-hidden', 'true');
    veilElement.dataset.tfThemeVeil = '';
    veilElement.style.cssText =
        'position:fixed;inset:0;z-index:1400;pointer-events:none;opacity:0;will-change:opacity';
    document.body.appendChild(veilElement);
    return veilElement;
};

const readVeilColour = (dark: boolean): string => {
    if (typeof document === 'undefined') return dark ? '#191817' : '#ffffff';
    const styles = getComputedStyle(document.documentElement);
    const value = styles.getPropertyValue(dark ? '--tf-veil-dark' : '--tf-veil-light').trim();
    return value || (dark ? '#191817' : '#ffffff');
};

/**
 * Transition only colour-ish properties, briefly, so the theme swap reads as one
 * movement rather than a hard cut — but never on the window itself, whose frame
 * would smear. index.css owns the rule; this just turns it on and off.
 */
let recolourTimer: number | undefined;
const markRecolouring = (): void => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('is-recolouring');
    void root.offsetWidth; // force a reflow so the class re-applies cleanly
    root.classList.add('is-recolouring');
    window.clearTimeout(recolourTimer);
    recolourTimer = window.setTimeout(() => root.classList.remove('is-recolouring'), RECOLOUR_MS + 60);
};

export const useWindowShade = (): WindowShadeResult => {
    const [isDark, setIsDark] = useState(() =>
        typeof document === 'undefined' ? false : document.documentElement.classList.contains('dark'),
    );
    const [shade, setShade] = useState(() => (isDark ? 1 : 0));
    const [dragging, setDragging] = useState(false);

    // Same two-pass hydration guard as ThemeToggle, for the same reason: preact's
    // hydrate() does not patch attributes on prerendered DOM, so a first render
    // that disagrees with the build-time markup is silently dropped and the shade
    // stays visually open while the page is actually dark.
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => { setHydrated(true); }, []);

    const drag = useRef({ active: false, startY: 0, startShade: 0, height: 1, velocity: 0, lastAt: 0, lastShade: 0 });

    // Keep in step with the toggle in the header: if the theme changes from
    // anywhere else, the shade has to move to match or the two controls disagree.
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const observer = new MutationObserver(() => {
            const dark = root.classList.contains('dark');
            setIsDark((current) => {
                if (current === dark) return current;
                if (!drag.current.active) setShade(dark ? 1 : 0);
                return dark;
            });
        });
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const paintVeil = useCallback((value: number, active: boolean) => {
        const veil = getVeil();
        if (!veil) return;
        if (!active) {
            veil.style.transition = `opacity ${RECOLOUR_MS}ms var(--tf-ease-out, ease-out)`;
            veil.style.opacity = '0';
            return;
        }
        const currentlyDark = document.documentElement.classList.contains('dark');
        veil.style.transition = '';
        veil.style.backgroundColor = readVeilColour(!currentlyDark);
        veil.style.opacity = String((currentlyDark ? 1 - value : value) * VEIL_MAX);
    }, []);

    const commit = useCallback(
        (next: 0 | 1) => {
            setShade(next);
            const wantsDark = next === 1;
            if (getResolvedTheme() !== (wantsDark ? 'dark' : 'light')) {
                markRecolouring();
                setResolvedTheme(wantsDark ? 'dark' : 'light');
            }
            setIsDark(wantsDark);
            paintVeil(0, false);
        },
        [paintVeil],
    );

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        // Record the drag BEFORE capturing. setPointerCapture throws if the
        // pointer id is not active, and doing it first meant one throw killed
        // the whole gesture — the shade simply would not move.
        drag.current = {
            active: true,
            startY: event.clientY,
            startShade: shade,
            // The shade travels roughly the glass height, so map pointer distance
            // onto that rather than the whole element.
            height: Math.max(rect.height * 0.62, 1),
            velocity: 0,
            lastAt: performance.now(),
            lastShade: shade,
        };
        setDragging(true);
        // Capture is an optimisation — it keeps the drag alive when the pointer
        // leaves the button. Losing it is survivable; losing the drag is not.
        try {
            target.setPointerCapture?.(event.pointerId);
        } catch {
            /* no active pointer for this id; the drag still works */
        }
    }, [shade]);

    const onPointerMove = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            const state = drag.current;
            if (!state.active) return;
            const delta = (event.clientY - state.startY) / state.height;
            const next = Math.min(1, Math.max(0, state.startShade + delta));

            const now = performance.now();
            const dt = (now - state.lastAt) / 1000;
            if (dt > 0) state.velocity = (next - state.lastShade) / dt;
            state.lastAt = now;
            state.lastShade = next;

            setShade(next);
            paintVeil(next, true);

            // Reaching an end during the drag commits immediately, so a confident
            // pull all the way down flips the theme under your finger.
            if (next >= 1 - COMMIT_EPSILON) commit(1);
            else if (next <= COMMIT_EPSILON) commit(0);
        },
        [commit, paintVeil],
    );

    const endDrag = useCallback(
        (event: React.PointerEvent<HTMLElement>) => {
            const state = drag.current;
            if (!state.active) return;
            state.active = false;
            setDragging(false);
            try {
                event.currentTarget.releasePointerCapture?.(event.pointerId);
            } catch {
                /* never captured, nothing to release */
            }

            if (state.velocity > FLICK_VELOCITY) return commit(1);
            if (state.velocity < -FLICK_VELOCITY) return commit(0);
            return commit(state.lastShade > 0.5 ? 1 : 0);
        },
        [commit],
    );

    const toggle = useCallback(() => {
        commit(document.documentElement.classList.contains('dark') ? 0 : 1);
    }, [commit]);

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLElement>) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); commit(1); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); commit(0); }
        },
        [commit],
    );

    const onClick = useCallback(() => {
        // A drag ends with a click event too; only treat it as a tap if the
        // pointer barely moved.
        if (Math.abs(drag.current.lastShade - drag.current.startShade) > 0.02) return;
        toggle();
    }, [toggle]);

    useEffect(() => () => { window.clearTimeout(recolourTimer); }, []);

    const handlers = useMemo(
        () => ({ onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown, onClick }),
        [onPointerDown, onPointerMove, endDrag, onKeyDown, onClick],
    );

    return { shade: hydrated ? shade : 0, dragging, isDark: hydrated && isDark, handlers };
};
