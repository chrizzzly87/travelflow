/**
 * Client bridge to `src/document/interaction-boot.js`
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
 * first render. Other controls opt into `data-tf-boot-replay` and register their
 * scope after their own handlers mount. Root hydration alone is insufficient:
 * a control's lazy chunk can arrive later. Those controls receive one replay
 * once their owner is ready.
 */

export interface BootInteractionBridge {
  /** True once the visitor has pressed, typed or scrolled, even pre-hydration. */
  interacted: boolean;
  /** Active presses are tracked before React mounts, including multiple pointers. */
  pointerActive?: boolean;
  /** `data-tf-boot-intent` of the last control pressed while the page was inert. */
  intent: string | null;
  /** Set by the first consumer; stops the inline script recording further intents. */
  sealed: boolean;
  pendingControls?: Array<{ key: string; scope: string; kind: string }>;
  readyScopes?: Record<string, number>;
  dispose?: () => void;
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
export const hasActiveBootPointer = (): boolean => readBridge()?.pointerActive === true;

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
    document.querySelectorAll('[data-tf-boot-intent][data-tf-boot-pending]')
      .forEach((node) => node.removeAttribute('data-tf-boot-pending'));
  }
  if (!bridge) return false;

  const matched = bridge.intent === intent;
  bridge.intent = null;
  bridge.sealed = true;
  return matched;
};

/**
 * Called by each opt-in control owner after hydration, when its handlers exist.
 * Scope counts survive overlapping mounts and deferred effect cleanups. Each
 * early control is replayed once, against the current DOM rather than a node
 * the hydrator may have replaced. No state is persisted in browser storage.
 */
export const activateBootControls = (scope: string): (() => void) => {
  const bridge = readBridge();
  if (!bridge || typeof document === 'undefined') return () => {};
  const scopes = bridge.readyScopes ?? (bridge.readyScopes = {});
  scopes[scope] = (scopes[scope] ?? 0) + 1;
  const pending = (bridge.pendingControls ?? []).filter((entry) => entry.scope === scope);
  bridge.pendingControls = (bridge.pendingControls ?? []).filter((entry) => entry.scope !== scope);

  for (const entry of pending) {
    const control = Array.from(document.querySelectorAll<HTMLElement>('[data-tf-boot-replay]'))
      .find((node) => node.getAttribute('data-tf-boot-replay') === entry.key
        && node.getAttribute('data-tf-boot-scope') === scope);
    if (!control) continue;
    control.removeAttribute('data-tf-boot-pending');
    if (control.matches('[disabled], [aria-disabled="true"]')) continue;
    if (entry.kind === 'pointerdown') {
      // Radix Select opens on mouse pointerdown; a click alone does not open it.
      const pointer = new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', pointerId: 1, isPrimary: true,
      });
      // This wakes a control; it is not a new physical press to await.
      Object.defineProperty(pointer, '__tfBootReplay', { value: true });
      control.dispatchEvent(pointer);
    }
    control.click();
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    scopes[scope] = Math.max(0, (scopes[scope] ?? 1) - 1);
  };
};
