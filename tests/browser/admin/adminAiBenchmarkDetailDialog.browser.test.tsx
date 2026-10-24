// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DialogTitle } from '../../../components/ui/dialog';
import { BenchmarkDetailDialog } from '../../../pages/AdminAiBenchmarkPage';

/**
 * The benchmark page's prompt, run-error and validation inspectors all render
 * through BenchmarkDetailDialog, so its modal contract covers all three.
 */
describe('pages/AdminAiBenchmarkPage BenchmarkDetailDialog', () => {
  const Harness: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Show error</button>
        {open && (
          <BenchmarkDetailDialog
            open
            onClose={() => { onClose(); setOpen(false); }}
            overlayZClassName="z-[2000]"
            testId="benchmark-error-dialog"
            className="z-[2001] max-w-3xl"
          >
            <DialogTitle asChild><h4>Run error details</h4></DialogTitle>
            <button type="button">Close</button>
          </BenchmarkDetailDialog>
        )}
      </>
    );
  };

  it('opens as a labelled modal dialog, closes on Escape and restores focus to the trigger', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    const trigger = screen.getByRole('button', { name: 'Show error' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Run error details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-testid', 'benchmark-error-dialog');
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
