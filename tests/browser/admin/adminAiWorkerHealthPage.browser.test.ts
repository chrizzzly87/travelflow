// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../../../services/adminService', () => ({
  adminGetAiWorkerHealth: mocks.adminGetAiWorkerHealth,
}));

import { AdminAiWorkerHealthPage } from '../../../pages/AdminAiWorkerHealthPage';

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
    mocks.adminGetAiWorkerHealth.mockResolvedValue({
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
        lastCanaryLatencyMs: 180,
      },
      checks: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          checkType: 'watchdog',
          status: 'warning',
          startedAt: '2026-03-10T10:10:00.000Z',
          finishedAt: '2026-03-10T10:10:05.000Z',
          staleQueuedCount: 2,
          oldestQueuedAgeMs: 360000,
          dispatchAttempted: true,
          dispatchHttpStatus: 202,
          canaryLatencyMs: null,
          failureCode: 'WORKER_STALE_QUEUE_DETECTED',
          failureMessage: 'Detected stale queued jobs and re-kicked the worker.',
          metadata: {
            selfHealAttempted: true,
          },
          createdAt: '2026-03-10T10:10:05.000Z',
        },
      ],
    });
  });

  it('renders worker health summary cards and recent checks', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.adminGetAiWorkerHealth).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Worker Health' })).toBeInTheDocument();
    expect(screen.getAllByText('Detected stale queued jobs and re-kicked the worker.').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent checks')).toBeInTheDocument();
    expect(screen.getByText('watchdog')).toBeInTheDocument();
    expect(screen.getByText('WORKER_STALE_QUEUE_DETECTED')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open AI Telemetry' })).toHaveAttribute('href', '/admin/ai-benchmark/telemetry');
  });

  it('reloads worker health on demand', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    renderPage();

    await waitFor(() => {
      expect(mocks.adminGetAiWorkerHealth).toHaveBeenCalledTimes(1);
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload health' }));

    await waitFor(() => {
      expect(mocks.adminGetAiWorkerHealth).toHaveBeenCalledTimes(2);
    });
  });
});
