export interface GoogleBasemapOverlayController {
  apply: (hideBasePane: boolean) => void;
  destroy: () => void;
}

const setElementStyle = (element: HTMLElement | null, styles: Partial<CSSStyleDeclaration>): void => {
  if (!element) return;
  Object.entries(styles).forEach(([key, value]) => {
    if (value === undefined) return;
    element.style[key as keyof CSSStyleDeclaration] = value;
  });
};

const applyGoogleBasePaneVisibility = (
  mapDiv: HTMLElement,
  mapPane: HTMLElement | null,
  hideBasePane: boolean,
): void => {
  setElementStyle(mapDiv, {
    backgroundColor: hideBasePane ? 'transparent' : '',
  });

  const gmStyleRoot = mapDiv.querySelector<HTMLElement>('.gm-style');
  setElementStyle(gmStyleRoot, {
    backgroundColor: hideBasePane ? 'transparent' : '',
  });

  setElementStyle(mapPane, {
    opacity: hideBasePane ? '0' : '',
    visibility: hideBasePane ? 'hidden' : '',
  });
};

export const createGoogleBasemapOverlayController = (
  map: google.maps.Map,
): GoogleBasemapOverlayController | null => {
  if (typeof window === 'undefined' || !window.google?.maps?.OverlayView) {
    return null;
  }

  const mapDiv = map.getDiv();
  if (!(mapDiv instanceof HTMLElement)) {
    return null;
  }

  let mapPane: HTMLElement | null = null;
  let hideBasePane = false;

  const overlay = new window.google.maps.OverlayView();
  overlay.onAdd = () => {
    const panes = overlay.getPanes();
    mapPane = panes?.mapPane instanceof HTMLElement ? panes.mapPane : null;
    applyGoogleBasePaneVisibility(mapDiv, mapPane, hideBasePane);
  };
  overlay.draw = () => {};
  overlay.onRemove = () => {
    applyGoogleBasePaneVisibility(mapDiv, mapPane, false);
    mapPane = null;
  };
  overlay.setMap(map);

  return {
    apply(nextHideBasePane: boolean) {
      hideBasePane = nextHideBasePane;
      applyGoogleBasePaneVisibility(mapDiv, mapPane, hideBasePane);
    },
    destroy() {
      overlay.setMap(null);
    },
  };
};
