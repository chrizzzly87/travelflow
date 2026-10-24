// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AdminAreaChart,
    AdminBarChart,
    AdminBarList,
    type AdminChartTooltipProps,
    AdminDonutChart,
} from '../../../components/admin/charts';

// recharts' ResponsiveContainer measures its parent; jsdom has no layout, so give
// every element a fixed box and deliver one resize observation per target.
const CHART_BOX = { width: 600, height: 300, x: 0, y: 0, top: 0, left: 0, bottom: 300, right: 600, toJSON() {} };
let pendingObservations: Array<() => void> = [];

beforeEach(() => {
    pendingObservations = [];
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(CHART_BOX as DOMRect);
    vi.stubGlobal('ResizeObserver', class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element) {
            pendingObservations.push(() => this.callback(
                [{ target, contentRect: { width: CHART_BOX.width, height: CHART_BOX.height } } as ResizeObserverEntry],
                this as unknown as ResizeObserver,
            ));
        }
        unobserve() {}
        disconnect() {}
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const flushResize = async () => {
    await act(async () => {
        pendingObservations.forEach((observe) => observe());
    });
};

const trendData = [
    { date: '01.10', 'New users': 3, 'New trips': 5 },
    { date: '02.10', 'New users': 4, 'New trips': 1 },
    { date: '03.10', 'New users': 0, 'New trips': 7 },
];

describe('AdminBarChart', () => {
    it('renders one bar series per category with a legend and an accessible data summary', async () => {
        const view = render(
            <AdminBarChart
                ariaLabel="New users vs new trips"
                data={trendData}
                index="date"
                categories={['New users', 'New trips']}
                colors={['indigo', 'emerald']}
                stack
                valueFormatter={(value) => `${value} items`}
            />,
        );
        await flushResize();

        const figure = screen.getByRole('figure', { name: 'New users vs new trips' });
        await waitFor(() => expect(figure.querySelectorAll('.recharts-bar')).toHaveLength(2));
        expect(figure.querySelectorAll('.recharts-bar-rectangle').length).toBeGreaterThan(0);

        const fills = Array.from(figure.querySelectorAll('.recharts-bar-rectangle path')).map((node) => node.getAttribute('fill'));
        expect(fills).toContain('var(--admin-chart-indigo)');
        expect(fills).toContain('var(--admin-chart-emerald)');

        const legend = view.container.querySelector('[data-admin-chart-legend]') as HTMLElement;
        expect(within(legend).getByText('New users')).toBeInTheDocument();
        expect(within(legend).getByText('New trips')).toBeInTheDocument();

        const table = within(figure).getByRole('table', { name: 'New users vs new trips' });
        const row = within(table).getByRole('row', { name: /02\.10/ });
        expect(within(row).getByText('4 items')).toBeInTheDocument();
        expect(within(row).getByText('1 items')).toBeInTheDocument();
    });

    it('moves the tooltip between columns with the keyboard and formats its values', async () => {
        render(
            <AdminBarChart
                ariaLabel="Call trend"
                data={trendData}
                index="date"
                categories={['New users', 'New trips']}
                valueFormatter={(value) => `${value} calls`}
            />,
        );
        await flushResize();

        const figure = screen.getByRole('figure', { name: 'Call trend' });
        const surface = await waitFor(() => {
            const node = figure.querySelector('[role="application"]');
            expect(node).not.toBeNull();
            return node as HTMLElement;
        });
        expect(surface.getAttribute('tabindex')).toBe('0');

        act(() => surface.focus());
        fireEvent.keyDown(surface, { key: 'ArrowRight' });

        const tooltip = await waitFor(() => {
            const node = document.querySelector('[data-admin-chart-tooltip]');
            expect(node).not.toBeNull();
            return node as HTMLElement;
        });
        // The first arrow press steps from the initial column to the second one.
        expect(within(tooltip).getByText('02.10')).toBeInTheDocument();
        expect(within(tooltip).getByText('New users')).toBeInTheDocument();
        expect(within(tooltip).getByText('4 calls')).toBeInTheDocument();
        expect(within(tooltip).getByText('1 calls')).toBeInTheDocument();
        expect(tooltip.className).toContain('dark:shadow-none');
        expect(tooltip.className).toContain('bg-popover');
    });

    it('renders an empty plot without series or data rows', async () => {
        render(<AdminBarChart ariaLabel="Empty chart" data={[]} index="date" categories={['Trips']} />);
        await flushResize();

        const figure = screen.getByRole('figure', { name: 'Empty chart' });
        expect(figure.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(0);
        expect(within(figure).getByRole('table', { name: 'Empty chart' }).querySelectorAll('tbody tr')).toHaveLength(0);
    });

    it('hides the legend when asked to', async () => {
        const view = render(
            <AdminBarChart ariaLabel="Cost per day" data={trendData} index="date" categories={['New trips']} showLegend={false} />,
        );
        await flushResize();
        expect(view.container.querySelector('[data-admin-chart-legend]')).toBeNull();
    });
});

describe('AdminAreaChart', () => {
    it('renders an area per category and passes normalised entries to a custom tooltip', async () => {
        const seen: AdminChartTooltipProps[] = [];
        const CustomTooltip: React.FC<AdminChartTooltipProps> = (props) => {
            seen.push(props);
            if (!props.active) return null;
            return <div data-testid="custom-tooltip">{props.payload.map((entry) => `${entry.name}=${String(entry.value)}@${String(entry.payload?.date)}`).join(',')}</div>;
        };

        render(
            <AdminAreaChart
                ariaLabel="Success-rate trend"
                data={trendData}
                index="date"
                categories={['New trips']}
                colors={['violet']}
                minValue={0}
                maxValue={100}
                connectNulls
                customTooltip={CustomTooltip}
            />,
        );
        await flushResize();

        const figure = screen.getByRole('figure', { name: 'Success-rate trend' });
        await waitFor(() => expect(figure.querySelectorAll('.recharts-area')).toHaveLength(1));
        expect(figure.querySelector('.recharts-area-curve')?.getAttribute('stroke')).toBe('var(--admin-chart-violet)');

        const surface = figure.querySelector('[role="application"]') as HTMLElement;
        act(() => surface.focus());
        fireEvent.keyDown(surface, { key: 'ArrowRight' });

        const tooltip = await screen.findByTestId('custom-tooltip');
        expect(tooltip.textContent).toMatch(/^New trips=\d+@0[1-3]\.10$/);
    });
});

describe('AdminDonutChart', () => {
    const mix = [
        { tier: 'Explorer', count: 6, provider: 'openai' },
        { tier: 'Globetrotter', count: 2, provider: 'anthropic' },
    ];

    it('shows the formatted total in the centre by default and a custom label when given', async () => {
        const view = render(
            <AdminDonutChart ariaLabel="Subscription mix" data={mix} index="tier" category="count" valueFormatter={(value) => `${value} subs`} />,
        );
        await flushResize();

        const figure = screen.getByRole('figure', { name: 'Subscription mix' });
        expect(figure.querySelector('[data-admin-chart-center-label]')?.textContent).toBe('8 subs');
        await waitFor(() => expect(figure.querySelectorAll('.recharts-pie-sector')).toHaveLength(2));
        const table = within(figure).getByRole('table', { name: 'Subscription mix' });
        expect(within(table).getByText('6 subs')).toBeInTheDocument();

        view.rerender(
            <AdminDonutChart ariaLabel="Subscription mix" data={mix} index="tier" category="count" label="Providers" />,
        );
        expect(figure.querySelector('[data-admin-chart-center-label]')?.textContent).toBe('Providers');
    });

    it('reports the clicked slice row and clears it on a second click', async () => {
        const onValueChange = vi.fn();
        render(
            <AdminDonutChart
                ariaLabel="Provider share"
                data={mix}
                index="tier"
                category="count"
                colors={['blue', 'rose']}
                onValueChange={onValueChange}
            />,
        );
        await flushResize();

        const figure = screen.getByRole('figure', { name: 'Provider share' });
        const sectors = await waitFor(() => {
            const nodes = figure.querySelectorAll('.recharts-pie-sector path');
            expect(nodes).toHaveLength(2);
            return nodes;
        });
        expect(sectors[0].getAttribute('fill')).toBe('var(--admin-chart-blue)');
        expect(sectors[1].getAttribute('fill')).toBe('var(--admin-chart-rose)');

        fireEvent.click(sectors[1]);
        expect(onValueChange).toHaveBeenLastCalledWith(expect.objectContaining({ tier: 'Globetrotter', provider: 'anthropic' }));

        const dimmed = await waitFor(() => {
            const node = figure.querySelectorAll('.recharts-pie-sector path')[0];
            expect(node.getAttribute('fill-opacity')).toBe('0.3');
            return node;
        });
        expect(dimmed).toBeTruthy();

        fireEvent.click(figure.querySelectorAll('.recharts-pie-sector path')[1]);
        expect(onValueChange).toHaveBeenLastCalledWith(null);
    });
});

describe('AdminBarList', () => {
    const items = [
        { key: 'fast', name: 'Fast model', value: 120 },
        { key: 'slow', name: 'Slow model', value: 900 },
        { key: 'mid', name: 'Mid model', value: 400 },
    ];

    it('sorts rows, formats values and sizes bars relative to the largest value', () => {
        render(<AdminBarList ariaLabel="Top models by speed" data={items} sortOrder="ascending" valueFormatter={(value) => `${value} ms`} color="rose" />);

        const list = screen.getByRole('list', { name: 'Top models by speed' });
        const rows = within(list).getAllByRole('listitem');
        expect(rows.map((row) => row.textContent)).toEqual(['Fast model120 ms', 'Mid model400 ms', 'Slow model900 ms']);

        const bars = Array.from(list.querySelectorAll<HTMLElement>('[data-admin-bar-list-bar]'));
        expect(bars[2].style.width).toBe('100%');
        expect(bars[0].style.width).toMatch(/^13\.3/);
        expect(bars[0].style.backgroundColor).toBe('var(--admin-chart-rose)');
        expect(bars[0].className).toContain('dark:opacity-40');
        expect(within(list).queryByRole('button')).toBeNull();
    });

    it('makes rows keyboard-selectable when a selection handler is given', async () => {
        const onValueChange = vi.fn();
        const user = userEvent.setup();
        render(<AdminBarList ariaLabel="Failure codes" data={items} onValueChange={onValueChange} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons.map((button) => button.textContent)).toEqual(['Slow model900', 'Mid model400', 'Fast model120']);

        await user.tab();
        expect(buttons[0]).toHaveFocus();
        await user.keyboard('{Enter}');
        expect(onValueChange).toHaveBeenCalledWith(expect.objectContaining({ key: 'slow', value: 900 }));
    });

    it('renders an empty list without rows', () => {
        render(<AdminBarList ariaLabel="Nothing yet" data={[]} />);
        expect(within(screen.getByRole('list', { name: 'Nothing yet' })).queryAllByRole('listitem')).toHaveLength(0);
    });
});
