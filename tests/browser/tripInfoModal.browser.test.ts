// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripInfoModal } from '../../components/TripInfoModal';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'tripView.infoDialog.tabs.debug') return 'Debug';
      if (key === 'tripView.infoDialog.tabs.destination') return 'Destination';
      if (key === 'tripView.infoDialog.destination.prepWorkspaceEyebrow') return 'Dedicated workspace';
      if (key === 'tripView.infoDialog.destination.prepWorkspaceTitle') return 'Travel prep moved into the trip workspace';
      if (key === 'tripView.infoDialog.destination.prepWorkspaceDescription') return 'Keep the modal short. Open the prep workspace for entry rules, safety, money, utilities, and source-backed updates tied to this itinerary.';
      if (key === 'tripView.infoDialog.destination.prepWorkspaceAction') return 'Open prep workspace';
      if (key === 'tripView.infoDialog.general.meta.owner') return 'Owner';
      if (key === 'tripView.infoDialog.general.meta.access') return 'Access';
      if (key === 'tripView.infoDialog.general.meta.tripSpan') return 'Days & nights';
      if (key === 'tripView.infoDialog.general.meta.tripSpanValue') return `${options?.days ?? ''} days / ${options?.nights ?? ''} nights`;
      return key;
    },
  }),
}));

vi.mock('../../services/analyticsService', async () => {
  const actual = await vi.importActual<typeof import('../../services/analyticsService')>('../../services/analyticsService');
  return {
    ...actual,
    trackEvent: mocks.trackEvent,
    getAnalyticsDebugAttributes: () => ({}),
  };
});

describe('components/TripInfoModal ownership context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('renders the destination handoff card and tracks prep-workspace opens', async () => {
    const user = userEvent.setup();
    const onOpenTravelPrepWorkspace = vi.fn();

    render(React.createElement(TripInfoModal, {
      isOpen: true,
      onClose: () => {},
      tripTitle: 'Thailand Travel Prep Playground',
      isEditingTitle: false,
      editTitleValue: 'Thailand Travel Prep Playground',
      onEditTitleValueChange: () => {},
      onCommitTitleEdit: () => {},
      onCancelTitleEdit: () => {},
      onStartTitleEdit: () => {},
      canManageTripMetadata: true,
      canEdit: true,
      isFavorite: false,
      onToggleFavorite: () => {},
      isExamplePreview: true,
      tripMeta: {
        dateRange: 'Nov 8, 2026 – Nov 20, 2026',
        days: 13,
        nights: 12,
        cityCount: 5,
        distanceLabel: '1,800 km',
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
      countryInfo: {
        countryCode: 'TH',
        countryName: 'Thailand',
        currencyCode: 'THB',
        currencyName: 'Thai Baht',
        exchangeRate: 43.35,
        languages: ['Thai'],
        electricSockets: 'Type A, Type B, Type C, Type O',
        visaInfoUrl: 'https://www.gov.uk/foreign-travel-advice/thailand/entry-requirements',
        auswaertigesAmtUrl: 'https://www.auswaertiges-amt.de/de/service/laender/thailand-node/thailandsicherheit/201558',
        travelGuide: {
          title: 'Thailand travel-prep snapshot',
          summary: 'This hidden example trip turns country-guide content into a planner companion so TravelFlow can test trip-prep UX before shipping public country pages.',
          disclaimer: 'Testing snapshot only. Verify current official travel advice before departure.',
          quickFacts: [
            {
              label: 'Visa-free stay',
              value: 'Up to 60 days',
              tone: 'accent',
            },
          ],
          sections: [
            {
              id: 'entry',
              title: 'Entry requirements',
              summary: 'The highest-value planning content is passport validity, visa-free duration, arrival-card timing, and overstay risk.',
              bullets: ['Passport should stay valid for at least 6 months after arrival.'],
              tone: 'accent',
            },
          ],
          utilities: [
            {
              label: 'Emergency numbers',
              value: '191 / 1669 / 199',
            },
          ],
          officialLinks: [
            {
              label: 'UK travel advice for Thailand',
              url: 'https://www.gov.uk/foreign-travel-advice/thailand',
            },
          ],
          updates: [
            {
              id: 'border',
              category: 'Border risk',
              ageLabel: 'Reference snapshot',
              title: 'Border disruption advice became more explicit',
              summary: 'This belongs in a warning banner and in trip-prep reminders when a route gets close to affected regions.',
            },
          ],
        },
      },
      isPaywallLocked: false,
      ownerSummary: null,
      ownerHint: null,
      adminMeta: {
        ownerUserId: 'owner-1',
        ownerUsername: 'owner_user',
        ownerEmail: 'owner@example.com',
        accessSource: 'owner',
      },
      onOpenTravelPrepWorkspace,
      onOpenPrintLayout: () => {},
    }));

    await user.click(screen.getByRole('tab', { name: 'Destination' }));

    expect(screen.getByText('Travel prep moved into the trip workspace')).toBeInTheDocument();
    expect(screen.getByText('Entry requirements')).toBeInTheDocument();
    expect(screen.queryByText('Recent guide updates worth testing')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open prep workspace' }));

    expect(onOpenTravelPrepWorkspace).toHaveBeenCalledTimes(1);
    expect(mocks.trackEvent).toHaveBeenCalledWith('trip_view__travel_prep_workspace--open', {
      source: 'trip_info_modal',
    });
  });
});
