// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RenderClockProvider, useRenderNow, utcFieldsAsLocalDate } from '../../hooks/useRenderNow';

function DateText() {
    const now = useRenderNow();
    return <p>{`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`}</p>;
}

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('render clock', () => {
    it('hydrates date text from the document stamp, then shows the visitor date', async () => {
        // Rendered at 23:30 UTC on New Year's Eve; in Berlin it is already 2027.
        const renderedAt = Date.UTC(2026, 11, 31, 23, 30);
        const html = renderToString(<RenderClockProvider renderedAt={renderedAt}><DateText /></RenderClockProvider>);
        expect(html).toContain('2026-12-31');

        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(Date.UTC(2027, 0, 1, 0, 30)));
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);
        const recoverable: unknown[] = [];
        await act(async () => {
            hydrateRoot(container, <RenderClockProvider renderedAt={renderedAt}><DateText /></RenderClockProvider>, { onRecoverableError: error => recoverable.push(error) });
        });
        expect(recoverable).toEqual([]);
        expect(container.textContent).toBe('2027-1-1');
    });

    it('reads the stamp in UTC whatever the local time zone', () => {
        const date = utcFieldsAsLocalDate(Date.UTC(2026, 9, 24, 22, 1, 6));
        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 9, 24, 22, 1]);
    });

    it('uses the browser clock when nothing was transported', () => {
        let rendered: Date | undefined;
        function Probe() { rendered = useRenderNow(); return null; }
        const before = Date.now();
        const container = document.createElement('div');
        document.body.appendChild(container);
        act(() => { hydrateRoot(container, <RenderClockProvider renderedAt={undefined}><Probe /></RenderClockProvider>); });
        expect(rendered!.getTime()).toBeGreaterThanOrEqual(before - 1);
    });
});
