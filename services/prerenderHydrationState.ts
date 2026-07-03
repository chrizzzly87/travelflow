import { PRERENDERED_ROOT_ATTRIBUTE } from './reactRootRenderMode';

type PrerenderWindow = { __TF_PRERENDER_EAGER__?: boolean };

/**
 * True only while the page is being captured by the prerender script (which
 * injects this synchronous flag via addInitScript). Never true on a real
 * client. Used to keep deferred/idle-mounted content in its EMPTY state during
 * capture, so the prerendered HTML matches the client's first render (which
 * also starts empty), avoiding a preact/compat hydration mismatch.
 */
export const isPrerenderCapture = (): boolean =>
  typeof window !== 'undefined' && !!(window as unknown as PrerenderWindow).__TF_PRERENDER_EAGER__;

/**
 * True when the current document was served as a prerendered snapshot: during
 * capture (via the injected flag) OR on the client that received prerendered
 * markup (via the data-tf-prerendered-root attribute the script adds). Used by
 * content that must render eagerly and identically on both sides — e.g. image
 * cards whose <picture> is captured into the HTML.
 */
export const isPrerenderedDocument = (): boolean => {
  if (typeof document === 'undefined') return false;
  if (isPrerenderCapture()) return true;
  const root = document.getElementById('root');
  return !!root && root.hasAttribute(PRERENDERED_ROOT_ATTRIBUTE);
};
