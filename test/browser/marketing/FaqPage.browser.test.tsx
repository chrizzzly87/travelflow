// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const trackEventMock = vi.fn();

vi.mock('../../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

import { FaqPage } from '../../../pages/FaqPage';

describe('pages/FaqPage', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const previousScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const scrollIntoViewSpy = vi.fn();

  beforeEach(() => {
    trackEventMock.mockReset();
    scrollIntoViewSpy.mockReset();

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    cleanup();
    window.requestAnimationFrame = originalRequestAnimationFrame;
    if (previousScrollIntoViewDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previousScrollIntoViewDescriptor);
    } else {
      delete (HTMLElement.prototype as HTMLElement & { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('opens and scrolls to a deep-linked FAQ item from hash', async () => {
    render(
      <MemoryRouter initialEntries={['/faq#general-report-translation-issue']}>
        <FaqPage />
      </MemoryRouter>
    );

    const deepLinkedItem = screen.getByRole('button', { name: 'How do I report translation issues?' });
    expect(deepLinkedItem).toHaveAttribute('aria-expanded', 'true');

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled();
    });

    expect(trackEventMock).toHaveBeenCalledWith('faq__item--open', expect.objectContaining({
      item_id: 'general-report-translation-issue',
      source: 'hash',
    }));
  });

  it('tracks section link clicks and FAQ item toggles', () => {
    render(
      <MemoryRouter initialEntries={['/faq']}>
        <FaqPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('link', { name: 'Billing' })[0]);
    expect(trackEventMock).toHaveBeenCalledWith('faq__section_link', expect.objectContaining({
      section_id: 'billing',
      source: 'toc',
    }));

    const itemButton = screen.getByRole('button', { name: 'How do I report translation issues?' });
    fireEvent.click(itemButton);

    expect(trackEventMock).toHaveBeenCalledWith('faq__item--open', expect.objectContaining({
      item_id: 'general-report-translation-issue',
      section_id: 'general',
      source: 'faq_page',
    }));

    fireEvent.click(itemButton);
    expect(trackEventMock).toHaveBeenCalledWith('faq__item--close', expect.objectContaining({
      item_id: 'general-report-translation-issue',
      section_id: 'general',
      source: 'faq_page',
    }));
  });
});
