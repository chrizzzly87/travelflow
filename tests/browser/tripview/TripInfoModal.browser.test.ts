// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TripInfoModal } from '../../../components/TripInfoModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'tripView.infoDialog.tabs.general') return 'General';
      if (key === 'tripView.infoDialog.tabs.history') return 'History';
      if (key === 'tripView.infoDialog.tabs.export') return 'Export';
      if (key === 'tripView.infoDialog.tabs.destination') return 'Destination';
      if (key === 'tripView.infoDialog.tabs.debug') return 'Debug';
      if (key === 'tripView.infoDialog.general.titleLabel') return 'Trip title';
      if (key === 'tripView.infoDialog.export.activities.action') return 'Export activities (.ics)';
      if (key === 'tripView.infoDialog.export.cities.action') return 'Export cities (.ics)';
      if (key === 'tripView.infoDialog.export.everything.action') return 'Download everything (.ics)';
      if (key === 'tripView.infoDialog.export.print.action') return 'Open print layout';
      if (key === 'tripView.infoDialog.history.undo') return 'Undo';
      if (key === 'tripView.infoDialog.history.redo') return 'Redo';
      if (key === 'tripView.infoDialog.history.go') return 'Go';
      if (key === 'tripView.infoDialog.history.pendingSyncOne') return '1 latest change is saved locally and not synced yet.';
      if (key === 'tripView.infoDialog.general.favoriteAdd') return 'Add to favorites';
      if (key === 'tripView.infoDialog.general.favoriteOff') return 'Favorite';
      if (key === 'tripView.infoDialog.general.meta.totalDaysValue') return `${options?.count ?? ''} days`;
      return key;
    },
  }),
}));

const baseHistoryItem = {
  id: 'entry-1',
  url: '/trip/trip-1?history=1',
  ts: Date.now(),
  isCurrent: true,
  details: 'Renamed trip',
  tone: 'update' as const,
  meta: {
    label: 'Updated',
    iconClass: 'bg-accent-100 text-accent-700',
    badgeClass: 'bg-accent-100 text-accent-700',
    Icon: () => React.createElement('span', { 'data-testid': 'history-icon' }, 'icon'),
  },
};

const buildProps = (): React.ComponentProps<typeof TripInfoModal> => ({
  isOpen: true,
  onClose: vi.fn(),
  tripTitle: 'Sample Trip',
  isEditingTitle: false,
  editTitleValue: 'Sample Trip',
  onEditTitleValueChange: vi.fn(),
  onCommitTitleEdit: vi.fn(),
  onStartTitleEdit: vi.fn(),
  canManageTripMetadata: true,
  canEdit: true,
  isFavorite: false,
  onToggleFavorite: vi.fn(),
  isExamplePreview: false,
  tripMeta: {
    dateRange: 'Apr 1, 2026 – Apr 7, 2026',
    totalDaysLabel: '7',
    cityCount: 2,
    distanceLabel: '450 km',
  },
  showAllHistory: false,
  onToggleShowAllHistory: vi.fn(),
  onHistoryUndo: vi.fn(),
  onHistoryRedo: vi.fn(),
  historyItems: [baseHistoryItem],
  onGoToHistoryEntry: vi.fn(),
  formatHistoryTime: () => 'now',
  pendingSyncCount: 1,
  failedSyncCount: 0,
  countryInfo: undefined,
  isPaywallLocked: false,
  ownerSummary: '@traveler',
  ownerHint: null,
  adminMeta: null,
  travelerWarnings: [],
  onExportActivitiesCalendar: vi.fn(),
  onExportCitiesCalendar: vi.fn(),
  onExportAllCalendar: vi.fn(),
  onOpenPrintLayout: vi.fn(),
});

describe('components/TripInfoModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders tabs and triggers export actions from the export tab', async () => {
    const props = buildProps();

    render(React.createElement(TripInfoModal, props));

    expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Debug' })).not.toBeInTheDocument();

    const exportTab = screen.getByRole('tab', { name: 'Export' });
    fireEvent.mouseDown(exportTab, { button: 0 });
    await waitFor(() => expect(exportTab).toHaveAttribute('data-state', 'active'));
    fireEvent.click(screen.getByRole('button', { name: 'Export activities (.ics)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export cities (.ics)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download everything (.ics)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open print layout' }));

    expect(props.onExportActivitiesCalendar).toHaveBeenCalledTimes(1);
    expect(props.onExportCitiesCalendar).toHaveBeenCalledTimes(1);
    expect(props.onExportAllCalendar).toHaveBeenCalledTimes(1);
    expect(props.onOpenPrintLayout).toHaveBeenCalledTimes(1);
  });

  it('shows the editable title field immediately and exposes the admin debug tab only for admins', async () => {
    const props = buildProps();
    props.adminMeta = {
      ownerUserId: 'user-1',
      ownerUsername: 'traveler',
      ownerEmail: 'traveler@example.com',
      accessSource: 'owner',
    };

    render(React.createElement(TripInfoModal, props));

    const titleField = screen.getByRole('textbox', { name: 'Trip title' });
    expect(titleField).toHaveValue('Sample Trip');
    expect(titleField).toHaveClass('rounded-md');
    expect(titleField).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toHaveClass('rounded-md');

    const debugTab = screen.getByRole('tab', { name: 'Debug' });
    fireEvent.mouseDown(debugTab, { button: 0 });
    await waitFor(() => expect(debugTab).toHaveAttribute('data-state', 'active'));
    expect(screen.getByText('Admin access')).toBeInTheDocument();
    expect(screen.getByText('AI generation diagnostics')).toBeInTheDocument();
  });

  it('keeps history actions inside the history tab and routes go-to-entry through the provided handler', async () => {
    const props = buildProps();

    render(React.createElement(TripInfoModal, props));

    const historyTab = screen.getByRole('tab', { name: 'History' });
    fireEvent.mouseDown(historyTab, { button: 0 });
    await waitFor(() => expect(historyTab).toHaveAttribute('data-state', 'active'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
    expect(screen.getByText('1 latest change is saved locally and not synced yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(props.onGoToHistoryEntry).toHaveBeenCalledWith(baseHistoryItem);
  });
});
