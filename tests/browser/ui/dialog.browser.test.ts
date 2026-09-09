// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';

const h = React.createElement;

afterEach(cleanup);

const open = (contentProps: Record<string, unknown> = {}, bodyProps: Record<string, unknown> = {}) =>
  render(
    h(Dialog, { open: true },
      h(DialogContent, contentProps,
        h(DialogHeader, null,
          h(DialogTitle, null, 'Default AI model'),
          h(DialogDescription, null, 'Only approved models are used.')),
        h(DialogBody, bodyProps, 'body'),
        h(DialogFooter, null, h('button', null, 'Save')))),
  );

describe('Dialog', () => {
  it('gives the header, body and footer one shared horizontal inset', () => {
    open();
    const dialog = screen.getByRole('dialog');
    const parts = ['dialog-header', 'dialog-body', 'dialog-footer']
      .map((slot) => dialog.querySelector(`[data-slot="${slot}"]`));

    expect(parts.every(Boolean)).toBe(true);
    // The bug this replaces: the header was padded and the body ran flush to
    // the dialog edge, so the search field sat wider than the title above it.
    for (const part of parts) {
      expect(part?.className).toContain('px-5');
    }
  });

  it('caps its height and lets only the body scroll', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[min(85dvh,48rem)]');
    expect(dialog.className).toContain('flex-col');
    expect(dialog.className).toContain('overflow-hidden');

    const body = dialog.querySelector('[data-slot="dialog-body"]');
    expect(body?.className).toContain('overflow-y-auto');
    expect(body?.className).toContain('min-h-0');
  });

  it('yields the scroll to a child that owns it', () => {
    open({}, { scroll: false });
    const body = screen.getByRole('dialog').querySelector('[data-slot="dialog-body"]');
    // Two nested scrollers trap the wheel in the inner one.
    expect(body?.className).toContain('overflow-hidden');
    expect(body?.className).not.toContain('overflow-y-auto');
  });

  it('pins the footer with a rule, and drops it when asked', () => {
    open();
    expect(screen.getByRole('dialog').querySelector('[data-slot="dialog-footer"]')?.className)
      .toContain('border-t');
    cleanup();

    render(h(Dialog, { open: true },
      h(DialogContent, null,
        h(DialogHeader, null, h(DialogTitle, null, 'T')),
        h(DialogFooter, { sticky: false }, 'f'))));
    expect(screen.getByRole('dialog').querySelector('[data-slot="dialog-footer"]')?.className)
      .not.toContain('border-t');
  });

  it('only draws a close button when one is asked for', () => {
    open();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    cleanup();

    // Off by default because several dialogs here draw their own, and two in
    // one corner looks broken.
    open({ showCloseButton: true });
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('sizes from the preset rather than a hand-written width', () => {
    open({ size: 'sm' });
    expect(screen.getByRole('dialog').className).toContain('w-[min(92vw,420px)]');
  });
});
