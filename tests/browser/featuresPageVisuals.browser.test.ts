// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeatureSpotlightCard } from '../../components/marketing/features/FeatureSpotlightCard';
import { RevealWords } from '../../components/marketing/features/RevealWords';

describe('components/marketing/features/RevealWords', () => {
  it('exposes the full sentence once and hides the animated words from assistive tech', () => {
    const { container } = render(
      React.createElement(RevealWords, {
        segments: [{ text: 'One trip. One plan.' }, { text: 'One link.' }],
      }),
    );

    const spoken = container.querySelector('.sr-only');
    expect(spoken?.textContent).toBe('One trip. One plan. One link.');

    const animated = container.querySelector('[aria-hidden="true"]');
    expect(animated).not.toBeNull();
    // The visible text must still read correctly once the per-word spans are joined.
    expect(animated?.textContent?.replace(/\s+/g, ' ').trim()).toBe('One trip. One plan. One link.');
  });

  it('numbers words continuously across segments so the stagger does not restart', () => {
    const { container } = render(
      React.createElement(RevealWords, {
        segments: [
          { text: 'One trip. One plan.' },
          { text: 'One link.', className: 'text-accent-700' },
        ],
      }),
    );

    const words = Array.from(container.querySelectorAll('.tf-reveal-word'));
    expect(words.map((word) => word.textContent)).toEqual([
      'One', 'trip.', 'One', 'plan.', 'One', 'link.',
    ]);
    expect(words.map((word) => (word as HTMLElement).style.getPropertyValue('--tf-word')))
      .toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('marks every word with the class the reveal keyframes select', () => {
    const { container } = render(
      React.createElement(RevealWords, {
        segments: [{ text: 'One trip.' }, { text: 'One link.' }],
      }),
    );

    // Regression: the words are grandchildren of .tf-reveal-words, so a
    // `.tf-reveal-words > span` rule matched the wrappers and animated nothing.
    const words = container.querySelectorAll('.tf-reveal-word');
    expect(words).toHaveLength(4);
    words.forEach((word) => {
      expect(word.parentElement?.classList.contains('tf-reveal-words')).toBe(false);
    });
  });

  it('applies a segment class only to that segment', () => {
    const { container } = render(
      React.createElement(RevealWords, {
        segments: [
          { text: 'One trip.' },
          { text: 'One link.', className: 'text-accent-700' },
        ],
      }),
    );

    const accented = Array.from(container.querySelectorAll('.text-accent-700'));
    expect(accented.map((word) => word.textContent)).toEqual(['One', 'link.']);
  });

  it('holds the first word for the configured start delay', () => {
    const { container } = render(
      React.createElement(RevealWords, {
        segments: [{ text: 'One link.' }],
        startDelayMs: 300,
      }),
    );

    const root = container.querySelector('.tf-reveal-words') as HTMLElement;
    expect(root.style.getPropertyValue('--tf-reveal-start')).toBe('300ms');
  });
});

describe('components/marketing/features/FeatureSpotlightCard', () => {
  it('writes the pointer position as a percentage and clears it on leave', () => {
    const { container } = render(
      React.createElement(FeatureSpotlightCard, { children: 'Drafted in seconds' }),
    );

    const card = container.querySelector('.tf-spotlight') as HTMLElement;
    card.getBoundingClientRect = () => ({
      left: 100, top: 50, width: 200, height: 100,
      right: 300, bottom: 150, x: 100, y: 50, toJSON: () => ({}),
    });

    fireEvent.pointerMove(card, { clientX: 150, clientY: 75 });
    expect(card.style.getPropertyValue('--tf-spot-x')).toBe('25%');
    expect(card.style.getPropertyValue('--tf-spot-y')).toBe('25%');

    fireEvent.pointerLeave(card);
    expect(card.style.getPropertyValue('--tf-spot-x')).toBe('');
    expect(card.style.getPropertyValue('--tf-spot-y')).toBe('');
  });

  it('ignores a move on a card that has not been laid out yet', () => {
    const { container } = render(
      React.createElement(FeatureSpotlightCard, { children: 'Shaped by hand' }),
    );

    const card = container.querySelector('.tf-spotlight') as HTMLElement;
    card.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 0, height: 0,
      right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}),
    });

    fireEvent.pointerMove(card, { clientX: 10, clientY: 10 });
    expect(card.style.getPropertyValue('--tf-spot-x')).toBe('');
  });
});
