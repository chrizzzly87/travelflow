// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement('div', null, React.createElement('h1', null, title), actions, children)
  ),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../../services/dbService', () => ({
  ensureDbSession: vi.fn(async () => 'session'),
  dbGetAccessToken: vi.fn(async () => 'token'),
}));

// The charts are real Recharts; jsdom has no layout, so give ResponsiveContainer a size.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      React.createElement('div', { style: { width: 640, height: 256 } }, React.cloneElement(children, { width: 640, height: 256 }))
    ),
  };
});

import { AdminAiTelemetryPage } from '../../../pages/AdminAiTelemetryPage';

const model = (provider: string, name: string, total: number) => ({
  provider,
  model: name,
  key: `${provider}:${name}`,
  total,
  success: total - 1,
  failed: 1,
  successRate: ((total - 1) / total) * 100,
  averageLatencyMs: 1200,
  totalCostUsd: 0.0012,
  averageCostUsd: 0.0001,
  costPerSecondUsd: 0.00008,
});

const telemetryPayload = {
  ok: true,
  summary: { total: 30, success: 28, failed: 2, successRate: 93.3, averageLatencyMs: 1400, totalCostUsd: 0.0034, averageCostUsd: 0.0001 },
  series: [
    { bucketStart: '2026-10-20T10:00:00.000Z', total: 10, success: 9, failed: 1, averageLatencyMs: 1300, totalCostUsd: 0.0011 },
    { bucketStart: '2026-10-20T11:00:00.000Z', total: 20, success: 19, failed: 1, averageLatencyMs: 1500, totalCostUsd: 0.0023 },
  ],
  monthlyCostSeries: [],
  providers: [
    { provider: 'openai', total: 20, success: 19, failed: 1, averageLatencyMs: 1300, totalCostUsd: 0.002 },
    { provider: 'anthropic', total: 10, success: 9, failed: 1, averageLatencyMs: 1500, totalCostUsd: 0.0014 },
  ],
  models: [model('openai', 'gpt-test', 20), model('anthropic', 'claude-test', 10)],
  rankings: { fastest: [model('openai', 'gpt-test', 20)], cheapest: [], bestValue: [] },
  comments: { total: 0, groups: [] },
  recent: [
    { id: 'r1', created_at: '2026-10-20T11:00:00.000Z', source: 'benchmark', provider: 'openai', model: 'gpt-test', status: 'failed', latency_ms: 900, estimated_cost_usd: 0.0001, error_code: 'TIMEOUT' },
  ],
  availableProviders: ['openai', 'anthropic'],
};

const renderPage = () => render(
  React.createElement(MemoryRouter, null, React.createElement(AdminAiTelemetryPage)),
);

describe('pages/AdminAiTelemetryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(telemetryPayload), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders four KPIs, the trend chart, leaders and failure codes', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'AI telemetry' })).toBeInTheDocument();
    expect(await screen.findByText('93.3%')).toBeInTheDocument();
    expect(screen.getByText('2 failed; see failure codes')).toBeInTheDocument();
    // The failure-rate tile restated the success rate and is gone.
    expect(screen.queryByText('Failure rate')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fastest.*gpt-test.*1\.20 s/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Recent failures by error code' })).toHaveTextContent('TIMEOUT');

    const callTrend = screen.getByRole('img', { name: /successful and failed calls/i });
    expect(callTrend.querySelectorAll('.recharts-bar-rectangle').length).toBeGreaterThan(0);
    // An empty month still renders one zero bar per elapsed day.
    expect(screen.getByRole('img', { name: 'Bar chart of API cost per day this month' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Worker health' })).toHaveAttribute('href', '/admin/ai-benchmark/worker-health');
  });

  it('ranks models in one sortable table, re-sorted by a leader', async () => {
    renderPage();

    const modelHeader = await screen.findByRole('columnheader', { name: 'Calls' });
    expect(modelHeader).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByText('Showing 1–2 of 2 models')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cheapest/ }));
    expect(screen.getByRole('columnheader', { name: 'Cost / success' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('button', { name: /Cheapest/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('scopes the page to a provider from the providers tab', async () => {
    const fetchMock = vi.mocked(fetch);
    renderPage();
    await screen.findByText('93.3%');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Providers' }), { button: 0 });
    const focusButton = await screen.findByRole('button', { name: /OpenAI/ });
    expect(screen.getByText(/20 · 66\.7%/)).toBeInTheDocument();
    fireEvent.click(focusButton);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('provider=openai'))).toBe(true);
    });
    expect(await screen.findByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('pages recent calls twenty at a time', async () => {
    const recent = Array.from({ length: 25 }, (_, index) => ({
      ...telemetryPayload.recent[0],
      id: `r${index}`,
      status: index % 5 === 0 ? 'failed' : 'success',
    }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...telemetryPayload, recent }), { status: 200 })));
    renderPage();

    expect(await screen.findByText('Showing 1–20 of 25 calls')).toBeInTheDocument();
    const recentPager = screen.getByText('Showing 1–20 of 25 calls').closest('nav') as HTMLElement;
    fireEvent.click(within(recentPager).getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 21–25 of 25 calls')).toBeInTheDocument();
  });

  it('shows an authored alert when the telemetry request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'Not allowed' }), { status: 403 })));
    renderPage();

    expect(await screen.findByText('Could not load AI telemetry')).toBeInTheDocument();
  });
});
