// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

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

const ContactStateProbe: React.FC = () => {
  const location = useLocation();
  return <pre data-testid="contact-state">{JSON.stringify(location.state || null)}</pre>;
};

describe('components/marketing/TranslationNoticeBanner', () => {
  it('navigates to contact with prefilled reason/topic state', async () => {
    render(
      <MemoryRouter initialEntries={['/de/features']}>
        <Routes>
          <Route path="/de/features" element={<TranslationNoticeBanner />} />
          <Route path="/de/contact" element={<ContactStateProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link'));

    await waitFor(() => {
      expect(screen.getByTestId('contact-state')).toHaveTextContent('"reason":"bug_report"');
    });
    expect(screen.getByTestId('contact-state')).toHaveTextContent('"subReason":"translation_wrong_misleading"');
    expect(screen.getByTestId('contact-state')).toHaveTextContent('"source":"translation_notice_banner"');
    expect(trackEventMock).toHaveBeenCalledWith('i18n_notice__contact', expect.objectContaining({
      reason: 'bug_report',
      sub_reason: 'translation_wrong_misleading',
      source: 'translation_notice_banner',
    }));
  });
});
