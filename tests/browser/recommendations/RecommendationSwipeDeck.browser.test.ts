// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

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
    // Scoped to the top card: the cards behind it render their media too.
    expect(within(card).getByText('Place a')).toBeInTheDocument();
    expect(within(card).getByText('Taipei')).toBeInTheDocument();
    expect(within(card).getByText('Free')).toBeInTheDocument();
    expect(within(card).getByText('30 min')).toBeInTheDocument();
  });

  it('draws the cards behind the top one, so the deck reads as a stack', () => {
    renderDeck({
      recommendations: [makeRecommendation('a'), makeRecommendation('b'), makeRecommendation('c'), makeRecommendation('d')],
    });

    // Three at a time: the top card plus two visible behind it.
    expect(screen.getAllByTestId('recommendation-card-behind')).toHaveLength(2);
  });

  it('always places the card on a map, even when a photo leads', () => {
    renderDeck({
      recommendations: [makeRecommendation('a', {
        image: {
          url: '/api/place-photo?ref=places/x/photos/y',
          provider: 'google_places',
          attribution: 'A Photographer',
          authorUrl: null,
          blurhash: null,
        },
      })],
    });

    const card = screen.getByTestId('recommendation-card');
    expect(within(card).getByTestId('recommendation-card-map')).toBeInTheDocument();
    expect(within(card).getByText('Photo: A Photographer')).toBeInTheDocument();
  });

  it('falls back to the map as the hero when there is no photo', () => {
    renderDeck({ recommendations: [makeRecommendation('a')] });

    const card = screen.getByTestId('recommendation-card');
    // No inset map, because the map is the hero image itself.
    expect(within(card).queryByTestId('recommendation-card-map')).not.toBeInTheDocument();
    expect(within(card).getByRole('presentation', { hidden: true })).toBeTruthy();
  });

  it('keeps the creator credit off the swipe card, where the address has to live', () => {
    renderDeck();

    const card = screen.getByTestId('recommendation-card');
    expect(within(card).queryByRole('link', { name: '@creator' })).not.toBeInTheDocument();
  });

  it('pins the address to the bottom of the card and makes it tappable', () => {
    renderDeck({
      recommendations: [makeRecommendation('a')],
    });

    const address = within(screen.getByTestId('recommendation-card')).getByTestId('recommendation-card-address');
    expect(address).toHaveAccessibleName('Open Place a in Maps');
    expect(address).not.toBeDisabled();
  });

  it('lists the highlights as their own bullets, not buried in the description', () => {
    renderDeck({
      recommendations: [makeRecommendation('a', {
        highlights: ['Order the xiaolongbao', 'Queue before 11:00'],
      })],
    });

    const card = screen.getByTestId('recommendation-card');
    expect(within(card).getByTestId('recommendation-highlights')).toBeInTheDocument();
    expect(within(card).getByText('Order the xiaolongbao')).toBeInTheDocument();
    expect(within(card).getByText('Queue before 11:00')).toBeInTheDocument();
  });

  it('renders the next card whole, so its text is not drawn for the first time mid-swipe', () => {
    renderDeck({
      recommendations: [makeRecommendation('a', { title: 'Front' }), makeRecommendation('b', { title: 'Next up' })],
    });

    const behind = screen.getByTestId('recommendation-card-behind');
    expect(within(behind).getByText('Next up')).toBeInTheDocument();
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

  it('exposes the card as draggable, which is what carries the swipe', () => {
    renderDeck();

    // The gesture itself runs through framer-motion, which cannot be driven by
    // synthetic pointer events under jsdom; the drag threshold and the flick
    // velocity are checked in the browser instead.
    const card = screen.getByTestId('recommendation-card');
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('Swipe'));
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

  it('keeps the leaving card mounted so it can animate out while the next arrives', () => {
    const { rerender } = renderDeck();
    expect(screen.getByTestId('recommendation-card')).toHaveAttribute('data-recommendation-id', 'a');

    rerender(React.createElement(RecommendationSwipeDeck, {
      tripId: 'trip-1',
      recommendations: [makeRecommendation('b'), makeRecommendation('c')],
      onDecide: vi.fn(),
    }));

    // Both are present mid-transition: the old deck replaced the card outright,
    // so it disappeared instead of flying off.
    const cards = screen.getAllByTestId('recommendation-card');
    const ids = cards.map((card) => card.getAttribute('data-recommendation-id'));
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('gives the entering card its own drag position', () => {
    const { rerender } = renderDeck();

    rerender(React.createElement(RecommendationSwipeDeck, {
      tripId: 'trip-1',
      recommendations: [makeRecommendation('b'), makeRecommendation('c')],
      onDecide: vi.fn(),
    }));

    // A single shared motion value made the incoming card inherit the
    // outgoing card's x, so it arrived already thrown off-centre.
    const entering = screen
      .getAllByTestId('recommendation-card')
      .find((card) => card.getAttribute('data-recommendation-id') === 'b');
    expect(entering).toBeTruthy();
    expect(entering!.style.transform ?? '').not.toMatch(/translateX\((?!0px)/);
  });

});
