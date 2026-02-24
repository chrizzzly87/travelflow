// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ImprintPage } from '../../../pages/legal/ImpressumPage';

describe('pages/legal/ImpressumPage', () => {
  it('shows the primary contact email and additional info email', () => {
    render(<ImprintPage />);

    expect(screen.getByRole('link', { name: 'contact@wizz.art' }).getAttribute('href')).toBe('mailto:contact@wizz.art');
    expect(screen.getByRole('link', { name: 'info@wizz.air' }).getAttribute('href')).toBe('mailto:info@wizz.air');
  });
});
