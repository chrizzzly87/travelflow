// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AreaChart, BarChart, BarList, DonutChart } from '@tremor/react';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('renders the actual admin chart library and preserves its list selection under React 19', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 600, height: 300, x: 0, y: 0, top: 0, left: 0, bottom: 300, right: 600, toJSON() {} });
    const observations: Array<() => void> = [];
    vi.stubGlobal('ResizeObserver', class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(target: Element) { observations.push(() => this.callback([{ target, contentRect: { width: 600, height: 300 } } as ResizeObserverEntry], this as unknown as ResizeObserver)); }
        unobserve() {}
        disconnect() {}
    });
    const select = vi.fn();
    const data = [{ date: 'Today', Trips: 12 }, { date: 'Tomorrow', Trips: 18 }];
    const view = render(<>
        <BarChart data={data} index="date" categories={['Trips']} />
        <AreaChart data={data} index="date" categories={['Trips']} />
        <DonutChart data={[{ name: 'Active', value: 12 }, { name: 'Archived', value: 3 }]} />
        <BarList data={[{ name: 'Active trips', value: 12 }]} onValueChange={select} />
    </>);
    await act(async () => { observations.forEach(observe => observe()); });
    await waitFor(() => expect(view.container.querySelectorAll('.recharts-surface')).toHaveLength(3));
    fireEvent.click(view.getByRole('button', { name: /Active trips/ }));
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ name: 'Active trips', value: 12 }));
});
