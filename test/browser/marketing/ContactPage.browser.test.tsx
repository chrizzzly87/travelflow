// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const useAuthMock = vi.fn();
const getCurrentAccessContextMock = vi.fn();
const getCurrentUserProfileMock = vi.fn();
const trackEventMock = vi.fn();

const translations: Record<string, string> = {
  'contact.emailValue': 'contact@wizz.art',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = translations[key] || key;
      if (!options) return template;
      return Object.entries(options).reduce((value, [token, next]) => value.replaceAll(`{${token}}`, String(next)), template);
    },
  }),
}));

vi.mock('../../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/ui/select', async () => {
  const React = await import('react');

  const SelectContext = React.createContext<{ onValueChange?: (value: string) => void }>({});

  const Select = ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (value: string) => void }) => (
    <SelectContext.Provider value={{ onValueChange }}>{children}</SelectContext.Provider>
  );

  const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>((props, ref) => (
    <button type="button" ref={ref} {...props} />
  ));

  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder || 'value'}</span>;
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const context = React.useContext(SelectContext);
    return (
      <button type="button" onClick={() => context.onValueChange?.(value)}>
        {children}
      </button>
    );
  };

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../services/authService', () => ({
  getCurrentAccessContext: () => getCurrentAccessContextMock(),
}));

vi.mock('../../../services/profileService', () => ({
  getCurrentUserProfile: () => getCurrentUserProfileMock(),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

import { ContactPage } from '../../../pages/ContactPage';

const renderContactPage = () => render(
  <MemoryRouter initialEntries={['/contact']}>
    <ContactPage />
  </MemoryRouter>
);

describe('pages/ContactPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    getCurrentAccessContextMock.mockReset();
    getCurrentUserProfileMock.mockReset();
    trackEventMock.mockReset();

    useAuthMock.mockReturnValue({ access: null });
    getCurrentAccessContextMock.mockResolvedValue({
      userId: null,
      email: null,
      isAnonymous: true,
      tierKey: 'tier_free',
    });
    getCurrentUserProfileMock.mockResolvedValue(null);

    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders required form fields and hidden netlify fields', () => {
    renderContactPage();

    expect(screen.getByText('contact.title')).toBeInTheDocument();
    expect(screen.getByLabelText('contact.form.nameLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('contact.form.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('contact.form.messageLabel')).toBeInTheDocument();

    const hiddenFormName = document.querySelector('input[name="form-name"]') as HTMLInputElement | null;
    expect(hiddenFormName?.value).toBe('contact');

    const primaryEmail = screen.getByText('contact@wizz.art');
    expect(primaryEmail.closest('a')?.getAttribute('href')).toBe('mailto:contact@wizz.art');
  });

  it('prefills name and email for authenticated users', async () => {
    useAuthMock.mockReturnValue({
      access: {
        userId: 'user-123',
        email: 'prefilled@example.com',
        isAnonymous: false,
        tierKey: 'tier_mid',
      },
    });
    getCurrentAccessContextMock.mockResolvedValue({
      userId: 'user-123',
      email: 'prefilled@example.com',
      isAnonymous: false,
      tierKey: 'tier_mid',
    });
    getCurrentUserProfileMock.mockResolvedValue({
      displayName: 'Casey Rivera',
      firstName: 'Casey',
      lastName: 'Rivera',
    });

    renderContactPage();

    await waitFor(() => {
      expect((screen.getByLabelText('contact.form.emailLabel') as HTMLInputElement).value).toBe('prefilled@example.com');
    });

    expect((screen.getByLabelText('contact.form.nameLabel') as HTMLInputElement).value).toBe('Casey Rivera');
  });

  it('submits successfully and tracks submit + success events', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });

    renderContactPage();

    fireEvent.click(screen.getAllByText('contact.form.reasonOptions.bugReport')[0]);
    fireEvent.change(screen.getByLabelText('contact.form.emailLabel'), { target: { value: 'hello@example.com' } });
    fireEvent.change(screen.getByLabelText('contact.form.messageLabel'), { target: { value: 'Need help with a bug.' } });

    fireEvent.click(screen.getByRole('button', { name: 'contact.form.submit' }));

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith('contact__form--submit', expect.objectContaining({ reason: 'bug_report' }));
      expect(trackEventMock).toHaveBeenCalledWith('contact__form--success', expect.objectContaining({ status: 200 }));
    });

    expect(screen.getByText('contact.form.successTitle')).toBeInTheDocument();
  });

  it('shows fallback mailto on failed submit and tracks failure + fallback click', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429 });

    renderContactPage();

    fireEvent.click(screen.getAllByText('contact.form.reasonOptions.partnership')[0]);
    fireEvent.change(screen.getByLabelText('contact.form.emailLabel'), { target: { value: 'partner@example.com' } });
    fireEvent.change(screen.getByLabelText('contact.form.messageLabel'), { target: { value: 'Partnership request.' } });

    fireEvent.click(screen.getByRole('button', { name: 'contact.form.submit' }));

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith('contact__form--failed', expect.objectContaining({ status: 429 }));
    });

    const fallbackLink = screen.getByRole('link', { name: 'contact.form.fallbackCta' });
    expect(fallbackLink.getAttribute('href')).toBe('mailto:contact@wizz.art');

    fireEvent.click(fallbackLink);
    expect(trackEventMock).toHaveBeenCalledWith('contact__fallback--email', expect.objectContaining({ status: 429 }));
  });

  it('handles thrown network errors without crashing', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));

    renderContactPage();

    fireEvent.click(screen.getAllByText('contact.form.reasonOptions.other')[0]);
    fireEvent.change(screen.getByLabelText('contact.form.emailLabel'), { target: { value: 'hello@example.com' } });
    fireEvent.change(screen.getByLabelText('contact.form.messageLabel'), { target: { value: 'Network failure repro.' } });

    fireEvent.click(screen.getByRole('button', { name: 'contact.form.submit' }));

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith(
        'contact__form--failed',
        expect.objectContaining({ error_type: 'network_error' })
      );
    });

    expect(screen.getByText('contact.form.errorTitle')).toBeInTheDocument();
  });
});
