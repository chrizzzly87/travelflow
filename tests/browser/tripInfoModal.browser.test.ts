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
    }));

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('@owner_user')).toBeInTheDocument();
    expect(screen.getByText('You are viewing a public trip owned by another account.')).toBeInTheDocument();
  });
});

