/**
 * Client bridge to the inline boot script in `index.html`
 * (`<script data-tf-hydration-bridge>`).
 *
 * Prerendered pages paint a fully formed page long before the React tree that
 * owns it mounts, so every control on screen is inert for the first seconds of
 * a mobile load: taps on the burger were silently dropped, and UI that waits
 * for a first interaction (the cookie banner) never saw the interaction that
 * should have armed it.
 *
 * The inline script runs during HTML parse — before any module is fetched — and
 * records that window. A control opts in by carrying `data-tf-boot-intent` in
 * the prerendered markup; the component that owns it reads the intent on its
 * first render. We record intent rather than replaying the click, because the
 * owning component arrives with its own lazy chunk well after the React root
 * mounts, so there is no moment at which a re-dispatched click is reliably
 * heard.
 */

export interface BootInteractionBridge {
  /** True once the visitor has pressed, typed or scrolled, even pre-hydration. */
  interacted: boolean;
  /** `data-tf-boot-intent` of the last control pressed while the page was inert. */
  intent: string | null;
  /** Set by the first consumer; stops the inline script recording further intents. */
  sealed: boolean;
}

type BridgeWindow = Window & { __TF_BOOT__?: BootInteractionBridge };

const readBridge = (): BootInteractionBridge | undefined => (
  typeof window === 'undefined' ? undefined : (window as BridgeWindow).__TF_BOOT__
);

/** Intents recorded by the inline script, in the markup and in this module. */
export const BOOT_INTENT_MOBILE_MENU = 'mobile-menu';

/**
 * True when the visitor already interacted with the page before React mounted.
 * UI that waits for a first interaction must treat this as that interaction —
 * otherwise it waits for a second one the visitor has no reason to make.
 */
export const hasPreHydrationInteraction = (): boolean => readBridge()?.interacted === true;

/**
 * Read (and clear) a press that landed on an inert control before this
 * component existed. Safe to call during render: it never returns the same
 * intent twice, and it seals the bridge so a later remount cannot act on a tap
 * the live page already handled.
 */
export const consumeBootIntent = (intent: string): boolean => {
  const bridge = readBridge();
  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-tf-boot-pending]')
      .forEach((node) => node.removeAttribute('data-tf-boot-pending'));
  }
  if (!bridge) return false;

  const matched = bridge.intent === intent;
  bridge.intent = null;
  bridge.sealed = true;
  return matched;
};
