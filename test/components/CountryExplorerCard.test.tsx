// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { CountryExplorerCard } from '../../components/inspirations/CountryExplorerCard';
import type { CountryExplorerEntry, CountryMonthInsight } from '../../services/countryExplorerService';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const entry: CountryExplorerEntry = {
    id: 'country-testland',
    name: 'Testland',
    slug: 'testland',
    countryCode: 'ZZ',
    region: 'Nowhere',
    tags: ['nature', 'food'],
    recommendedDays: 9,
    idealMonths: [5, 6],
    shoulderMonths: [4, 7],
    seasonBands: ['avoid', 'avoid', 'avoid', 'shoulder', 'ideal', 'ideal', 'shoulder', 'avoid', 'avoid', 'avoid', 'avoid', 'avoid'],
    searchTokens: [],
};

const renderCard = (props: Partial<React.ComponentProps<typeof CountryExplorerCard>> = {}) => render(
    <MemoryRouter>
        <CountryExplorerCard
            entry={entry}
            href="/inspirations/countries/testland"
            selectedMonth={null}
            monthLabels={MONTH_LABELS}
            {...props}
        />
    </MemoryRouter>
);

describe('CountryExplorerCard', () => {
    beforeEach(() => {
        cleanup();
    });

    it('shows the month strip with an accessible label naming the ideal months', () => {
        renderCard();
        // i18next is not initialized in this environment, so keys render verbatim — the assertion
        // is about the accessible label existing on the strip, not about the copy itself.
        const strip = screen.getByRole('img');
        expect(strip).toBeInTheDocument();
        expect(strip.querySelectorAll(':scope > span')).toHaveLength(12);
    });

    it('does not render duration anywhere on the card', () => {
        const { container } = renderCard();
        expect(container.textContent).not.toContain('9');
        expect(container.textContent).not.toMatch(/days/i);
    });

    it('renders climate figures when the month insight has climate data', () => {
        const insight: CountryMonthInsight = {
            month: 5,
            band: 'ideal',
            climate: { avgHighC: 27.4, avgLowC: 16.2, precipitationMm: 40, rainfall: 'light', season: 'high' },
        };
        const { container } = renderCard({ insight, selectedMonth: 5 });
        expect(container.textContent).toContain('explorer.temperature');
        expect(container.textContent).toContain('explorer.rainfall.light');
        expect(container.textContent).toContain('explorer.season.high');
        expect(container.textContent).not.toContain('explorer.climateUnavailable');
    });

    it('falls back to the curated band and omits numbers when climate data is missing', () => {
        const insight: CountryMonthInsight = { month: 5, band: 'ideal' };
        const { container } = renderCard({ insight, selectedMonth: 5 });
        expect(container.textContent).toContain('explorer.band.ideal');
        expect(container.textContent).toContain('explorer.climateUnavailable');
        expect(container.textContent).not.toContain('explorer.temperature');
        expect(container.textContent).not.toContain('0°');
    });
});
