import React from 'react';
import { createPortal } from 'react-dom';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipPosition {
  x: number;
  y: number;
  placement: TooltipPlacement;
}

const SHOW_DELAY_MS = 550;
const OFFSET_PX = 10;
const VIEWPORT_MARGIN_PX = 8;
const HOVER_CAPABLE_QUERY = '(hover: hover) and (pointer: fine)';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const canUseGlobalTooltips = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(HOVER_CAPABLE_QUERY).matches;
};

const getTooltipTarget = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  const tooltipTarget = target.closest<HTMLElement>(
    '[data-tooltip]:not([data-no-global-tooltip="true"]), button:not([data-no-global-tooltip="true"])[aria-label], button:not([data-no-global-tooltip="true"])[title]'
  );
  if (!tooltipTarget) return null;
  if (tooltipTarget instanceof HTMLButtonElement && tooltipTarget.disabled) return null;
  const label = (
    tooltipTarget.getAttribute('data-tooltip')
    || tooltipTarget.getAttribute('aria-label')
    || tooltipTarget.getAttribute('title')
    || ''
  ).trim();
  if (!label) return null;
  return tooltipTarget;
};

const getPlacement = (
  rect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number
): TooltipPlacement => {
  const topSpace = rect.top - VIEWPORT_MARGIN_PX;
  const bottomSpace = viewportHeight - rect.bottom - VIEWPORT_MARGIN_PX;
  const leftSpace = rect.left - VIEWPORT_MARGIN_PX;
  const rightSpace = viewportWidth - rect.right - VIEWPORT_MARGIN_PX;

  const fitsTop = topSpace >= tooltipHeight + OFFSET_PX;
  const fitsBottom = bottomSpace >= tooltipHeight + OFFSET_PX;
  const fitsRight = rightSpace >= tooltipWidth + OFFSET_PX;
  const fitsLeft = leftSpace >= tooltipWidth + OFFSET_PX;

  if (fitsTop) return 'top';
  if (fitsBottom) return 'bottom';
  if (fitsRight) return 'right';
  if (fitsLeft) return 'left';

  if (bottomSpace >= topSpace) return 'bottom';
  return 'top';
};

const computeTooltipPosition = (
  rect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number
): TooltipPosition => {
  const placement = getPlacement(rect, tooltipWidth, tooltipHeight, viewportWidth, viewportHeight);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  if (placement === 'top') {
    return {
      placement,
      x: clamp(centerX - tooltipWidth / 2, VIEWPORT_MARGIN_PX, viewportWidth - tooltipWidth - VIEWPORT_MARGIN_PX),
      y: Math.max(VIEWPORT_MARGIN_PX, rect.top - tooltipHeight - OFFSET_PX),
    };
  }

  if (placement === 'bottom') {
    return {
      placement,
      x: clamp(centerX - tooltipWidth / 2, VIEWPORT_MARGIN_PX, viewportWidth - tooltipWidth - VIEWPORT_MARGIN_PX),
      y: Math.min(viewportHeight - tooltipHeight - VIEWPORT_MARGIN_PX, rect.bottom + OFFSET_PX),
    };
  }

  if (placement === 'left') {
    return {
      placement,
      x: Math.max(VIEWPORT_MARGIN_PX, rect.left - tooltipWidth - OFFSET_PX),
      y: clamp(centerY - tooltipHeight / 2, VIEWPORT_MARGIN_PX, viewportHeight - tooltipHeight - VIEWPORT_MARGIN_PX),
    };
  }

  return {
    placement: 'right',
    x: Math.min(viewportWidth - tooltipWidth - VIEWPORT_MARGIN_PX, rect.right + OFFSET_PX),
    y: clamp(centerY - tooltipHeight / 2, VIEWPORT_MARGIN_PX, viewportHeight - tooltipHeight - VIEWPORT_MARGIN_PX),
  };
};

