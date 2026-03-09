// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CountryInfo } from '../../components/CountryInfo';

describe('components/CountryInfo', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates converter controls from persisted storage values', async () => {
    window.localStorage.setItem('tf_country_amount', '5');
    window.localStorage.setItem('tf_country_dir', 'localToEur');

    render(
      <CountryInfo
        info={{
          currencyCode: 'USD',
          exchangeRate: 2,
          languages: ['English'],
        }}
      />,
    );

    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Swap conversion direction'));

    await waitFor(() => {
      expect(window.localStorage.getItem('tf_country_dir')).toBe('eurToLocal');
    });
  });

  it('falls back to defaults for invalid persisted values', async () => {
    window.localStorage.setItem('tf_country_amount', 'not-a-number');
    window.localStorage.setItem('tf_country_dir', 'invalid-direction');

    render(
      <CountryInfo
        info={{
          currencyCode: 'USD',
          exchangeRate: 2,
          languages: ['English'],
        }}
      />,
    );

    expect(screen.getByDisplayValue('1')).toBeInTheDocument();

    await waitFor(() => {
      expect(window.localStorage.getItem('tf_country_amount')).toBe('1');
      expect(window.localStorage.getItem('tf_country_dir')).toBe('eurToLocal');
    });
  });
});
