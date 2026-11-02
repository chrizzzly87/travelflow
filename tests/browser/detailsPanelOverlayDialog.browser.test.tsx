// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { makeActivityItem, makeCityItem } from '../helpers/tripFixtures';
import type { ITimelineItem } from '../../types';

vi.mock('../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({ confirm: vi.fn(async () => false), prompt: vi.fn(async () => null) }),
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

import { DetailsPanel } from '../../components/DetailsPanel';

/**
 * The overlay variant (mobile and the non-docked layout) is a modal dialog:
 * it owns dialog semantics, moves focus in, keeps Tab inside, closes on
 * Escape and hands focus back to whatever opened it.
 */
describe('components/DetailsPanel overlay dialog', () => {
  const city = makeCityItem({ id: 'city-1', title: 'Kyoto', startDateOffset: 0, duration: 3 });
  const activity = makeActivityItem('activity-1', 'Kyoto', 1);
  const tripItems: ITimelineItem[] = [city, activity];

  const Harness: React.FC<{ onClose?: () => void; variant?: 'overlay' | 'sidebar' }> = ({ onClose, variant = 'overlay' }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>Open activity</button>
        <DetailsPanel
          item={isOpen ? activity : null}
          isOpen={isOpen}
          onClose={() => { onClose?.(); setIsOpen(false); }}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          tripStartDate="2026-03-10"
          tripItems={tripItems}
          variant={variant}
        />
      </>
    );
  };

  const openPanel = async () => {
    const trigger = screen.getByRole('button', { name: 'Open activity' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: activity.title });
    return { trigger, dialog };
  };

  it('renders the overlay as a labelled modal dialog and moves focus into it', async () => {
    render(<Harness />);
    const { dialog } = await openPanel();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const { trigger, dialog } = await openPanel();
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('wraps Shift+Tab from the panel itself to its last control', async () => {
    render(<Harness />);
    const { dialog } = await openPanel();
    await waitFor(() => {
      expect(dialog).toHaveFocus();
    });

    // jsdom has no layout, so stub the visibility probe the wrap uses.
    const rectsSpy = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    rectsSpy.mockRestore();

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(dialog);
  });

  it('keeps the docked sidebar variant free of dialog semantics', () => {
    render(
      <DetailsPanel
        item={activity}
        isOpen
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        tripStartDate="2026-03-10"
        tripItems={tripItems}
        variant="sidebar"
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
