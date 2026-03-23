const MIXED_MODE_GOOGLE_HIDDEN_SELECTORS = [
  '.gm-style-cc',
  'a[title*="Google"]',
  'a[href*="google"]',
  'button[aria-label*="keyboard"]',
  'button[aria-label*="Keyboard"]',
  'div[aria-label*="keyboard"]',
  'div[aria-label*="Keyboard"]',
].join(', ');

const GOOGLE_PLACEHOLDER_SURFACE_COLOR = 'rgb(229, 227, 223)';
const FULL_BLEED_RATIO = 0.6;

const setElementStyle = (element: HTMLElement | null, styles: Partial<CSSStyleDeclaration>): void => {
  if (!element) return;
  Object.entries(styles).forEach(([key, value]) => {
    if (value === undefined) return;
    element.style[key as keyof CSSStyleDeclaration] = value;
  });
};

const isFullBleedSurface = (element: HTMLElement, mapRect: DOMRect): boolean => {
  const rect = element.getBoundingClientRect();
  return rect.width >= mapRect.width * FULL_BLEED_RATIO && rect.height >= mapRect.height * FULL_BLEED_RATIO;
};

const applyMixedGoogleSurfaceMode = (mapDiv: HTMLElement, isEnabled: boolean): void => {
  setElementStyle(mapDiv, {
    backgroundColor: isEnabled ? 'transparent' : '',
  });

  const gmStyleRoot = mapDiv.querySelector<HTMLElement>('.gm-style');
  const mapRect = mapDiv.getBoundingClientRect();
  let current: HTMLElement | null = gmStyleRoot;
  for (let index = 0; index < 4 && current; index += 1) {
    setElementStyle(current, {
      backgroundColor: isEnabled ? 'transparent' : '',
    });
    current = current.parentElement;
  }

  const fullBleedDivs = Array.from(mapDiv.querySelectorAll<HTMLElement>('div'))
    .filter((element) => isFullBleedSurface(element, mapRect));

  fullBleedDivs.forEach((element) => {
    const style = window.getComputedStyle(element);
    if (style.backgroundColor !== GOOGLE_PLACEHOLDER_SURFACE_COLOR) return;
    setElementStyle(element, {
      backgroundColor: isEnabled ? 'transparent' : '',
    });
  });

  mapDiv.querySelectorAll<HTMLElement>(MIXED_MODE_GOOGLE_HIDDEN_SELECTORS).forEach((element) => {
    setElementStyle(element, {
      display: isEnabled ? 'none' : '',
    });
  });
};

export interface GoogleMixedSurfaceController {
  apply: (isEnabled: boolean) => void;
  destroy: () => void;
}

export const createGoogleMixedSurfaceController = (
  map: google.maps.Map,
): GoogleMixedSurfaceController | null => {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
    return null;
  }

  const mapDiv = map.getDiv();
  if (!(mapDiv instanceof HTMLElement)) {
    return null;
  }

  let isEnabled = false;
  let frameId: number | null = null;

  const flush = () => {
    frameId = null;
    applyMixedGoogleSurfaceMode(mapDiv, isEnabled);
  };

  const scheduleFlush = () => {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(flush);
  };

  const mutationObserver = new MutationObserver(() => {
    scheduleFlush();
  });

  mutationObserver.observe(mapDiv, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  scheduleFlush();

  return {
    apply(nextEnabled: boolean) {
      isEnabled = nextEnabled;
      scheduleFlush();
    },
    destroy() {
      mutationObserver.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      applyMixedGoogleSurfaceMode(mapDiv, false);
    },
  };
};

export const __testing__ = {
  applyMixedGoogleSurfaceMode,
};
