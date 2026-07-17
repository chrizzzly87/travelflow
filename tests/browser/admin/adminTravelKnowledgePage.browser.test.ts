// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  listCandidates: vi.fn(),
  getSummary: vi.fn(),
  reviewCandidate: vi.fn(),
  promptDialog: vi.fn(),
  showAppToast: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
  AdminShell: ({
    title,
    description,
    actions,
    children,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
  }) => React.createElement(
    'div',
    null,
    React.createElement('h1', null, title),
    description ? React.createElement('p', null, description) : null,
    actions,
    children,
  ),
}));

vi.mock('../../../components/admin/AdminReloadButton', () => ({
  AdminReloadButton: ({ onClick, label }: { onClick: () => void; label: string }) => (
    React.createElement('button', { type: 'button', onClick }, label)
  ),
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
    onSelectedValuesChange: (values: string[]) => void;
  }) => React.createElement(
    'div',
    null,
    options.map((option) => React.createElement(
      'button',
      {
        key: option.value,
        type: 'button',
        onClick: () => onSelectedValuesChange(
          selectedValues.includes(option.value)
            ? selectedValues.filter((value) => value !== option.value)
            : [...selectedValues, option.value],
        ),
      },
      `${label}:${option.label}`,
    )),
  ),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ prompt: mocks.promptDialog }),
}));

vi.mock('../../../components/ui/appToast', () => ({
  showAppToast: mocks.showAppToast,
}));

vi.mock('../../../services/adminService', () => ({
  adminListTravelKnowledgeCandidates: mocks.listCandidates,
  adminGetTravelKnowledgeReviewSummary: mocks.getSummary,
  adminReviewTravelKnowledgeCandidate: mocks.reviewCandidate,
}));

import { AdminTravelKnowledgePage } from '../../../pages/AdminTravelKnowledgePage';

const createCandidate = (overrides: Record<string, unknown> = {}) => ({
  candidateId: 'candidate-bangkok',
  sourceSnapshotId: 'snapshot-geonames',
  sourceRunId: 'run-geonames',
  countryCode: 'TH',
  targetKind: 'entity',
  targetKey: 'bangkok',
  targetName: 'Bangkok',
  targetEntityId: 'entity-bangkok',
  targetTemplateId: null,
  fieldPath: 'attributes.externalIds.geonames',
  changeKind: 'add',
  previousValue: null,
  proposedValue: '1609350',
  extractionMethod: 'deterministic_transform',
  confidence: 0.99,
  severity: 'low',
  validationFindings: [],
  status: 'needs_review',
  sourceKey: 'geonames',
  sourceName: 'GeoNames',
  sourceUrl: 'https://download.geonames.org/export/dump/TH.zip',
  retrievedAt: '2026-07-17T08:00:00.000Z',
  createdAt: '2026-07-17T08:01:00.000Z',
  updatedAt: '2026-07-17T08:01:00.000Z',
  reviewCount: 0,
  latestDecision: null,
  latestReason: null,
  latestAcceptedValue: null,
  latestReviewedAt: null,
  ...overrides,
});

const summary = {
  candidateTotal: 2,
  newCount: 0,
  needsReviewCount: 1,
  acceptedCount: 1,
  rejectedCount: 0,
  successfulRunCount: 4,
  snapshotCount: 5,
  latestSourceRunAt: '2026-07-17T08:00:00.000Z',
};

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/admin/travel-knowledge'] },
    React.createElement(AdminTravelKnowledgePage),
  ),
);

describe('pages/AdminTravelKnowledgePage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.listCandidates.mockResolvedValue([
      createCandidate(),
      createCandidate({
        candidateId: 'candidate-chiang-mai',
        targetKey: 'chiang-mai',
        targetName: 'Chiang Mai',
        sourceKey: 'wikidata',
        sourceName: 'Wikidata',
        fieldPath: 'attributes.externalIds.wikidata',
        proposedValue: 'Q233588',
        status: 'accepted',
      }),
    ]);
    mocks.getSummary.mockResolvedValue(summary);
    mocks.reviewCandidate.mockResolvedValue({
      candidateId: 'candidate-bangkok',
      candidateStatus: 'accepted',
      decisionId: 'decision-1',
      decision: 'accept',
      reviewedAt: '2026-07-17T09:00:00.000Z',
    });
    mocks.promptDialog.mockResolvedValue('Source identity and canonical target were verified.');
  });

  it('loads the summary and focuses the queue on open candidates', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.listCandidates).toHaveBeenCalledWith({ limit: 250 });
      expect(mocks.getSummary).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Travel Knowledge' })).toBeInTheDocument();
    expect(screen.getByText('Bangkok')).toBeInTheDocument();
    expect(screen.queryByText('Chiang Mai')).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GeoNames' })).toHaveAttribute('href', expect.stringContaining('geonames.org'));
  });

  it('records an accept decision with a required reason, then reloads canonical state', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Bangkok');
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(mocks.promptDialog).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Accept',
        label: 'Review reason',
      }));
      expect(mocks.reviewCandidate).toHaveBeenCalledWith({
        candidateId: 'candidate-bangkok',
        decision: 'accept',
        reason: 'Source identity and canonical target were verified.',
        acceptedValue: undefined,
      });
      expect(mocks.listCandidates).toHaveBeenCalledTimes(2);
    });

    expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'success',
      title: 'Candidate accepted',
    }));
  });

  it('parses edited JSON before submitting accept-with-edit', async () => {
    const user = userEvent.setup();
    mocks.promptDialog
      .mockResolvedValueOnce('"1609351"')
      .mockResolvedValueOnce('Corrected after checking the current source record.');
    renderPage();

    await screen.findByText('Bangkok');
    await user.click(screen.getByRole('button', { name: 'Edit & accept' }));

    await waitFor(() => {
      expect(mocks.reviewCandidate).toHaveBeenCalledWith(expect.objectContaining({
        candidateId: 'candidate-bangkok',
        decision: 'accept_with_edit',
        acceptedValue: '1609351',
      }));
    });
  });

  it('can include terminal candidates through the status filter', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Bangkok');

    await user.click(screen.getByRole('button', { name: 'Status:Accepted' }));

    expect(screen.getByText('Chiang Mai')).toBeInTheDocument();
  });
});
