import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const trapStack: string[] = [];

interface UseFocusTrapOptions {
    isActive: boolean;
    containerRef: RefObject<HTMLElement | null>;
    initialFocusRef?: RefObject<HTMLElement | null>;
    restoreFocus?: boolean;
}

const isFocusableAndVisible = (element: HTMLElement): boolean => {
    if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') return false;
    if (element.tabIndex < 0) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    return true;
};

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    return nodes.filter((node) => isFocusableAndVisible(node));
};

export const useFocusTrap = ({
    isActive,
    containerRef,
    initialFocusRef,
    restoreFocus = true,
}: UseFocusTrapOptions): void => {
    const trapIdRef = useRef(`focus-trap-${Math.random().toString(36).slice(2, 10)}`);

    useEffect(() => {
        if (!isActive) return;
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const container = containerRef.current;
        if (!container) return;

        const trapId = trapIdRef.current;
        const activeElementBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const hadTabIndex = container.hasAttribute('tabindex');

        if (!hadTabIndex) {
            container.setAttribute('tabindex', '-1');
        }

        trapStack.push(trapId);

        const isTopTrap = () => trapStack[trapStack.length - 1] === trapId;

        const focusFirstElement = () => {
            if (!isTopTrap()) return;
            const activeContainer = containerRef.current;
            if (!activeContainer) return;

            const preferred = initialFocusRef?.current;
            if (preferred && activeContainer.contains(preferred) && isFocusableAndVisible(preferred)) {
                preferred.focus();
                return;
            }

            const focusables = getFocusableElements(activeContainer);
            if (focusables.length > 0) {
                focusables[0].focus();
            } else {
                activeContainer.focus();
            }
        };

        const focusTimer = window.setTimeout(focusFirstElement, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isTopTrap()) return;
            if (event.key !== 'Tab') return;

            const activeContainer = containerRef.current;
            if (!activeContainer) return;

            const focusables = getFocusableElements(activeContainer);
            if (focusables.length === 0) {
                event.preventDefault();
                activeContainer.focus();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            if (event.shiftKey) {
                if (!current || current === first || !activeContainer.contains(current)) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (!current || current === last || !activeContainer.contains(current)) {
                event.preventDefault();
                first.focus();
            }
        };

        const handleFocusIn = (event: FocusEvent) => {
            if (!isTopTrap()) return;

            const activeContainer = containerRef.current;
            if (!activeContainer) return;

            const target = event.target;
            if (target instanceof Node && activeContainer.contains(target)) return;

            const focusables = getFocusableElements(activeContainer);
            if (focusables.length > 0) {
                focusables[0].focus();
            } else {
                activeContainer.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('focusin', handleFocusIn);

        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('focusin', handleFocusIn);

            const trapIndex = trapStack.lastIndexOf(trapId);
            if (trapIndex >= 0) {
                trapStack.splice(trapIndex, 1);
            }

            if (!hadTabIndex) {
                container.removeAttribute('tabindex');
            }

            if (!restoreFocus || trapStack.length > 0) return;
            if (activeElementBeforeOpen && activeElementBeforeOpen.isConnected) {
                activeElementBeforeOpen.focus();
            }
        };
    }, [containerRef, initialFocusRef, isActive, restoreFocus]);
};
