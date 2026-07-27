// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PlayfulDecisionButton,
  PlayfulDecisionSurface,
} from '../../components/ui/playful-decision-card';

afterEach(cleanup);

describe('components/ui/playful-decision-card', () => {
  it('provides an accessible selected button while preserving caller behavior and styles', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(React.createElement(
      'div',
      { className: 'tf-travel-experience' },
      React.createElement(
        PlayfulDecisionButton,
        {
          tone: 'lagoon',
          selected: true,
          rotation: -1.25,
          scribble: true,
          className: 'route-choice',
          style: { inlineSize: '18rem' },
          onClick,
        },
        'Island rhythm',
      ),
    ));

    const button = screen.getByRole('button', { name: 'Island rhythm' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-tone', 'lagoon');
    expect(button).toHaveAttribute('data-selected', 'true');
    expect(button).toHaveAttribute('data-scribble', 'true');
    expect(button).toHaveClass('tf-playful-decision-card', 'route-choice');
    expect(button.style.getPropertyValue('--tf-playful-rotation')).toBe('-1.25deg');
    expect(button.style.inlineSize).toBe('18rem');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive decision surface without inventing button semantics', () => {
    render(React.createElement(
      PlayfulDecisionSurface,
      { tone: 'hibiscus', rotation: 0.75, 'aria-label': 'Northern route concept' },
      'Route details',
    ));

    const surface = screen.getByLabelText('Northern route concept');
    expect(surface.tagName).toBe('ARTICLE');
    expect(surface).toHaveAttribute('data-slot', 'playful-decision-surface');
    expect(surface).toHaveAttribute('data-tone', 'hibiscus');
    expect(surface).toHaveAttribute('data-selected', 'false');
    expect(surface).not.toHaveAttribute('data-interactive');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
