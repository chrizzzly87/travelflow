// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { EarlyAccessBanner } from '../../../components/marketing/EarlyAccessBanner';

describe('components/marketing/EarlyAccessBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    trackEventMock.mockReset();
  });

  it('does not render when previously dismissed', () => {
    window.localStorage.setItem('tf_early_access_dismissed', '1');
    render(<EarlyAccessBanner />);
    expect(screen.queryByLabelText('earlyAccess.dismiss')).toBeNull();
  });

  it('persists dismissal and tracks analytics event', () => {
    render(<EarlyAccessBanner />);

    const dismissButton = screen.getByLabelText('earlyAccess.dismiss');
    fireEvent.click(dismissButton);

    expect(trackEventMock).toHaveBeenCalledWith('banner__early_access--dismiss');
    expect(window.localStorage.getItem('tf_early_access_dismissed')).toBe('1');
    expect(screen.queryByLabelText('earlyAccess.dismiss')).toBeNull();
  });
});
