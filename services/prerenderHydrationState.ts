import { PRERENDERED_ROOT_ATTRIBUTE } from './reactRootRenderMode';

/**
 * True when the current document was served as a prerendered snapshot (the
 * prerender script tags #root with data-tf-prerendered-root).
 *
 * IntersectionObserver-gated sections (below-fold marketing blocks, the footer)
 * must render eagerly on the FIRST client render of such a page so it matches
 * the prerendered markup — otherwise hydration reconciles full server content
 * against empty client spacers and rebuilds the subtree (visible flash + CLS).
 * The check is synchronous so it can seed useState initializers, and it is
 * evaluated identically during prerender capture (attribute absent → normal
 * lazy/IO behaviour, which the prerender scroll pass trips) and on the client
 * (attribute present → eager), keeping both renders in agreement.
 */
export const isPrerenderedDocument = (): boolean => {
  if (typeof document === 'undefined') return false;
  // During prerender capture the root is not yet tagged (the script adds the
  // attribute after capture), so the prerender injects this synchronous flag
  // via addInitScript. Honouring both keeps the captured markup and the
  // client's first hydration render in agreement.
  if ((window as unknown as { __TF_PRERENDER_EAGER__?: boolean }).__TF_PRERENDER_EAGER__) return true;
  const root = document.getElementById('root');
  return !!root && root.hasAttribute(PRERENDERED_ROOT_ATTRIBUTE);
};
