// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  adminGetAiWorkerHealth: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    React.createElement(
      'div',
      null,
      React.createElement('h1', null, title),
      description ? React.createElement('p', null, description) : null,
      actions,
      children,
    )
  ),
}));

vi.mock('../../../components/admin/AdminReloadButton', () => ({
  AdminReloadButton: ({ onClick, label }: { onClick: () => void; label: string }) => React.createElement('button', { type: 'button', onClick }, label),
}));

vi.mock('../../../components/admin/AdminSurfaceCard', () => ({
  AdminSurfaceCard: ({ children }: { children: React.ReactNode }) => React.createElement('section', null, children),
}));

vi.mock('../../../components/admin/AdminFilterMenu', () => ({
  AdminFilterMenu: ({
    label,
    options,
    selectedValues,
    onSelectedValuesChange,
  }: {
    label: string;
    options: Array<{ value: string; label: string }>;
    selectedValues: string[];
    onSelectedValuesChange: (nextValues: string[]) => void;
  }) => React.createElement(
    'div',
    { 'data-testid': `filter-${label.toLowerCase()}` },
    options.map((option) => React.createElement(
      'button',
      {
        key: option.value,
        type: 'button',
        onClick: () => {
          const next = selectedValues.includes(option.value)
            ? selectedValues.filter((value) => value !== option.value)
            : [...selectedValues, option.value];
          onSelectedValuesChange(next);
        },
      },
      `${label}:${option.label}`,
    )),
  ),
}));

vi.mock('../../../services/adminService', () => ({
  adminGetAiWorkerHealth: mocks.adminGetAiWorkerHealth,
}));

import { AdminAiWorkerHealthPage } from '../../../pages/AdminAiWorkerHealthPage';

const createCheck = (index: number, overrides: Partial<Record<string, unknown>> = {}) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  checkType: index % 3 === 0 ? 'canary' : index % 2 === 0 ? 'watchdog' : 'heartbeat',
  status: index % 4 === 0 ? 'failed' : index % 3 === 0 ? 'warning' : 'ok',
  startedAt: `2026-03-10T10:${String(index).padStart(2, '0')}:00.000Z`,
  finishedAt: `2026-03-10T10:${String(index).padStart(2, '0')}:30.000Z`,
  staleQueuedCount: index % 2,
  oldestQueuedAgeMs: index % 2 ? 360000 : 0,
  dispatchAttempted: index % 3 !== 0,
  dispatchHttpStatus: index % 3 !== 0 ? 202 : null,
  canaryLatencyMs: index % 3 === 0 ? 200 + index : null,
  failureCode: index % 4 === 0 ? `FAIL_${index}` : null,
  failureMessage: index % 4 === 0 ? `Failure ${index}` : null,
  metadata: null,
  createdAt: `2026-03-10T10:${String(index).padStart(2, '0')}:30.000Z`,
  ...overrides,
});

const buildResponse = (checks: ReturnType<typeof createCheck>[]) => ({
  summary: {
    overallStatus: 'warning',
    statusReason: 'Detected stale queued jobs and re-kicked the worker.',
    heartbeatFresh: true,
    canaryFresh: true,
    canaryDue: false,
    staleQueuedCount: 2,
    oldestQueuedAgeMs: 360000,
    lastHeartbeatAt: '2026-03-10T10:10:00.000Z',
    lastHeartbeatStatus: 'warning',
    lastSelfHealAt: '2026-03-10T10:10:05.000Z',
    lastSelfHealStatus: 'warning',
    lastCanaryAt: '2026-03-10T10:00:01.000Z',
    lastCanaryStatus: 'ok',
    lastCanaryLatencyMs: 3950,
  },
  checks,
});

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/admin/ai-benchmark/worker-health'] },
    React.createElement(AdminAiWorkerHealthPage),
  ),
);

describe('pages/AdminAiWorkerHealthPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.adminGetAiWorkerHealth.mockResolvedValue(buildResponse(Array.from({ length: 12 }, (_, index) => createCheck(index + 1))));
  });

  it('renders worker health summary cards and canary explanations', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.adminGetAiWorkerHealth).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Worker Health' })).toBeInTheDocument();
    expect(screen.getAllByText('Detected stale queued jobs and re-kicked the worker.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'What the canary proves' })).toHaveAttribute(
      'data-tooltip',
      expect.stringContaining('synthetic probe'),
    );
    expect(screen.getByText('Recent checks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open AI Telemetry' })).toHaveAttribute('href', '/admin/ai-benchmark/telemetry');
  });

  it('paginates recent checks and resets to page one when filters change', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(mocks.adminGetAiWorkerHealth).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Showing 1-10 of 12')).toBeInTheDocument();
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Showing 11-12 of 12')).toBeInTheDocument();
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Type:Canary' }));

    expect(screen.getByText('Showing 1-4 of 4')).toBeInTheDocument();
    expect(screen.getByText('Page 1 / 1')).toBeInTheDocument();
    expect(screen.queryByText('Page 2 / 2')).not.toBeInTheDocument();
  });

  it('reloads worker health on demand', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(mocks.adminGetAiWorkerHealth).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Reload health' }));

    await waitFor(() => {
      expect(mocks.adminGetAiWorkerHealth).toHaveBeenCalledTimes(2);
    });
  });
});
