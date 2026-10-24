// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ChartContainer, ChartTooltipContent, chartColor, type ChartConfig } from '../../../components/ui/chart';
import { AdminBarChart } from '../../../components/admin/AdminBarChart';

const h = React.createElement;

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer and cmdk both observe size.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const config: ChartConfig = {
  'New users': { label: 'New users', color: 'var(--chart-1)' },
  trips: { label: 'Trips', theme: { light: '#111111', dark: '#eeeeee' } },
};

describe('components/ui/chart', () => {
  it('exposes each series colour as a custom property scoped to the chart', () => {
    const { container } = render(h(ChartContainer, { config, id: 'demo' }, h('div')));

    const chart = container.querySelector('[data-slot="chart"]');
    expect(chart?.getAttribute('data-chart')).toBe('chart-demo');
    const css = container.querySelector('style')?.innerHTML ?? '';
    expect(css).toContain('[data-chart=chart-demo]');
    // A label with a space becomes a valid custom property name.
    expect(css).toContain('--color-New-users: var(--chart-1);');
    expect(css).toContain('.dark [data-chart=chart-demo]');
    expect(css).toContain('--color-trips: #eeeeee;');
  });

  it('builds the matching var() for a series key', () => {
    expect(chartColor('New users')).toBe('var(--color-New-users)');
  });

  it('renders tooltip rows with configured labels and formatted values', () => {
    render(h(ChartContainer, { config },
      h(ChartTooltipContent, {
        active: true,
        label: '2026-10-01',
        valueFormatter: (value: number | string) => `${value} total`,
        payload: [
          { name: 'New users', dataKey: 'New users', value: 4, color: 'red' },
          { name: 'trips', dataKey: 'trips', value: 2, color: 'blue' },
        ],
      })));

    expect(screen.getByText('2026-10-01')).toBeTruthy();
    expect(screen.getByText('Trips')).toBeTruthy();
    expect(screen.getByText('4 total')).toBeTruthy();
    expect(screen.getByText('2 total')).toBeTruthy();
  });

  it('renders nothing for an inactive tooltip', () => {
    const { container } = render(h(ChartContainer, { config }, h(ChartTooltipContent, { active: false, payload: [] })));
    expect(container.querySelector('.grid')).toBeNull();
  });
});

describe('AdminBarChart', () => {
  it('labels the chart for assistive tech and assigns palette colours in order', () => {
    const { container } = render(h(AdminBarChart, {
      data: [{ date: '2026-10-01', 'Active trips': 2, 'Expired trips': 1 }],
      index: 'date',
      categories: ['Active trips', 'Expired trips'],
      stacked: true,
      ariaLabel: 'Trips by status',
    }));

    expect(screen.getByRole('img', { name: 'Trips by status' })).toBeTruthy();
    const css = container.querySelector('style')?.innerHTML ?? '';
    expect(css).toContain('--color-Active-trips: var(--chart-1);');
    expect(css).toContain('--color-Expired-trips: var(--chart-2);');
  });

  it('honours per-series colour overrides', () => {
    const { container } = render(h(AdminBarChart, {
      data: [],
      index: 'date',
      categories: ['Archived trips'],
      colors: { 'Archived trips': 'var(--chart-4)' },
    }));

    expect(container.querySelector('style')?.innerHTML ?? '').toContain('--color-Archived-trips: var(--chart-4);');
  });
});
