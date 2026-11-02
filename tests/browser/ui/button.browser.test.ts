// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Button } from '../../../components/ui/button';

const readBlock = (css: string, selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('\n}', start));
};

describe('components/ui/button', () => {
  it('pairs the dark primary fill with the dark primary ink', () => {
    // Tailwind's bg-primary resolves through --tf-primary, but only --primary was
    // flipped for dark mode. The fill stayed indigo-600 while the label turned
    // near-black, so the AI chat's Preview and Send buttons were unreadable.
    const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
    expect(css).toMatch(/--color-primary:\s*var\(--tf-primary\);/);
    expect(css).toMatch(/--color-primary-foreground:\s*var\(--primary-foreground\);/);

    const dark = readBlock(css, '.dark');
    expect(dark).toMatch(/--primary-foreground:\s*var\(--background\);/);
    expect(dark).toMatch(/--tf-primary:\s*var\(--tf-accent-400\);/);
    expect(dark).toMatch(/--tf-primary-contrast:\s*var\(--background\);/);
  });

  it('renders a shortcut hint that follows the label colour', () => {
    render(React.createElement(
      Button,
      { shortcut: '⌘⇧P', 'aria-keyshortcuts': 'Meta+Shift+P' },
      'Preview',
    ));

    const button = screen.getByRole('button', { name: /Preview/ });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+Shift+P');
    const hint = button.querySelector('kbd[data-slot="kbd"]');
    expect(hint).toHaveTextContent('⌘⇧P');
    // A fixed white border disappeared on dark mode's light fill.
    expect(hint?.className).toContain('border-current/35');
    expect(hint?.className).not.toContain('border-white');
  });

  it('leaves asChild children alone, since Slot takes exactly one child', () => {
    render(React.createElement(
      Button,
      { asChild: true, shortcut: 'K' },
      React.createElement('a', { href: '/x' }, 'Link'),
    ));

    const link = screen.getByRole('link', { name: 'Link' });
    expect(link.querySelector('kbd')).toBeNull();
  });

  it('styles the pressed state from aria-pressed on toggle and floating controls', () => {
    render(React.createElement(
      'div',
      null,
      React.createElement(Button, { variant: 'toggle', 'aria-pressed': true, 'aria-label': 'Vertical' }),
      React.createElement(Button, { variant: 'floating', 'aria-pressed': false, 'aria-label': 'Horizontal' }),
    ));

    expect(screen.getByRole('button', { name: 'Vertical', pressed: true }).className)
      .toContain('aria-pressed:bg-primary');
    expect(screen.getByRole('button', { name: 'Horizontal', pressed: false }).className)
      .toContain('aria-pressed:text-primary-foreground');
  });

  it('keeps a pressed control label colour on hover and changes only the fill', () => {
    // In dark mode the accent icon hover beat the pressed state, so a pressed map
    // button turned light indigo on indigo when hovered.
    render(React.createElement(Button, { variant: 'floating', 'aria-pressed': true, 'aria-label': 'Labels' }));
    const classes = screen.getByRole('button', { name: 'Labels' }).className.split(/\s+/);

    expect(classes).toContain('aria-pressed:hover:bg-primary-hover');
    expect(classes).toContain('dark:not-aria-pressed:hover:text-accent-300');
    expect(classes).not.toContain('dark:hover:text-accent-300');
  });

  it('gives ghost buttons the same solid hover surface in both themes', () => {
    // A half-strength dark hover made the chat header and "Review again" differ.
    render(React.createElement(Button, { variant: 'ghost' }, 'Review again'));
    const className = screen.getByRole('button', { name: 'Review again' }).className;

    expect(className).toContain('hover:bg-secondary');
    expect(className).not.toContain('accent/50');
  });

  it('forwards refs, which preact/compat drops from a plain function component', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(React.createElement(Button, { ref, shortcut: 'K' }, 'Go'));
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