export const GlobalTooltipLayer: React.FC = () => {
  const [isEnabled, setIsEnabled] = React.useState<boolean>(() => canUseGlobalTooltips());
  const [label, setLabel] = React.useState<string | null>(null);
  const [position, setPosition] = React.useState<TooltipPosition | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const activeTargetRef = React.useRef<HTMLElement | null>(null);
  const showTimerRef = React.useRef<number | null>(null);

  const clearTimers = React.useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const hideTooltip = React.useCallback(() => {
    clearTimers();
    activeTargetRef.current = null;
    setIsVisible(false);
    setLabel(null);
    setPosition(null);
  }, [clearTimers]);

  const updatePosition = React.useCallback(() => {
    const activeTarget = activeTargetRef.current;
    const tooltipEl = tooltipRef.current;
    if (!activeTarget || !tooltipEl) return;

    const rect = activeTarget.getBoundingClientRect();
    const tooltipWidth = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const nextPosition = computeTooltipPosition(rect, tooltipWidth, tooltipHeight, viewportWidth, viewportHeight);
    setPosition(nextPosition);
  }, []);

  const scheduleShow = React.useCallback((target: HTMLElement, delayMs: number) => {
    const nextLabel = (
      target.getAttribute('data-tooltip')
      || target.getAttribute('aria-label')
      || target.getAttribute('title')
      || ''
    ).trim();
    if (!nextLabel) return;

    clearTimers();
    activeTargetRef.current = target;
    setIsVisible(false);
    setLabel(null);
    setPosition(null);
    showTimerRef.current = window.setTimeout(() => {
      setLabel(nextLabel);
    }, delayMs);
  }, [clearTimers]);

  React.useLayoutEffect(() => {
    if (!label) return;
    updatePosition();
    setIsVisible(true);
  }, [label, updatePosition]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(HOVER_CAPABLE_QUERY);
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsEnabled(event.matches);
      if (!event.matches) {
        hideTooltip();
      }
    };

    setIsEnabled(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleMediaChange);
      return () => media.removeEventListener('change', handleMediaChange);
    }

    const legacyListener = (event: MediaQueryListEvent) => handleMediaChange(event);
    media.addListener(legacyListener);
    return () => media.removeListener(legacyListener);
  }, [hideTooltip]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isEnabled) return;

    const onMouseOver = (event: MouseEvent) => {
      const targetAnchor = getTooltipTarget(event.target);
      if (!targetAnchor) return;
      // Ignore nested pointerover events while hovering the same target.
      if (activeTargetRef.current === targetAnchor) return;
      scheduleShow(targetAnchor, SHOW_DELAY_MS);
    };

    const onMouseOut = (event: MouseEvent) => {
      const activeTarget = activeTargetRef.current;
      if (!activeTarget) return;
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && activeTarget.contains(relatedTarget)) return;
      hideTooltip();
    };

    const onFocusIn = (event: FocusEvent) => {
      const targetAnchor = getTooltipTarget(event.target);
      if (!targetAnchor) return;
      scheduleShow(targetAnchor, 350);
    };

    const onFocusOut = () => {
      hideTooltip();
    };

    const onScrollOrResize = () => {
      if (!activeTargetRef.current) return;
      if (!label) return;
      updatePosition();
    };

    const onMouseDown = () => {
      hideTooltip();
    };

    window.addEventListener('mouseover', onMouseOver, true);
    window.addEventListener('mouseout', onMouseOut, true);
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('mouseover', onMouseOver, true);
      window.removeEventListener('mouseout', onMouseOut, true);
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      clearTimers();
    };
  }, [clearTimers, hideTooltip, isEnabled, label, scheduleShow, updatePosition]);

  if (typeof document === 'undefined' || !label || !isEnabled) {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white shadow-xl"
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(2px)',
        transition: 'opacity 120ms ease, transform 120ms ease',
        zIndex: 2147483600,
      }}
      role="tooltip"
      aria-hidden={!isVisible}
    >
      {label}
    </div>,
    document.body
  );
};
