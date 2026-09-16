// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { RecommendationSwipeDeck } from '../../../components/recommendations/RecommendationSwipeDeck';
import type { Recommendation } from '../../../shared/recommendations';

const makeRecommendation = (id: string, overrides: Partial<Recommendation> = {}): Recommendation => ({
  id,
  slug: id,
  countryCode: 'TW',
  cityName: 'Taipei',
  citySlug: 'taipei',
  location: {
    lat: 25, lng: 121, address: null, formattedAddress: 'Taipei, Taiwan',
    geocodePrecision: 'rooftop', googlePlaceId: null, geocodedAt: null,
  },
  locale: 'en',
  title: `Place ${id}`,
  summary: 'A summary',
  description: 'A description',
  activityTypes: ['food'],
  tags: [],
  costBand: 'free',
  costNote: null,
  typicalDurationMinutes: 30,
  bestTimeOfDay: null,
  image: null,
  origin: 'import',
  sources: [{ kind: 'instagram', handle: '@creator', url: 'https://example.test/p', capturedAt: null }],
  likeCount: 0,
  qualityScore: null,
  status: 'in_review',
  ...overrides,
});

const renderDeck = (props: Partial<React.ComponentProps<typeof RecommendationSwipeDeck>> = {}) => {
  const onDecide = vi.fn();
  const result = render(React.createElement(RecommendationSwipeDeck, {
    tripId: 'trip-1',
    recommendations: [makeRecommendation('a'), makeRecommendation('b')],
    onDecide,
    ...props,
  }));
  return { ...result, onDecide };
};

describe('components/recommendations/RecommendationSwipeDeck', () => {
  afterEach(() => cleanup());

  it('shows the top card with what the traveller needs to decide', () => {
    renderDeck();

    const card = screen.getByTestId('recommendation-card');
    expect(card).toHaveAttribute('data-recommendation-id', 'a');
    expect(screen.getByText('Place a')).toBeInTheDocument();
    expect(screen.getByText('Taipei')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
  });

  it('credits the creator with a link out rather than rehosting anything', () => {
    renderDeck();

    const credit = screen.getByRole('link', { name: '@creator' });
    expect(credit).toHaveAttribute('href', 'https://example.test/p');
    expect(credit).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('keeps and skips through the buttons', () => {
    const { onDecide } = renderDeck();

    fireEvent.click(screen.getByTestId('recommendation-save'));
    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'save');

    fireEvent.click(screen.getByTestId('recommendation-dismiss'));
    expect(onDecide).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }), 'dismiss');
  });

  it('decides with the arrow keys, so the deck is not swipe-only', () => {
    const { onDecide } = renderDeck();
    // The handler sits on the deck region rather than on the card: the card is
    // dragged, and the focusable controls are the Keep and Skip buttons.
    const control = screen.getByTestId('recommendation-save');

    fireEvent.keyDown(control, { key: 'ArrowRight' });
    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'save');

    fireEvent.keyDown(control, { key: 'ArrowLeft' });
    expect(onDecide).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }), 'dismiss');
  });

  it('ignores a drag that never travelled far enough to be a swipe', () => {
    const { onDecide } = renderDeck();
    const card = screen.getByTestId('recommendation-card');

    fireEvent.pointerDown(card, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 230 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 230 });

    expect(onDecide).not.toHaveBeenCalled();
  });

  it('commits a swipe that crossed the threshold, in the direction it went', () => {
    const { onDecide } = renderDeck();
    const card = screen.getByTestId('recommendation-card');

    fireEvent.pointerDown(card, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 360 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 360 });

    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'save');
  });

  it('offers undo only once something has been decided', () => {
    const onUndo = vi.fn();
    const { rerender } = renderDeck({ onUndo, canUndo: false });
    expect(screen.getByTestId('recommendation-undo')).toBeDisabled();

    rerender(React.createElement(RecommendationSwipeDeck, {
      tripId: 'trip-1',
      recommendations: [makeRecommendation('a')],
      onDecide: vi.fn(),
      onUndo,
      canUndo: true,
    }));

    fireEvent.click(screen.getByTestId('recommendation-undo'));
    expect(onUndo).toHaveBeenCalled();
  });

  it('says so when the deck runs out', () => {
    renderDeck({ recommendations: [] });

    expect(screen.getByTestId('recommendation-deck-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('recommendation-card')).not.toBeInTheDocument();
  });
});
