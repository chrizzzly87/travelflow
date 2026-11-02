// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Prism from 'prismjs';
import { MemoryRouter, useLocation } from '@/tests/helpers/routerHarness';
import type { ConfirmDialogOptions } from '../../../components/AppDialogProvider';
import { renderPrismTokens } from '../../../components/admin/ai-benchmark/prismJson';

// Configure and start a run, open it in the sheet, rate it and compare, against a mocked benchmark API.

const mocks = vi.hoisted(() => ({
    confirmDialog: vi.fn(async (_options: ConfirmDialogOptions): Promise<boolean> => true),
    trackEvent: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
    AdminShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
        React.createElement('div', null, React.createElement('h1', null, title), actions, children)
    ),
}));

vi.mock('../../../components/ui/drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? React.createElement('div', null, children) : null),
    DrawerContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', { role: 'dialog' }, children),
    DrawerTitle: ({ children }: { children: React.ReactNode }) => React.createElement('h2', null, children),
    DrawerClose: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../../components/AppDialogProvider', () => ({
    useAppDialog: () => ({ confirm: mocks.confirmDialog, prompt: vi.fn(async () => null) }),
}));

vi.mock('../../../hooks/useAuth', () => ({
    useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../../services/dbService', () => ({
    ensureDbSession: vi.fn(async () => undefined),
    dbGetAccessToken: vi.fn(async () => 'test-token'),
}));

vi.mock('../../../services/analyticsService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../services/analyticsService')>()),
    trackEvent: mocks.trackEvent,
}));

import { AdminAiBenchmarkPage } from '../../../pages/AdminAiBenchmarkPage';
import { DEFAULT_CREATE_TRIP_MODEL_ID } from '../../../config/aiModelCatalog';
import { ANALYTICS_DEBUG_EVENT_ATTR, ANALYTICS_DEBUG_PAYLOAD_ATTR } from '../../../services/analyticsService';

const SESSION = {
    id: 'session-1',
    share_token: 'share-abc',
    name: 'AI benchmark session',
    flow: 'classic',
    scenario: {},
    created_at: '2026-10-24T10:00:00.000Z',
    updated_at: '2026-10-24T10:00:00.000Z',
};

const [TARGET_PROVIDER, TARGET_MODEL] = DEFAULT_CREATE_TRIP_MODEL_ID.split(':');

const COMPLETED_RUN = {
    id: 'run-1',
    session_id: SESSION.id,
    provider: TARGET_PROVIDER,
    model: TARGET_MODEL,
    label: 'Default model',
    run_index: 1,
    status: 'completed',
    latency_ms: 2400,
    schema_valid: true,
    usage: { totalTokens: 1200 },
    cost_usd: 0.012,
    trip_id: 'trip-9',
    error_message: null,
    satisfaction_rating: null,
    run_comment: null,
    started_at: '2026-10-24T10:00:00.000Z',
    finished_at: '2026-10-24T10:00:02.400Z',
    created_at: '2026-10-24T10:00:00.000Z',
};

interface RecordedRequest {
    path: string;
    method: string;
    body: Record<string, unknown> | null;
    authorization: string | null;
}

let requests: RecordedRequest[] = [];

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method || 'GET';
    const headers = new Headers(init?.headers || {});
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    requests.push({ path, method, body, authorization: headers.get('Authorization') });

    if (path === '/api/internal/ai/benchmark/models') return json({ ok: true, models: [] });
    if (path === '/api/internal/ai/benchmark/preferences' && method === 'GET') {
        return json({ ok: true, preferences: { modelTargets: [DEFAULT_CREATE_TRIP_MODEL_ID] } });
    }
    if (path === '/api/internal/ai/benchmark/preferences') return json({ ok: true, preferences: body });
    if (path.startsWith('/api/internal/ai/benchmark/telemetry')) return json({ ok: true, rankings: {} });
    if (path === '/api/internal/ai/benchmark' && method === 'GET') return json({ ok: true, sessions: [] });
    if (path.startsWith('/api/internal/ai/benchmark?session=')) return json({ ok: true, session: SESSION, runs: [COMPLETED_RUN] });
    if (path === '/api/internal/ai/benchmark' && method === 'POST') return json({ ok: true, session: SESSION, runs: [COMPLETED_RUN] });
    if (path === '/api/internal/ai/benchmark/rating') {
        return json({ ok: true, run: { ...COMPLETED_RUN, satisfaction_rating: body?.rating ?? null } });
    }
    return json({ ok: false, error: 'unexpected' }, 500);
});

const LocationProbe = () => {
    const location = useLocation();
    return React.createElement('output', { 'data-testid': 'location-search' }, location.search);
};

const renderPage = (initialEntries: string[] = ['/admin/ai-benchmark']) => render(
    React.createElement(
        MemoryRouter,
        { initialEntries },
        React.createElement(AdminAiBenchmarkPage),
        React.createElement(LocationProbe),
    ),
);

const locationSearch = () => screen.getByTestId('location-search').textContent ?? '';

