// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { TripInfoModal } from '../../../components/TripInfoModal';

describe('components/TripInfoModal calendar exports', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders calendar export actions and calls provided handlers', () => {
    const onExportActivitiesCalendar = vi.fn();
    const onExportCitiesCalendar = vi.fn();
    const onExportAllCalendar = vi.fn();

    render(
      <TripInfoModal
        isOpen
        onClose={vi.fn()}
        tripTitle="Sample Trip"
        isEditingTitle={false}
        editTitleValue="Sample Trip"
        onEditTitleValueChange={vi.fn()}
        onCommitTitleEdit={vi.fn()}
        onStartTitleEdit={vi.fn()}
        canManageTripMetadata
        canEdit
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        isExamplePreview={false}
        tripMeta={{
          dateRange: 'Apr 1, 2026 – Apr 7, 2026',
          totalDaysLabel: '7',
          cityCount: 2,
          distanceLabel: '450 km',
        }}
        isTripInfoHistoryExpanded={false}
        onToggleTripInfoHistoryExpanded={vi.fn()}
        showAllHistory={false}
        onToggleShowAllHistory={vi.fn()}
        onHistoryUndo={vi.fn()}
        onHistoryRedo={vi.fn()}
        infoHistoryItems={[]}
        onGoToHistoryEntry={vi.fn()}
        onOpenFullHistory={vi.fn()}
        formatHistoryTime={() => 'now'}
        isPaywallLocked={false}
        onExportActivitiesCalendar={onExportActivitiesCalendar}
        onExportCitiesCalendar={onExportCitiesCalendar}
        onExportAllCalendar={onExportAllCalendar}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export activities (.ics)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export cities (.ics)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download everything (.ics)' }));

    expect(onExportActivitiesCalendar).toHaveBeenCalledTimes(1);
    expect(onExportCitiesCalendar).toHaveBeenCalledTimes(1);
    expect(onExportAllCalendar).toHaveBeenCalledTimes(1);
  });
});
