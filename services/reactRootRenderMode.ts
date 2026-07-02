export const PRERENDERED_ROOT_ATTRIBUTE = 'data-tf-prerendered-root';

// Hydrate whenever prerendered markup exists. Components that read
// personalized browser state (auth session, dismissed banners, locale
// suggestions) must render their storage-independent default first and
// reconcile in an effect, so hydration is always safe. Bailing out to a
// client re-render here would tear down the prerendered page and blank it
// until every chunk resolves — exactly the flash this module exists to avoid.
export const shouldHydrateReactRoot = (rootElement: HTMLElement): boolean =>
  rootElement.hasChildNodes();