describe('pages/AdminAiBenchmarkPage flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requests = [];
        vi.stubGlobal('fetch', fetchMock);
        window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0);
            return 0;
        }) as typeof window.requestAnimationFrame;
        Element.prototype.scrollIntoView = vi.fn();
    });

    it('starts a run from setup, opens it in the sheet, rates it and compares it', async () => {
        const user = userEvent.setup();
        renderPage();

        // No session yet: the page opens on Setup with the saved model list.
        // The first render loads the whole page chunk; preferences then narrow the list to one model.
        const runButton = await screen.findByRole('button', { name: 'Run 1 model' }, { timeout: 8000 });
        await waitFor(() => expect(runButton).toHaveProperty('disabled', false));
        expect(screen.getByText('1 of 1 models active')).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Setup' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByText('Execution')).toBeTruthy();
        expect(runButton.getAttribute(ANALYTICS_DEBUG_EVENT_ATTR)).toBe('admin__ai_benchmark--run');
        expect(runButton.getAttribute(ANALYTICS_DEBUG_PAYLOAD_ATTR)).toBe('{"source":"header"}');

        await user.click(runButton);

        expect(mocks.trackEvent).toHaveBeenCalledWith('admin__ai_benchmark--run', { source: 'header', models: 1 });
        // The new session's link then reloads it, which clears the notice (as before the split).
        await waitFor(() => expect(locationSearch()).toBe('?session=share-abc'));

        const runRequest = requests.find((request) => request.path === '/api/internal/ai/benchmark' && request.method === 'POST');
        expect(runRequest?.authorization).toBe('Bearer test-token');
        expect(runRequest?.body).toMatchObject({
            sessionName: 'AI benchmark session',
            flow: 'classic',
            runCount: 1,
            concurrency: 2,
            timeoutMs: 60000,
        });
        expect(runRequest?.body?.targets).toEqual([
            expect.objectContaining({ provider: TARGET_PROVIDER, model: TARGET_MODEL }),
        ]);
        expect((runRequest?.body?.scenario as { input: { execution: unknown } }).input.execution)
            .toEqual({ timeoutSeconds: 60, compactOutput: true, reasoning: 'low' });

        // The run lands on the Runs tab.
        expect(screen.getByRole('tab', { name: /Runs/ }).getAttribute('aria-selected')).toBe('true');
        const openRun = await screen.findByRole('button', { name: 'Open run #1 of Default model' }, { timeout: 8000 });
        await user.click(openRun);
        expect(mocks.trackEvent).toHaveBeenCalledWith('admin__ai_benchmark--open_run', { source: 'model' });
        const sheet = await screen.findByRole('dialog');
        expect(within(sheet).getAllByText(/Run #1/).length).toBeGreaterThan(0);

        // Rate from the table; the sheet shows the same run.
        const [goodInTable] = screen.getAllByRole('button', { name: 'Mark run run-1 as Good' });
        fireEvent.click(goodInTable);
        await waitFor(() => {
            const ratingRequest = requests.find((request) => request.path === '/api/internal/ai/benchmark/rating');
            expect(ratingRequest?.body).toEqual({ runId: 'run-1', rating: 'good' });
        });
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: 'Mark run run-1 as Good' })
                .every((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
        });

        // Compare ranks the rated model.
        await user.click(screen.getByRole('tab', { name: 'Compare' }));
        expect(await screen.findByText('3.00 / 3')).toBeTruthy();
        expect(screen.getByText('· 1 vote')).toBeTruthy();
    });

    it('opens a linked session on its runs and starts a new session from the menu', async () => {
        const user = userEvent.setup();
        renderPage(['/admin/ai-benchmark?session=share-abc']);

        expect(await screen.findByRole('button', { name: 'Open run #1 of Default model' }, { timeout: 8000 })).toBeTruthy();
        expect(screen.getByRole('tab', { name: /Runs/ }).getAttribute('aria-selected')).toBe('true');
        expect(requests.some((request) => request.path === '/api/internal/ai/benchmark?session=share-abc')).toBe(true);

        await user.click(screen.getByRole('button', { name: 'Session actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Start a new session' }));

        expect(mocks.trackEvent).toHaveBeenCalledWith('admin__ai_benchmark--new_session');
        await waitFor(() => expect(locationSearch()).toBe(''));
        expect(screen.getByRole('tab', { name: 'Setup' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tab', { name: /Runs/ }).textContent).toContain('0');
    });

    it('shows the template JSON highlighted, with the same markup Prism.highlight produces', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole('button', { name: 'Details and prompt' }, { timeout: 8000 }));
        const code = document.querySelector('code.language-json');
        expect(code).toBeTruthy();
        expect(code?.querySelector('span.token.property')).toBeTruthy();

        const expected = document.createElement('code');
        expected.innerHTML = Prism.highlight(code?.textContent ?? '', Prism.languages.json, 'json');
        expect(code?.innerHTML).toBe(expected.innerHTML);
    });
});

describe('renderPrismTokens', () => {
    it('matches Prism.highlight for nested tokens, aliases and escaped text', () => {
        const source = JSON.stringify({ a: 'x<y & "z"', b: [1, true, null], c: { d: -2.5e3 } }, null, 2);
        const { container } = render(React.createElement('code', null, renderPrismTokens(Prism.tokenize(source, Prism.languages.json))));
        const expected = document.createElement('code');
        expected.innerHTML = Prism.highlight(source, Prism.languages.json, 'json');
        expect(container.querySelector('code')?.innerHTML).toBe(expected.innerHTML);
        expect(container.querySelector('span.token.null.keyword')).toBeTruthy();
    });
});
