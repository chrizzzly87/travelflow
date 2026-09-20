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

/**
 * Dragging does NOT go through React state. Every pointermove used to call
 * setShade, which re-rendered the component and rewrote the shade transform and
 * the frame's filter as inline styles — and pointermove fires faster than the
 * browser paints, so renders queued up behind frames and the shade moved in
 * steps. The drag now writes those two properties straight to the DOM, coalesced
 * into one rAF per frame, and React state is only touched when the drag settles.
 */

/** Past this speed (shade units per second) a flick wins over position. */
const FLICK_VELOCITY = 1.6;
/** How far the veil is allowed to darken before the theme actually commits. */
const VEIL_MAX = 0.92;
const COMMIT_EPSILON = 0.001;
/** Matches the .is-recolouring transition in index.css. */
const RECOLOUR_MS = 520;

/** Shade travel as a fraction of the opening height; mirrored in PlaneWindow. */
export const SHADE_TRAVEL = 1.02;
/** How far the cabin dims as the shade comes down. */
export const FRAME_DIM = 0.28;

export interface WindowShadeResult {
    shade: number;
    dragging: boolean;
    isDark: boolean;
    shadeElRef: React.MutableRefObject<HTMLElement | null>;
    frameElRef: React.MutableRefObject<HTMLElement | null>;
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

    // Attached by PlaneWindow so the drag can paint without a render.
    const shadeElRef = useRef<HTMLElement | null>(null);
    const frameElRef = useRef<HTMLElement | null>(null);
    const pending = useRef<number | null>(null);
    const rafId = useRef(0);

    const paintVeil = useCallback((value: number, active: boolean) => {
        const veil = getVeil();
        if (!veil) return;
        if (!active) {
            veil.style.transition = `opacity ${RECOLOUR_MS}ms var(--tf-ease-out, ease-out)`;
            veil.style.opacity = '0';
            return;
        }
        const currentlyDark = document.documentElement.classList.contains('dark');
        const travelled = currentlyDark ? 1 - value : value;
        veil.style.transition = '';
        veil.style.backgroundColor = readVeilColour(!currentlyDark);
        // Ease toward fully opaque near the end. The theme actually swaps behind
        // this veil, so any daylight left at the moment of the swap shows up as a
        // hard snap; easing it to 1 hides the change and the fade-out reveals the
        // new colours instead.
        veil.style.opacity = String(travelled >= 0.985 ? 1 : travelled ** 0.85 * VEIL_MAX);
    }, []);

    /** Write the drag straight to the DOM. One paint per frame, latest value wins. */
    const paintShade = useCallback((value: number) => {
        const shadeEl = shadeElRef.current;
        if (shadeEl) shadeEl.style.transform = `translate3d(0, ${-(1 - value) * SHADE_TRAVEL * 100}%, 0)`;
        const frameEl = frameElRef.current;
        if (frameEl) frameEl.style.filter = `brightness(${1 - value * FRAME_DIM})`;
        paintVeil(value, true);
    }, [paintVeil]);

    const schedulePaint = useCallback((value: number) => {
        pending.current = value;
        if (rafId.current) return;
        rafId.current = requestAnimationFrame(() => {
            rafId.current = 0;
            const next = pending.current;
            if (next !== null) paintShade(next);
        });
    }, [paintShade]);

    const commit = useCallback(
        (next: 0 | 1) => {
            // Drop a queued frame, or it would repaint the old position after
            // React has already settled the element on the new one.
            if (rafId.current) {
                cancelAnimationFrame(rafId.current);
                rafId.current = 0;
            }
            pending.current = null;
            // Write the TARGET, do not clear. Clearing looks tidier but breaks:
            // React diffs against its previous vdom, so if the computed style
            // string is unchanged it never rewrites the property, and the element
            // keeps the cleared value — a shade with no transform sits fully down
            // whatever the state says. Writing the target keeps DOM and state in
            // agreement, and React's next render is a harmless no-op.
            if (shadeElRef.current) {
                shadeElRef.current.style.transform = `translate3d(0, ${-(1 - next) * SHADE_TRAVEL * 100}%, 0)`;
            }
            if (frameElRef.current) {
                frameElRef.current.style.filter = `brightness(${1 - next * FRAME_DIM})`;
            }
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

            // Paint, do not render. setShade here was the stagger.
            schedulePaint(next);

            // Reaching an end during the drag commits immediately, so a confident
            // pull all the way down flips the theme under your finger.
            if (next >= 1 - COMMIT_EPSILON) commit(1);
            else if (next <= COMMIT_EPSILON) commit(0);
        },
        [commit, schedulePaint],
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

    useEffect(() => () => {
        window.clearTimeout(recolourTimer);
        if (rafId.current) cancelAnimationFrame(rafId.current);
    }, []);

    const handlers = useMemo(
        () => ({ onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown, onClick }),
        [onPointerDown, onPointerMove, endDrag, onKeyDown, onClick],
    );

    return { shade: hydrated ? shade : 0, dragging, isDark: hydrated && isDark, handlers, shadeElRef, frameElRef };
};
