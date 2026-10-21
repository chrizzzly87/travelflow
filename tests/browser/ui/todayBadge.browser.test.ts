// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TodayBadge } from '../../../components/ui/today-badge';

describe('components/ui/today-badge', () => {
  it('paints from the shared today tokens rather than a per-surface palette', () => {
    // Four surfaces used to say "Today" in three different colours, and two of
    // them were accent-purple over a dark sheet. The tokens carry a solid value
    // on both sides, which the badge needs: it overlaps the day column's own
    // tint and the grid behind it, so a translucent fill would stack.
    render(React.createElement(TodayBadge));

    const badge = screen.getByTestId('today-badge');
    expect(badge).toHaveAttribute('data-slot', 'today-badge');
    expect(badge).toHaveTextContent('Today');
    expect(badge).toHaveClass('bg-[var(--tf-today-badge-bg)]');
    expect(badge).toHaveClass('text-[var(--tf-today-badge-text)]');
    expect(badge).toHaveClass('border-[var(--tf-today-badge-border)]');
  });

  it('takes a ref, which preact/compat drops from a plain function component', () => {
    // A caller measuring the marker or scrolling to it gets a real node.
    const ref = React.createRef<HTMLSpanElement>();
    render(React.createElement(TodayBadge, { ref, size: 'sm' }));

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.className).toContain('text-[9px]');
  });
});
