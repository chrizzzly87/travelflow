// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('header', { 'data-testid': 'site-header' }),
}));

vi.mock('../../components/marketing/SiteFooter', () => ({
  SiteFooter: () => React.createElement('footer', { 'data-testid': 'site-footer' }),
}));

vi.mock('../../services/analyticsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/analyticsService')>();
  return { ...actual, trackEvent: vi.fn() };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'journeyLab.chapter.nights') return `${options?.count} nights`;
      if (key === 'journeyLab.chapter.days') return `Days ${options?.range}`;
      if (key === 'journeyLab.transfer.ariaLabel') return `${options?.from} to ${options?.to}, ${options?.duration}`;
      return key;
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

import { JourneyOverviewLabPage } from '../../pages/JourneyOverviewLabPage';
import { trackEvent } from '../../services/analyticsService';

const renderPage = () => render(React.createElement(
  MemoryRouter,
  { initialEntries: ['/create-trip/labs/journey-view'] },
  React.createElement(JourneyOverviewLabPage),
));

afterEach(() => {
  cleanup();
  vi.mocked(trackEvent).mockClear();
});

describe('pages/JourneyOverviewLabPage', () => {
  it('switches between three isolated concepts while keeping the selected chapter', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByTestId('journey-concept-lens')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);

    const chiangMaiButtons = screen.getAllByRole('button', { name: /Chiang Mai, 4 nights/i });
    await user.click(chiangMaiButtons[0]!);
    expect(chiangMaiButtons.some((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith(
      'journey_lab__chapter--select',
      expect.objectContaining({ chapter: 'th-chiang-mai', concept: 'lens' }),
    );

    await user.click(screen.getByRole('tab', { name: /journeyLab\.concepts\.storyboard\.title/i }));
    expect(screen.getByTestId('journey-concept-storyboard')).toBeInTheDocument();
    const selectedStory = screen.getByText('Chiang Mai', { selector: 'h3' }).closest('article');
    expect(selectedStory).toHaveAttribute('data-selected', 'true');

    await user.click(screen.getByRole('tab', { name: /journeyLab\.concepts\.inspector\.title/i }));
    expect(screen.getByTestId('journey-concept-inspector')).toBeInTheDocument();
    expect(screen.getByText('Chiang Mai', { selector: 'h3' })).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('journey_lab__concept--select', { concept: 'inspector' });
  });

  it('lets a transfer become the shared focus and exposes route evidence', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: /Bangkok to Chiang Mai/i })[0]!);
    expect(screen.getByText('journeyLab.transfer.duration')).toBeInTheDocument();
    expect(screen.getByText('2026.07.18-v9')).toBeInTheDocument();
    expect(screen.getByText('th-first-timer-bangkok-north-beach')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith(
      'journey_lab__transfer--select',
      expect.objectContaining({ concept: 'lens' }),
    );
  });
});
