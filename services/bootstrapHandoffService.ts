const VISUAL_FALLBACK_SELECTORS = [
  '[data-testid="route-loading-shell"]',
  '[data-testid="trip-route-loading-shell"]',
].join(', ');

export const hasRenderableHandoffNode = (rootElement: ParentNode): boolean => {
  const readyNodes = Array.from(rootElement.querySelectorAll('[data-tf-handoff-ready="true"]'));
  return readyNodes.some((node) => !node.querySelector(VISUAL_FALLBACK_SELECTORS));
};
