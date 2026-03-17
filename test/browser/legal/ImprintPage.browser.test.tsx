// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import i18n, { preloadLocaleNamespaces } from '../../../i18n';
import { ImprintPage } from '../../../pages/legal/ImpressumPage';

const renderImprint = async (language: 'de' | 'en', initialEntry: string) => {
  await preloadLocaleNamespaces(language, ['legal']);
  await i18n.changeLanguage(language);

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ImprintPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

describe('pages/legal/ImpressumPage', () => {
  beforeEach(async () => {
    cleanup();
    await preloadLocaleNamespaces('de', ['legal']);
    await preloadLocaleNamespaces('en', ['legal']);
  });

  it('shows the simple sole-proprietor identity and direct contact links', async () => {
    await renderImprint('de', '/de/imprint');

    expect(screen.getAllByText('Christian Wisniewski').length).toBeGreaterThan(0);
    expect(screen.getByText('Geschäftsbezeichnung')).toBeInTheDocument();
    expect(screen.getByText('WizzArt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contact@wizz.art' }).getAttribute('href')).toBe('mailto:contact@wizz.art');
    expect(screen.queryByRole('link', { name: 'info@wizz.air' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Kontaktseite' }).getAttribute('href')).toBe('/de/contact');
  });

  it('renders the statutory German VAT disclosure from locale resources', async () => {
    await renderImprint('de', '/de/imprint');

    expect(screen.getByText('Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:')).toBeInTheDocument();
    expect(screen.getByText('DE460717456')).toBeInTheDocument();
  });

  it('renders the english VAT disclosure from locale resources', async () => {
    await renderImprint('en', '/imprint');

    expect(screen.getByText('VAT Identification Number according to § 27a German VAT Act:')).toBeInTheDocument();
    expect(screen.getByText('DE460717456')).toBeInTheDocument();
  });
});
