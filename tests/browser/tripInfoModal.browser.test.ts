// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TripInfoModal } from '../../components/TripInfoModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'tripView.infoDialog.tabs.debug') return 'Debug';
      if (key === 'tripView.infoDialog.general.meta.owner') return 'Owner';
      if (key === 'tripView.infoDialog.general.meta.access') return 'Access';
      if (key === 'tripView.infoDialog.general.meta.tripSpan') return 'Days & nights';
      if (key === 'tripView.infoDialog.general.meta.tripSpanValue') return `${options?.days ?? ''} days / ${options?.nights ?? ''} nights`;
      return key;
    },
  }),
}));

describe('components/TripInfoModal ownership context', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders owner details and ownership hint when provided', () => {
    render(React.createElement(TripInfoModal, {
      isOpen: true,
      onClose: () => {},
      tripTitle: 'Sample Trip',
      isEditingTitle: false,
      editTitleValue: 'Sample Trip',
      onEditTitleValueChange: () => {},
      onCommitTitleEdit: () => {},
      onStartTitleEdit: () => {},
      canManageTripMetadata: true,
      canEdit: false,
      isFavorite: false,
      onToggleFavorite: () => {},
      isExamplePreview: false,
      tripMeta: {
        dateRange: 'Jan 1, 2026 – Jan 3, 2026',
        days: 3,
        nights: 2,
        cityCount: 2,
        distanceLabel: '120 km',
      },
      aiMeta: null,
      forkMeta: null,
      showAllHistory: false,
      onToggleShowAllHistory: () => {},
      onHistoryUndo: () => {},
      onHistoryRedo: () => {},
      historyItems: [],
      onGoToHistoryEntry: () => {},
      formatHistoryTime: () => 'now',
      pendingSyncCount: 0,
      failedSyncCount: 0,
      countryInfo: undefined,
      isPaywallLocked: false,
      ownerSummary: '@owner_user',
      ownerHint: 'You are viewing a public trip owned by another account.',
      adminMeta: {
        ownerUserId: '3fa19134-cf6d-48a9-8099-fdb68d817cdc',
        ownerUsername: '@owner_user',
        ownerEmail: 'owner@example.com',
        accessSource: 'public_read',
      },
      onOpenPrintLayout: () => {},
    }));

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getAllByText('@owner_user').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('You are viewing a public trip owned by another account.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Debug' })).toBeInTheDocument();
  });

  it('renders generation summary when latest attempt metadata exists', () => {
    render(React.createElement(TripInfoModal, {
      isOpen: true,
      onClose: () => {},
      tripTitle: 'Generated Trip',
      isEditingTitle: false,
      editTitleValue: 'Generated Trip',
      onEditTitleValueChange: () => {},
      onCommitTitleEdit: () => {},
      onStartTitleEdit: () => {},
      canManageTripMetadata: true,
      canEdit: true,
      isFavorite: false,
      onToggleFavorite: () => {},
      isExamplePreview: false,
      tripMeta: {
        dateRange: 'Jan 1, 2026 – Jan 3, 2026',
        days: 3,
        nights: 2,
        cityCount: 2,
        distanceLabel: '120 km',
      },
      aiMeta: {
        provider: 'openai',
        model: 'gpt-4.1',
        generatedAt: '2026-03-03T12:00:00.000Z',
        generation: {
          state: 'failed',
          latestAttempt: {
            id: 'attempt-1',
            flow: 'classic',
            source: 'trip_info_modal',
            state: 'failed',
            startedAt: '2026-03-03T12:00:00.000Z',
            finishedAt: '2026-03-03T12:00:02.000Z',
            durationMs: 2000,
            requestId: 'req-1',
            provider: 'openai',
            model: 'gpt-4.1',
            failureKind: 'provider',
            errorCode: 'MODEL_UNAVAILABLE',
            errorMessage: 'Model unavailable',
            metadata: {
              orchestration: 'async_worker',
            },
          },
          attempts: [],
          inputSnapshot: null,
        },
      },
      generationState: 'failed',
      latestGenerationAttempt: {
        id: 'attempt-1',
        flow: 'classic',
        source: 'trip_info_modal',
        state: 'failed',
        startedAt: '2026-03-03T12:00:00.000Z',
        finishedAt: '2026-03-03T12:00:02.000Z',
        durationMs: 2000,
        requestId: 'req-1',
        provider: 'openai',
        model: 'gpt-4.1',
        failureKind: 'provider',
        errorCode: 'MODEL_UNAVAILABLE',
        errorMessage: 'Model unavailable',
        metadata: {
          orchestration: 'async_worker',
        },
      },
      canRetryGeneration: true,
      isRetryingGeneration: false,
      onRetryGeneration: () => {},
      retryAnalyticsAttributes: {},
      forkMeta: null,
      showAllHistory: false,
      onToggleShowAllHistory: () => {},
      onHistoryUndo: () => {},
      onHistoryRedo: () => {},
      historyItems: [],
      onGoToHistoryEntry: () => {},
      formatHistoryTime: () => 'now',
      pendingSyncCount: 0,
      failedSyncCount: 0,
      countryInfo: undefined,
      isPaywallLocked: false,
      ownerSummary: null,
      ownerHint: null,
      adminMeta: {
        ownerUserId: 'owner-1',
        ownerUsername: 'owner_user',
        ownerEmail: 'owner@example.com',
        accessSource: 'owner',
      },
      onExportActivitiesCalendar: () => {},
      onExportCitiesCalendar: () => {},
      onExportAllCalendar: () => {},
      onOpenPrintLayout: () => {},
    }));

    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('gpt-4.1')).toBeInTheDocument();
    expect(screen.getByText('async_worker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tripView.generation.tripInfo.retry' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Debug' })).toBeInTheDocument();
  });
});
