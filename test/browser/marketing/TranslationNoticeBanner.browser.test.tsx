// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const trackEventMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

import { TranslationNoticeBanner } from '../../../components/marketing/TranslationNoticeBanner';

describe('components/marketing/TranslationNoticeBanner', () => {
  it('links to contact with prefilled reason/topic query params', async () => {
    render(
      <MemoryRouter initialEntries={['/de/features']}>
        <Routes>
          <Route path="/de/features" element={<TranslationNoticeBanner />} />
        </Routes>
      </MemoryRouter>
    );

    const contactLink = screen.getByRole('link');
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('/de/contact?'));
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('reason=bug_report'));
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('subReason=translation_wrong_misleading'));
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('source=translation_notice_banner'));

    contactLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(contactLink);

    expect(trackEventMock).toHaveBeenCalledWith('i18n_notice__contact', expect.objectContaining({
      reason: 'bug_report',
      sub_reason: 'translation_wrong_misleading',
      source: 'translation_notice_banner',
    }));
  });
});
