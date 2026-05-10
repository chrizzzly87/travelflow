// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  return React.createElement('output', {
    'data-testid': 'contact-state',
    'data-state': JSON.stringify(location.state),
  }, location.search);
};

describe('components/marketing/TranslationNoticeBanner', () => {
  it('links to contact with Router state and prefilled query params', async () => {
    render(
      <MemoryRouter initialEntries={['/de/features']}>
        <Routes>
          <Route path="/de/features" element={<TranslationNoticeBanner />} />
          <Route path="/de/contact" element={<ContactStateProbe />} />
        </Routes>
      </MemoryRouter>
    );

    const contactLink = screen.getByRole('link');
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('/de/contact?'));
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('reason=bug_report'));
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('subReason=translation_wrong_misleading'));
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('source=translation_notice_banner'));

    fireEvent.click(contactLink);

    expect(screen.getByTestId('contact-state')).toHaveTextContent('reason=bug_report');
    expect(screen.getByTestId('contact-state')).toHaveAttribute('data-state', JSON.stringify({
      reason: 'bug_report',
      subReason: 'translation_wrong_misleading',
      source: 'translation_notice_banner',
    }));
    expect(trackEventMock).toHaveBeenCalledWith('i18n_notice__contact', expect.objectContaining({
      reason: 'bug_report',
      sub_reason: 'translation_wrong_misleading',
      source: 'translation_notice_banner',
    }));
  });
});
