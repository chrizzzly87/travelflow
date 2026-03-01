// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TripInfoModal } from '../../components/TripInfoModal';

describe('components/TripInfoModal ownership context', () => {
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
        totalDaysLabel: '3',
        cityCount: 2,
        distanceLabel: '120 km',
      },
      aiMeta: null,
      forkMeta: null,
      isTripInfoHistoryExpanded: false,
      onToggleTripInfoHistoryExpanded: () => {},
      showAllHistory: false,
      onToggleShowAllHistory: () => {},
      onHistoryUndo: () => {},
      onHistoryRedo: () => {},
      infoHistoryItems: [],
      onGoToHistoryEntry: () => {},
      onOpenFullHistory: () => {},
      formatHistoryTime: () => 'now',
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
    }));

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getAllByText('@owner_user').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('You are viewing a public trip owned by another account.')).toBeInTheDocument();
    expect(screen.getByText('Admin debug')).toBeInTheDocument();
    expect(screen.getByText('3fa19134-cf6d-48a9-8099-fdb68d817cdc')).toBeInTheDocument();
  });
});
