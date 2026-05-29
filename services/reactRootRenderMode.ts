export const PRERENDERED_ROOT_ATTRIBUTE = 'data-tf-prerendered-root';

export const shouldHydrateReactRoot = (rootElement: HTMLElement): boolean => {
  return rootElement.hasChildNodes();
};
