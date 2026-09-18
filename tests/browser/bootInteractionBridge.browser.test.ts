// @vitest-environment jsdom
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  BOOT_INTENT_MOBILE_MENU,
  consumeBootIntent,
  hasPreHydrationInteraction,
} from '../../services/bootInteractionBridge';

/**
 * Exercises the real inline script shipped in index.html — the one that keeps a
 * pre-hydration tap from being silently dropped on a prerendered page.
 *
 * Regression: on mobile the prerendered page paints a finished header seconds
 * before the chunk that makes it interactive arrives. A tap on the burger in
 * that window hit an inert <button>, nothing happened, and the visitor was left
 * with no way into navigation or login.
 */
const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

const extractBridgeScript = (): string => {
  const match = INDEX_HTML.match(/<script data-tf-hydration-bridge>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('index.html no longer contains the hydration bridge script');
  return match[1];
};

const runBridge = () => {
  // eslint-disable-next-line no-new-func
  new Function(extractBridgeScript())();
};

const burger = () => document.getElementById('burger') as HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = `<div id="root"><button type="button" id="burger" data-tf-boot-intent="${BOOT_INTENT_MOBILE_MENU}">Menu</button></div>`;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TF_BOOT__;
});

describe('pre-hydration interaction bridge', () => {
  it('hands a tap that landed on the inert burger to the header when it hydrates', () => {
    runBridge();

    burger().click();
    expect(burger().getAttribute('data-tf-boot-pending')).toBe('true');

    // SiteHeader's chunk finally arrives and reads the intent on first render.
    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(true);
    expect(burger().hasAttribute('data-tf-boot-pending')).toBe(false);
  });

  it('never hands the same tap over twice', () => {
    runBridge();
    burger().click();

    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(true);
    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(false);
  });

  it('reports no intent when nothing was pressed', () => {
    runBridge();
    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(false);
  });

  it('ignores a press on a control that did not opt in', () => {
    runBridge();
    burger().removeAttribute('data-tf-boot-intent');

    burger().click();
    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(false);
  });

  it('stops recording once a hydrated control has read the bridge', () => {
    runBridge();
    // The header hydrates and finds nothing pending; the page is live from here.
    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(false);

    // A later press is React's to handle — a remount must not act on it again.
    burger().click();
    expect(burger().hasAttribute('data-tf-boot-pending')).toBe(false);
    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(false);
  });

  it('records the interaction so interaction-armed UI does not wait for a second one', () => {
    runBridge();
    expect(hasPreHydrationInteraction()).toBe(false);

    burger().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(hasPreHydrationInteraction()).toBe(true);
  });

  it('is a no-op when the inline script never ran', () => {
    expect(hasPreHydrationInteraction()).toBe(false);
    expect(consumeBootIntent(BOOT_INTENT_MOBILE_MENU)).toBe(false);
  });
});
